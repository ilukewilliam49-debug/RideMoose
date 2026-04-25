import { useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceType } from "./useRideBookingState";
import { PER_STOP_FEE_CENTS, type RideStop } from "@/types/stops";
import { computeFare, FALLBACK_BYLAW_RATES, type BylawRates } from "@/lib/pricing";
import { logFareEstimateEvent } from "@/lib/fare-estimate-audit";

interface UseRideQueriesParams {
  profileId?: string;
  userId?: string;
  serviceType: ServiceType;
  pickupCoords: { lat: number; lng: number } | null;
  dropoffCoords: { lat: number; lng: number } | null;
  pickup: string;
  dropoff: string;
  distanceKm: number | null;
  passengerCount: number;
  estimatedItemCostCents: number | "";
  /** Intermediate stops between pickup and dropoff (max 3). */
  stops?: RideStop[];
  /** True when the rider has flagged a wheelchair / accessibility need. */
  accessibilityRequired?: boolean;
}

export const useRideQueries = ({
  profileId, userId, serviceType, pickupCoords, dropoffCoords,
  pickup, dropoff, distanceKm, passengerCount, estimatedItemCostCents, stops = [],
  accessibilityRequired = false,
}: UseRideQueriesParams) => {
  const queryClient = useQueryClient();
  const stopCount = stops.length;
  // Stable key for waypoints so the directions query doesn't refetch on
  // every render — only when coordinates actually change.
  const stopsKey = useMemo(
    () => stops.map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`).join("|"),
    [stops]
  );

  const { data: savedPlaces } = useQuery({
    queryKey: ["saved-places-rider", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("saved_places").select("*").eq("user_id", userId).order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: riderOrgMembership } = useQuery({
    queryKey: ["rider-org-membership", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data: memberships, error } = await supabase.from("org_members").select("organization_id, role, organizations(id, name, status, credit_limit_cents, current_balance_cents)").eq("user_id", userId);
      if (error) throw error;
      const approved = memberships?.find((m: any) => m.organizations?.status === "approved");
      if (!approved) return null;
      const org = approved.organizations as any;
      return {
        organization_id: approved.organization_id,
        org_name: org?.name,
        org_status: org?.status,
        role: approved.role,
        credit_limit_cents: org?.credit_limit_cents || 0,
        current_balance_cents: org?.current_balance_cents || 0,
      };
    },
    enabled: !!userId,
  });

  const { data: servicePricing } = useQuery({
    queryKey: ["service-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_pricing").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: taxiRates } = useQuery({
    queryKey: ["taxi-rates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("taxi_rates").select("*").eq("active", true).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: directionsData, isFetching: directionsFetching } = useQuery({
    queryKey: ["directions-traffic", pickupCoords?.lat, pickupCoords?.lng, dropoffCoords?.lat, dropoffCoords?.lng, stopsKey],
    queryFn: async () => {
      if (!pickupCoords || !dropoffCoords) return null;
      const { data, error } = await supabase.functions.invoke("directions", {
        body: {
          origin_lat: pickupCoords.lat,
          origin_lng: pickupCoords.lng,
          dest_lat: dropoffCoords.lat,
          dest_lng: dropoffCoords.lng,
          waypoints: stops.length > 0 ? stops.map((s) => ({ lat: s.lat, lng: s.lng })) : undefined,
        },
      });
      if (error) {
        // Don't crash the UI — let the Haversine fallback take over.
        console.warn("[directions] edge function error:", error.message);
        return null;
      }
      // Server returned a graceful fallback (ZERO_RESULTS / NOT_FOUND / NO_LEGS).
      if (data && (data as any).fallback) return null;
      return data as { distance_km: number; duration_sec: number; duration_text: string; duration_in_traffic_sec: number; duration_in_traffic_text: string; polyline: string | null };
    },
    enabled: !!pickupCoords && !!dropoffCoords,
    staleTime: 60_000,
    retry: false,
  });

  const trafficDelayMin = useMemo(() => {
    if (!directionsData) return 0;
    return Math.max((directionsData.duration_in_traffic_sec - directionsData.duration_sec) / 60, 0);
  }, [directionsData]);

  // Pet pricing config removed — pet_transport is no longer a service

  const currentPricing = useMemo(
    () => servicePricing?.find((p) => p.service_type === serviceType),
    [servicePricing, serviceType]
  );

  // Coerce DB taxi_rates row to BylawRates (with fallbacks for older schema reads).
  const bylawRates: BylawRates | null = useMemo(() => {
    if (!taxiRates) return null;
    const t: any = taxiRates;
    return {
      base_fare_cents: t.base_fare_cents ?? FALLBACK_BYLAW_RATES.base_fare_cents,
      included_meters: t.included_meters ?? FALLBACK_BYLAW_RATES.included_meters,
      per_increment_cents: t.per_increment_cents ?? FALLBACK_BYLAW_RATES.per_increment_cents,
      increment_meters: t.increment_meters ?? FALLBACK_BYLAW_RATES.increment_meters,
      waiting_per_min_cents: t.waiting_per_min_cents ?? FALLBACK_BYLAW_RATES.waiting_per_min_cents,
      free_waiting_min: t.free_waiting_min ?? FALLBACK_BYLAW_RATES.free_waiting_min,
      large_vehicle_surcharge_cents: t.large_vehicle_surcharge_cents ?? FALLBACK_BYLAW_RATES.large_vehicle_surcharge_cents,
      pickup_delivery_surcharge_cents: t.pickup_delivery_surcharge_cents ?? FALLBACK_BYLAW_RATES.pickup_delivery_surcharge_cents,
      pickyou_platform_fee_cents: t.pickyou_platform_fee_cents ?? FALLBACK_BYLAW_RATES.pickyou_platform_fee_cents,
      pickyou_gst_rate: Number(t.pickyou_gst_rate ?? FALLBACK_BYLAW_RATES.pickyou_gst_rate),
    };
  }, [taxiRates]);

  // Helper to compute price for a given service type
  const computePrice = (svcType: string): string | null => {
    const routeKm = directionsData?.distance_km ?? distanceKm;

    // Multi-stop surcharge — applied to all metered/distance-based services.
    const stopsSurcharge = (stopCount * PER_STOP_FEE_CENTS) / 100;

    if (svcType === "taxi" || svcType === "private_hire") {
      if (!routeKm || !bylawRates) return null;
      const breakdown = computeFare(
        svcType === "taxi" ? "taxi" : "pickyou",
        bylawRates,
        {
          distanceKm: routeKm,
          waitingMin: 0, // estimate assumes no waiting
          largeVehicle: passengerCount >= 5,
          accessibilityRequired,
          pickupDeliveryNoPassenger: false,
        }
      );
      return ((breakdown.totalCents / 100) + stopsSurcharge).toFixed(2);
    }
    if (svcType === "courier") {
      if (!routeKm) return null;
      const courierPricing = servicePricing?.find((p) => p.service_type === "courier");
      if (!courierPricing) return null;
      const base = Number(courierPricing.base_fare);
      const perKm = Number(courierPricing.per_km_rate);
      const minimum = Number(courierPricing.minimum_fare);
      const surge = Number(courierPricing.surge_multiplier) || 1;
      const computed = (base + routeKm * perKm) * surge;
      return (Math.max(minimum, computed) + stopsSurcharge).toFixed(2);
    }
    if (svcType === "large_delivery") {
      if (!routeKm) return null;
      return ((Math.max(3000, 2500 + Math.round(routeKm * 200)) + stopCount * PER_STOP_FEE_CENTS) / 100).toFixed(2);
    }
    if (svcType === "retail_delivery") {
      if (!routeKm) return null;
      return ((Math.max(1200, 1000 + Math.round(routeKm * 150)) + stopCount * PER_STOP_FEE_CENTS) / 100).toFixed(2);
    }
    if (svcType === "personal_shopper") {
      if (!routeKm) return null;
      const deliveryFeeCents = Math.max(1200, 1200 + Math.round(routeKm * 150));
      const shopperFeeCents = estimatedItemCostCents ? Math.round(Number(estimatedItemCostCents) * 0.10) : 0;
      const totalCents = deliveryFeeCents + shopperFeeCents + Number(estimatedItemCostCents || 0) + stopCount * PER_STOP_FEE_CENTS;
      return (totalCents / 100).toFixed(2);
    }
    if (!distanceKm || !currentPricing) return null;
    let price = Number(currentPricing.base_fare) + distanceKm * Number(currentPricing.per_km_rate);
    if (currentPricing.per_seat_rate) price += passengerCount * Number(currentPricing.per_seat_rate);
    price *= Number(currentPricing.surge_multiplier);
    return (Math.max(Number(currentPricing.minimum_fare), price) + stopsSurcharge).toFixed(2);
  };

  // Fingerprint of every input that influences the fare estimate.
  // Used to confirm that the displayed/submitted estimate corresponds to the
  // CURRENT pickup/dropoff/stops/service — never a stale value from before
  // the rider edited an address.
  const fareInputsKey = useMemo(() => {
    const route = directionsData?.distance_km != null
      ? `r:${directionsData.distance_km.toFixed(3)}`
      : `h:${distanceKm != null ? distanceKm.toFixed(3) : "-"}`;
    return [
      serviceType,
      pickupCoords ? `${pickupCoords.lat.toFixed(5)},${pickupCoords.lng.toFixed(5)}` : "-",
      dropoffCoords ? `${dropoffCoords.lat.toFixed(5)},${dropoffCoords.lng.toFixed(5)}` : "-",
      stopsKey || "-",
      route,
      `pax:${passengerCount}`,
      `acc:${accessibilityRequired ? 1 : 0}`,
      `item:${estimatedItemCostCents || 0}`,
    ].join("|");
  }, [serviceType, pickupCoords, dropoffCoords, stopsKey, directionsData, distanceKm, passengerCount, accessibilityRequired, estimatedItemCostCents]);

  // Dynamic price estimate for current service. Recomputes on every input
  // change so estimated_fare_cents stays bound to the bylaw subtotal contract.
  const estimatedPrice = useMemo(() => computePrice(serviceType),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fareInputsKey, currentPricing, bylawRates, servicePricing]);

  const estimatedFareCents = useMemo(() => {
    if (!estimatedPrice) return null;
    const n = parseFloat(estimatedPrice);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
  }, [estimatedPrice]);

  // The estimate is "in sync" when:
  //  - we have a value
  //  - the directions query is not currently fetching a fresher route
  // Pickup/dropoff coord changes invalidate the directions query, which sets
  // directionsFetching=true until the new route resolves — so this flag flips
  // false the moment the rider edits an address and back to true once the new
  // estimate has been computed against the new coordinates.
  const estimateInSync = !!estimatedFareCents && !directionsFetching;

  // All main service prices for the selection cards (now bylaw-correct on both sides)
  const allServicePrices = useMemo(() => ({
    taxi: computePrice("taxi"),
    private_hire: computePrice("private_hire"),
    courier: computePrice("courier"),
  }), [distanceKm, bylawRates, pickup, dropoff, directionsData, servicePricing, currentPricing, passengerCount, accessibilityRequired, stopCount]);

  // Active ride
  const { data: activeRide } = useQuery({
    queryKey: ["rider-active-ride", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase.from("rides").select("*").eq("rider_id", profileId).in("status", ["requested", "accepted", "in_progress"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const { data: driverProfile } = useQuery({
    queryKey: ["driver-location", activeRide?.driver_id],
    queryFn: async () => {
      if (!activeRide?.driver_id) return null;
      const { data, error } = await supabase.from("profiles").select("full_name, latitude, longitude, avatar_url, vehicle_make, vehicle_model, vehicle_color, vehicle_year, license_plate, average_rating, total_ratings").eq("id", activeRide.driver_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeRide?.driver_id,
    refetchInterval: 5000,
  });

  // Scoped Realtime: only listen for changes to rider's own rides
  useEffect(() => {
    if (!profileId) return;
    const channel = supabase
      .channel(`rider-rides-${profileId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "rides",
        filter: `rider_id=eq.${profileId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["rider-active-ride"] });
        queryClient.invalidateQueries({ queryKey: ["my-rides"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, profileId]);

  // Active ride directions
  const { data: activeRideDirections } = useQuery({
    queryKey: ["active-ride-directions", activeRide?.id, activeRide?.pickup_lat, activeRide?.dropoff_lat],
    queryFn: async () => {
      if (!activeRide?.pickup_lat || !activeRide?.pickup_lng || !activeRide?.dropoff_lat || !activeRide?.dropoff_lng) return null;
      const { data, error } = await supabase.functions.invoke("directions", {
        body: { origin_lat: activeRide.pickup_lat, origin_lng: activeRide.pickup_lng, dest_lat: activeRide.dropoff_lat, dest_lng: activeRide.dropoff_lng },
      });
      if (error) return null;
      return data as { polyline: string | null; distance_km: number; duration_text: string; duration_in_traffic_text: string; duration_in_traffic_sec: number; duration_sec: number };
    },
    enabled: !!activeRide?.pickup_lat && !!activeRide?.dropoff_lat,
    staleTime: 300_000,
  });

  // Live ETA
  const roundCoord = (v: number) => Math.round(v * 1000) / 1000;
  const driverLat = driverProfile?.latitude ? roundCoord(driverProfile.latitude) : null;
  const driverLng = driverProfile?.longitude ? roundCoord(driverProfile.longitude) : null;
  const liveDestLat = activeRide?.status === "in_progress" ? activeRide.dropoff_lat : activeRide?.pickup_lat;
  const liveDestLng = activeRide?.status === "in_progress" ? activeRide.dropoff_lng : activeRide?.pickup_lng;

  const { data: liveEta } = useQuery({
    queryKey: ["live-eta", activeRide?.id, driverLat, driverLng, liveDestLat, liveDestLng],
    queryFn: async () => {
      if (!driverLat || !driverLng || !liveDestLat || !liveDestLng) return null;
      const { data, error } = await supabase.functions.invoke("directions", {
        body: { origin_lat: driverLat, origin_lng: driverLng, dest_lat: liveDestLat, dest_lng: liveDestLng },
      });
      if (error) return null;
      return data as { distance_km: number; duration_text: string; duration_in_traffic_text: string; duration_in_traffic_sec: number; duration_sec: number };
    },
    enabled: !!driverLat && !!driverLng && !!liveDestLat && !!liveDestLng && !!activeRide?.driver_id,
    staleTime: 25_000,
    refetchInterval: 30_000,
  });

  const liveTrafficDelayMin = liveEta ? Math.max((liveEta.duration_in_traffic_sec - liveEta.duration_sec) / 60, 0) : 0;
  const activeTrafficDelayMin = liveEta ? liveTrafficDelayMin : (activeRideDirections ? Math.max((activeRideDirections.duration_in_traffic_sec - activeRideDirections.duration_sec) / 60, 0) : 0);
  const activeRoutePolyline = activeRideDirections?.polyline ?? null;

  const { data: rides, refetch } = useQuery({
    queryKey: ["my-rides", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase.from("rides").select("*").eq("rider_id", profileId).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const outstandingRide = useMemo(() => {
    if (!rides) return null;
    return rides.find((r) => r.payment_status === "partial" && (r.outstanding_amount_cents ?? 0) > 0) || null;
  }, [rides]);

  const { data: unratedRide, refetch: refetchUnrated } = useQuery({
    queryKey: ["unrated-ride", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data: completedRides, error } = await supabase.from("rides").select("id, driver_id, dropoff_address, completed_at").eq("rider_id", profileId).eq("status", "completed").order("completed_at", { ascending: false }).limit(5);
      if (error) throw error;
      if (!completedRides?.length) return null;
      const { data: existingRatings } = await supabase.from("ride_ratings").select("ride_id").eq("rated_by", profileId).in("ride_id", completedRides.map((r) => r.id));
      const ratedIds = new Set(existingRatings?.map((r) => r.ride_id) || []);
      return completedRides.find((r) => !ratedIds.has(r.id)) || null;
    },
    enabled: !!profileId,
  });

  const { data: ratingDriverName } = useQuery({
    queryKey: ["rating-driver-name", unratedRide?.driver_id],
    queryFn: async () => {
      if (!unratedRide?.driver_id) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", unratedRide.driver_id).single();
      return data?.full_name || null;
    },
    enabled: !!unratedRide?.driver_id,
  });

  return {
    savedPlaces, riderOrgMembership, servicePricing, taxiRates,
    bylawRates,
    directionsData, directionsFetching, trafficDelayMin,
    currentPricing,
    estimatedPrice, estimatedFareCents, fareInputsKey, estimateInSync, allServicePrices,
    activeRide, driverProfile, activeRideDirections, activeRoutePolyline,
    liveEta, activeTrafficDelayMin,
    rides, refetch, outstandingRide,
    unratedRide, refetchUnrated, ratingDriverName,
    queryClient,
  };
};
