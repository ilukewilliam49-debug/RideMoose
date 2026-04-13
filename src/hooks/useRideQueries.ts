import { useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { detectGeoZone } from "@/lib/geofence";
import type { ServiceType } from "./useRideBookingState";

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
  petMode: "pet_with_owner" | "pet_only_transport";
}

export const useRideQueries = ({
  profileId, userId, serviceType, pickupCoords, dropoffCoords,
  pickup, dropoff, distanceKm, passengerCount, estimatedItemCostCents, petMode,
}: UseRideQueriesParams) => {
  const queryClient = useQueryClient();

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
    queryKey: ["directions-traffic", pickupCoords?.lat, pickupCoords?.lng, dropoffCoords?.lat, dropoffCoords?.lng],
    queryFn: async () => {
      if (!pickupCoords || !dropoffCoords) return null;
      const { data, error } = await supabase.functions.invoke("directions", {
        body: { origin_lat: pickupCoords.lat, origin_lng: pickupCoords.lng, dest_lat: dropoffCoords.lat, dest_lng: dropoffCoords.lng },
      });
      if (error) throw error;
      return data as { distance_km: number; duration_sec: number; duration_text: string; duration_in_traffic_sec: number; duration_in_traffic_text: string; polyline: string | null };
    },
    enabled: !!pickupCoords && !!dropoffCoords,
    staleTime: 60_000,
  });

  const trafficDelayMin = useMemo(() => {
    if (!directionsData) return 0;
    return Math.max((directionsData.duration_in_traffic_sec - directionsData.duration_sec) / 60, 0);
  }, [directionsData]);

  const { data: petPricingConfig } = useQuery({
    queryKey: ["pet-pricing-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_config").select("key, value").in("key", ["pet_surcharge_cents", "pet_only_base_cents", "pet_only_per_km_cents", "pet_only_minimum_cents"]);
      if (error) throw error;
      const map: Record<string, number> = {};
      data?.forEach((r) => { map[r.key] = Number(r.value); });
      return map;
    },
    enabled: false,
  });

  const { data: privateHireZones } = useQuery({
    queryKey: ["private-hire-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("private_hire_zones").select("*").eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: geoZones } = useQuery({
    queryKey: ["geo-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("geo_zones").select("*");
      if (error) throw error;
      return data.map((d) => ({ ...d, polygon: d.polygon as unknown as [number, number][] }));
    },
  });

  const currentPricing = useMemo(
    () => servicePricing?.find((p) => p.service_type === serviceType),
    [servicePricing, serviceType]
  );

  const detectZone = (coords: { lat: number; lng: number } | null, address: string): string => {
    if (coords && geoZones?.length) {
      const matched = detectGeoZone(coords.lat, coords.lng, geoZones);
      if (matched) return matched;
    }
    const lower = address.toLowerCase();
    if (lower.includes("airport")) return "airport";
    if (lower.includes("ingraham")) return "ingraham_trail";
    return "city";
  };

  const pickupZoneKey = useMemo(
    () => (serviceType === "private_hire" && (pickupCoords || pickup) ? detectZone(pickupCoords, pickup) : null),
    [serviceType, pickupCoords, pickup, geoZones]
  );
  const dropoffZoneKey = useMemo(
    () => (serviceType === "private_hire" && (dropoffCoords || dropoff) ? detectZone(dropoffCoords, dropoff) : null),
    [serviceType, dropoffCoords, dropoff, geoZones]
  );

  const matchedZone = useMemo(() => {
    if (serviceType !== "private_hire" || !pickupZoneKey || !dropoffZoneKey || !privateHireZones) return null;
    return privateHireZones.find((z) => z.pickup_zone === pickupZoneKey && z.dropoff_zone === dropoffZoneKey) || null;
  }, [serviceType, pickupZoneKey, dropoffZoneKey, privateHireZones]);

  // Helper to compute price for a given service type
  const computePrice = (svcType: string): string | null => {
    const routeKm = directionsData?.distance_km ?? distanceKm;
    const routeDurationMin = directionsData
      ? Math.max((directionsData.duration_in_traffic_sec ?? directionsData.duration_sec ?? 0) / 60, 0)
      : 0;

    if (svcType === "private_hire") {
      const pricing = servicePricing?.find((p) => p.service_type === "private_hire");
      if (!pickup || !dropoff || !routeKm || !pricing) return null;
      let price =
        Number(pricing.base_fare) +
        routeKm * Number(pricing.per_km_rate) +
        routeDurationMin * Number(pricing.per_min_rate);
      price *= Number(pricing.surge_multiplier ?? 1);
      return Math.max(Number(pricing.minimum_fare), price).toFixed(2);
    }
    if (svcType === "courier") {
      if (!routeKm) return null;
      return (Math.max(1200, 800 + Math.round(routeKm * 150)) / 100).toFixed(2);
    }
    if (svcType === "large_delivery") {
      if (!routeKm) return null;
      return (Math.max(3000, 2500 + Math.round(routeKm * 200)) / 100).toFixed(2);
    }
    if (svcType === "retail_delivery") {
      if (!routeKm) return null;
      return (Math.max(1200, 1000 + Math.round(routeKm * 150)) / 100).toFixed(2);
    }
    if (svcType === "personal_shopper") {
      if (!routeKm) return null;
      const deliveryFeeCents = Math.max(1200, 1200 + Math.round(routeKm * 150));
      const shopperFeeCents = estimatedItemCostCents ? Math.round(Number(estimatedItemCostCents) * 0.10) : 0;
      const totalCents = deliveryFeeCents + shopperFeeCents + Number(estimatedItemCostCents || 0);
      return (totalCents / 100).toFixed(2);
    }
    if (svcType === "pet_transport") {
      if (!routeKm) return null;
      const surcharge = petPricingConfig?.pet_surcharge_cents ?? 500;
      const petBase = petPricingConfig?.pet_only_base_cents ?? 2000;
      const petPerKm = petPricingConfig?.pet_only_per_km_cents ?? 200;
      const petMin = petPricingConfig?.pet_only_minimum_cents ?? 2500;
      if (petMode === "pet_with_owner") {
        if (!taxiRates) return null;
        return ((taxiRates.base_fare_cents + routeKm * taxiRates.per_km_cents + surcharge) / 100).toFixed(2);
      } else {
        return (Math.max(petMin, petBase + Math.round(routeKm * petPerKm)) / 100).toFixed(2);
      }
    }
    if (svcType === "taxi") {
      if (!routeKm || !taxiRates) return null;
      return ((taxiRates.base_fare_cents + routeKm * taxiRates.per_km_cents) / 100).toFixed(2);
    }
    if (!distanceKm || !currentPricing) return null;
    let price = Number(currentPricing.base_fare) + distanceKm * Number(currentPricing.per_km_rate);
    if (currentPricing.per_seat_rate) price += passengerCount * Number(currentPricing.per_seat_rate);
    price *= Number(currentPricing.surge_multiplier);
    return Math.max(Number(currentPricing.minimum_fare), price).toFixed(2);
  };

  // Dynamic price estimate for current service
  const estimatedPrice = useMemo(() => computePrice(serviceType),
    [distanceKm, currentPricing, taxiRates, serviceType, passengerCount, pickup, dropoff, matchedZone, directionsData, petMode, petPricingConfig, estimatedItemCostCents, servicePricing]);

  // All main service prices for the selection cards
  const allServicePrices = useMemo(() => ({
    taxi: computePrice("taxi"),
    private_hire: computePrice("private_hire"),
    courier: computePrice("courier"),
  }), [distanceKm, taxiRates, pickup, dropoff, directionsData, servicePricing, currentPricing]);

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
      const { data, error } = await supabase.from("profiles").select("full_name, latitude, longitude").eq("id", activeRide.driver_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeRide?.driver_id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const channel = supabase.channel("rider-rides").on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
      queryClient.invalidateQueries({ queryKey: ["rider-active-ride"] });
      queryClient.invalidateQueries({ queryKey: ["my-rides"] });
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

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
    directionsData, directionsFetching, trafficDelayMin,
    petPricingConfig, privateHireZones, geoZones,
    currentPricing, pickupZoneKey, dropoffZoneKey, matchedZone,
    estimatedPrice, allServicePrices,
    activeRide, driverProfile, activeRideDirections, activeRoutePolyline,
    liveEta, activeTrafficDelayMin,
    rides, refetch, outstandingRide,
    unratedRide, refetchUnrated, ratingDriverName,
    queryClient,
  };
};
