import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DollarSign, ArrowLeft, Car, Bus, Users, Star, Briefcase, MapPinned, Clock, AlertTriangle, CreditCard, Banknote, Building2, Package, ShoppingBag, Truck, Store, ShoppingCart } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import RideRatingDialog from "@/components/RideRatingDialog";
import { detectGeoZone } from "@/lib/geofence";
import PaymentConfirmation from "@/components/PaymentConfirmation";
import { useTranslation } from "react-i18next";
import DeliveryBidsList from "@/components/DeliveryBidsList";

type ServiceType = "taxi" | "private_hire" | "shuttle" | "courier" | "large_delivery" | "retail_delivery" | "personal_shopper";

const RiderDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>("taxi");
  const [paymentOption, setPaymentOption] = useState<"in_app" | "pay_driver">("in_app");
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [authorizedAmountCents, setAuthorizedAmountCents] = useState(0);
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [billToOrg, setBillToOrg] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [packageSize, setPackageSize] = useState<"small" | "medium" | "large">("small");
  const [pickupNotes, setPickupNotes] = useState("");
  const [dropoffNotes, setDropoffNotes] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [marketplaceDelivery, setMarketplaceDelivery] = useState(false);
  const [requiresLoadingHelp, setRequiresLoadingHelp] = useState(false);
  const [stairsInvolved, setStairsInvolved] = useState(false);
  const [weightEstimateKg, setWeightEstimateKg] = useState<number | "">("");
  const [storeId, setStoreId] = useState("");
  const [orderValueCents, setOrderValueCents] = useState<number | "">("");
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [estimatedItemCostCents, setEstimatedItemCostCents] = useState<number | "">(0);

  // Fetch rider's approved org membership with credit info
  const { data: riderOrgMembership } = useQuery({
    queryKey: ["rider-org-membership", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const { data: memberships, error } = await supabase
        .from("org_members")
        .select("organization_id, role, organizations(id, name, status, credit_limit_cents, current_balance_cents)")
        .eq("user_id", profile.user_id);
      if (error) throw error;
      // Find first approved org (not suspended)
      const approved = memberships?.find(
        (m: any) => m.organizations?.status === "approved"
      );
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
    enabled: !!profile?.user_id,
  });

  // Fetch service pricing
  const { data: servicePricing } = useQuery({
    queryKey: ["service-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_pricing")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch taxi meter rates for accurate taxi estimates
  const { data: taxiRates } = useQuery({
    queryKey: ["taxi-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("taxi_rates")
        .select("*")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch Google Directions with traffic for taxi rides
  const { data: directionsData, isFetching: directionsFetching } = useQuery({
    queryKey: ["directions-traffic", pickupCoords?.lat, pickupCoords?.lng, dropoffCoords?.lat, dropoffCoords?.lng],
    queryFn: async () => {
      if (!pickupCoords || !dropoffCoords) return null;
      const { data, error } = await supabase.functions.invoke("directions", {
        body: {
          origin_lat: pickupCoords.lat,
          origin_lng: pickupCoords.lng,
          dest_lat: dropoffCoords.lat,
          dest_lng: dropoffCoords.lng,
        },
      });
      if (error) throw error;
      return data as {
        distance_km: number;
        duration_sec: number;
        duration_text: string;
        duration_in_traffic_sec: number;
        duration_in_traffic_text: string;
      };
    },
    enabled: !!pickupCoords && !!dropoffCoords && (serviceType === "taxi" || serviceType === "courier" || serviceType === "large_delivery" || serviceType === "retail_delivery" || serviceType === "personal_shopper"),
    staleTime: 60_000,
  });

  const trafficDelayMin = useMemo(() => {
    if (!directionsData) return 0;
    return Math.max((directionsData.duration_in_traffic_sec - directionsData.duration_sec) / 60, 0);
  }, [directionsData]);


  const { data: privateHireZones } = useQuery({
    queryKey: ["private-hire-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("private_hire_zones")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch geo zones for polygon-based detection
  const { data: geoZones } = useQuery({
    queryKey: ["geo-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("geo_zones")
        .select("*");
      if (error) throw error;
      return data.map((d) => ({ ...d, polygon: d.polygon as unknown as [number, number][] }));
    },
  });

  const currentPricing = useMemo(
    () => servicePricing?.find((p) => p.service_type === serviceType),
    [servicePricing, serviceType]
  );

  // Calculate distance
  const distanceKm = useMemo(() => {
    if (!pickupCoords || !dropoffCoords) return null;
    const R = 6371;
    const dLat = ((dropoffCoords.lat - pickupCoords.lat) * Math.PI) / 180;
    const dLon = ((dropoffCoords.lng - pickupCoords.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((pickupCoords.lat * Math.PI) / 180) * Math.cos((dropoffCoords.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [pickupCoords, dropoffCoords]);

  // Geo-zone detection: use coordinates first, fall back to keyword matching
  const detectZone = (coords: { lat: number; lng: number } | null, address: string): string => {
    // Try polygon-based detection first
    if (coords && geoZones?.length) {
      const matched = detectGeoZone(coords.lat, coords.lng, geoZones);
      if (matched) return matched;
    }
    // Keyword fallback
    const lower = address.toLowerCase();
    if (lower.includes("airport")) return "airport";
    if (lower.includes("ingraham")) return "ingraham_trail";
    return "city";
  };

  // Detected zone keys for pickup and dropoff
  const pickupZoneKey = useMemo(
    () => (serviceType === "private_hire" && (pickupCoords || pickup) ? detectZone(pickupCoords, pickup) : null),
    [serviceType, pickupCoords, pickup, geoZones]
  );
  const dropoffZoneKey = useMemo(
    () => (serviceType === "private_hire" && (dropoffCoords || dropoff) ? detectZone(dropoffCoords, dropoff) : null),
    [serviceType, dropoffCoords, dropoff, geoZones]
  );

  // Matched zone for private hire
  const matchedZone = useMemo(() => {
    if (serviceType !== "private_hire" || !pickupZoneKey || !dropoffZoneKey || !privateHireZones) return null;
    return privateHireZones.find(
      (z) => z.pickup_zone === pickupZoneKey && z.dropoff_zone === dropoffZoneKey
    ) || null;
  }, [serviceType, pickupZoneKey, dropoffZoneKey, privateHireZones]);

  // Dynamic price estimate
  const estimatedPrice = useMemo(() => {
    // Private hire: zone-based flat pricing
    if (serviceType === "private_hire") {
      if (!pickup || !dropoff) return null;
      const fareCents = matchedZone ? matchedZone.flat_fare_cents : 5000;
      return (fareCents / 100).toFixed(2);
    }
    // Courier: base + distance
    if (serviceType === "courier") {
      const routeKm = directionsData?.distance_km ?? distanceKm;
      if (!routeKm) return null;
      const baseCents = 800;
      const distFeeCents = Math.round(routeKm * 150);
      const totalCents = Math.max(1200, baseCents + distFeeCents);
      return (totalCents / 100).toFixed(2);
    }
    // Large Delivery: base 2500 + distance * 200, min 3000
    if (serviceType === "large_delivery") {
      const routeKm = directionsData?.distance_km ?? distanceKm;
      if (!routeKm) return null;
      const baseCents = 2500;
      const distFeeCents = Math.round(routeKm * 200);
      const totalCents = Math.max(3000, baseCents + distFeeCents);
      return (totalCents / 100).toFixed(2);
    }
    // Retail Delivery: base 1000 + distance * 150, min 1200
    if (serviceType === "retail_delivery") {
      const routeKm = directionsData?.distance_km ?? distanceKm;
      if (!routeKm) return null;
      const baseCents = 1000;
      const distFeeCents = Math.round(routeKm * 150);
      const totalCents = Math.max(1200, baseCents + distFeeCents);
      return (totalCents / 100).toFixed(2);
    }
    // Personal Shopper: delivery_fee = base 1200 + distance, shopper_fee = 10% of item cost
    if (serviceType === "personal_shopper") {
      const routeKm = directionsData?.distance_km ?? distanceKm;
      if (!routeKm) return null;
      const deliveryFeeCents = Math.max(1200, 1200 + Math.round(routeKm * 150));
      const shopperFeeCents = estimatedItemCostCents ? Math.round(Number(estimatedItemCostCents) * 0.10) : 0;
      const totalCents = deliveryFeeCents + shopperFeeCents + Number(estimatedItemCostCents || 0);
      return (totalCents / 100).toFixed(2);
    }
    // Taxi: use taxi_rates with route distance from Directions API when available
    if (serviceType === "taxi") {
      const routeKm = directionsData?.distance_km ?? distanceKm;
      if (!routeKm || !taxiRates) return null;
      const fareCents = taxiRates.base_fare_cents + routeKm * taxiRates.per_km_cents;
      return (fareCents / 100).toFixed(2);
    }
    // Shuttle: distance-based from service_pricing
    if (!distanceKm || !currentPricing) return null;
    let price = Number(currentPricing.base_fare) + distanceKm * Number(currentPricing.per_km_rate);
    if (currentPricing.per_seat_rate) {
      price += passengerCount * Number(currentPricing.per_seat_rate);
    }
    price *= Number(currentPricing.surge_multiplier);
    return Math.max(Number(currentPricing.minimum_fare), price).toFixed(2);
  }, [distanceKm, currentPricing, taxiRates, serviceType, passengerCount, pickup, dropoff, matchedZone, directionsData]);

  const mapMarkers: MapMarker[] = [
    ...(pickupCoords ? [{ lat: pickupCoords.lat, lng: pickupCoords.lng, type: "pickup" as const, label: t("rider.pickup") }] : []),
    ...(dropoffCoords ? [{ lat: dropoffCoords.lat, lng: dropoffCoords.lng, type: "dropoff" as const, label: t("rider.dropoff") }] : []),
  ];

  // Active ride
  const { data: activeRide } = useQuery({
    queryKey: ["rider-active-ride", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("rider_id", profile.id)
        .in("status", ["requested", "accepted", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: driverProfile } = useQuery({
    queryKey: ["driver-location", activeRide?.driver_id],
    queryFn: async () => {
      if (!activeRide?.driver_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, latitude, longitude")
        .eq("id", activeRide.driver_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeRide?.driver_id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("rider-rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        queryClient.invalidateQueries({ queryKey: ["rider-active-ride"] });
        queryClient.invalidateQueries({ queryKey: ["my-rides"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Overage detection moved after rides query below

  const activeMarkers: MapMarker[] = activeRide
    ? [
        ...(activeRide.pickup_lat && activeRide.pickup_lng ? [{ lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, type: "pickup" as const, label: t("rider.pickup") }] : []),
        ...(activeRide.dropoff_lat && activeRide.dropoff_lng ? [{ lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng, type: "dropoff" as const, label: t("rider.dropoff") }] : []),
        ...(driverProfile?.latitude && driverProfile?.longitude ? [{ lat: driverProfile.latitude, lng: driverProfile.longitude, type: "driver" as const, label: driverProfile.full_name || t("rider.driver") }] : []),
      ]
    : [];

  const { data: rides, refetch } = useQuery({
    queryKey: ["my-rides", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("rider_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Detect outstanding balance from completed ride
  const outstandingRide = useMemo(() => {
    if (!rides) return null;
    return rides.find(
      (r) => r.payment_status === "partial" && (r.outstanding_amount_cents ?? 0) > 0
    ) || null;
  }, [rides]);

  // Find most recent completed ride that hasn't been rated yet
  const { data: unratedRide, refetch: refetchUnrated } = useQuery({
    queryKey: ["unrated-ride", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      // Get completed rides
      const { data: completedRides, error } = await supabase
        .from("rides")
        .select("id, driver_id, dropoff_address, completed_at")
        .eq("rider_id", profile.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      if (!completedRides?.length) return null;

      // Check which have already been rated
      const { data: existingRatings } = await supabase
        .from("ride_ratings")
        .select("ride_id")
        .eq("rated_by", profile.id)
        .in("ride_id", completedRides.map((r) => r.id));

      const ratedIds = new Set(existingRatings?.map((r) => r.ride_id) || []);
      return completedRides.find((r) => !ratedIds.has(r.id)) || null;
    },
    enabled: !!profile?.id,
  });

  // Fetch driver name for rating dialog
  const { data: ratingDriverName } = useQuery({
    queryKey: ["rating-driver-name", unratedRide?.driver_id],
    queryFn: async () => {
      if (!unratedRide?.driver_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", unratedRide.driver_id)
        .single();
      return data?.full_name || null;
    },
    enabled: !!unratedRide?.driver_id,
  });

  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [manualRateRideId, setManualRateRideId] = useState<string | null>(null);
  const [manualRateDriverId, setManualRateDriverId] = useState<string | null>(null);

  // Auto-open rating dialog when unrated ride is found
  useEffect(() => {
    if (unratedRide && !manualRateRideId) {
      setRatingDialogOpen(true);
    }
  }, [unratedRide, manualRateRideId]);

  const currentRatingRideId = manualRateRideId || unratedRide?.id;
  const currentRatingDriverId = manualRateDriverId || unratedRide?.driver_id;

  const [cancellingRide, setCancellingRide] = useState(false);

  const cancelRide = async () => {
    if (!activeRide) return;
    setCancellingRide(true);
    try {
      // If large_delivery with authorized payment, release the hold first
      if (activeRide.service_type === "large_delivery" && activeRide.payment_status === "authorized") {
        const { error: cancelPayErr } = await supabase.functions.invoke("cancel-bid-payment", {
          body: { ride_id: activeRide.id },
        });
        if (cancelPayErr) console.error("Failed to release payment hold:", cancelPayErr);
      }

      const { error } = await supabase
        .from("rides")
        .update({ status: "cancelled" })
        .eq("id", activeRide.id);
      if (error) throw error;
      toast.success(t("rider.rideCancelled"));
      queryClient.invalidateQueries({ queryKey: ["rider-active-ride"] });
      queryClient.invalidateQueries({ queryKey: ["my-rides"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCancellingRide(false);
    }
  };

  const requestRide = async () => {
    if (!profile?.id || !pickup || !dropoff || !pickupCoords || !dropoffCoords) return;
    // Retail delivery requires business account
    if (serviceType === "retail_delivery" && !riderOrgMembership) {
      toast.error(t("rider.businessAccountRequired"));
      return;
    }
    setLoading(true);
    try {
      const estCents = Math.round(parseFloat(estimatedPrice || "0") * 100);
      const isOrgBilling = (billToOrg && riderOrgMembership) || (serviceType === "retail_delivery" && riderOrgMembership);

      // Credit limit + suspension check for org billing
      if (isOrgBilling && riderOrgMembership) {
        if (riderOrgMembership.org_status === "suspended") {
          toast.error(t("rider.orgSuspendedError"));
          setLoading(false);
          return;
        }
        const projectedBalance = riderOrgMembership.current_balance_cents + estCents;
        if (projectedBalance > riderOrgMembership.credit_limit_cents) {
          toast.error(t("rider.creditLimitError", { limit: (riderOrgMembership.credit_limit_cents / 100).toFixed(2), balance: (riderOrgMembership.current_balance_cents / 100).toFixed(2) }));
          setLoading(false);
          return;
        }
      }
      const { data: rideData, error } = await supabase.from("rides").insert({
        rider_id: profile.id,
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        dropoff_lat: dropoffCoords.lat,
        dropoff_lng: dropoffCoords.lng,
        estimated_price: parseFloat(estimatedPrice || "0"),
        distance_km: distanceKm ? parseFloat(distanceKm.toFixed(2)) : null,
        service_type: serviceType,
        passenger_count: passengerCount,
        pricing_model: serviceType === "private_hire" ? "flat_zone" : serviceType === "courier" ? "courier" : serviceType === "large_delivery" ? "large_delivery" : serviceType === "retail_delivery" ? "retail_delivery" : serviceType === "personal_shopper" ? "personal_shopper" : "metered",
        status: "requested",
        payment_option: isOrgBilling ? "pay_driver" : paymentOption,
        billed_to: isOrgBilling ? "organization" : "individual",
        organization_id: isOrgBilling ? riderOrgMembership!.organization_id : null,
        payment_status: isOrgBilling ? "invoiced_pending" : "unpaid",
        po_number: isOrgBilling && poNumber ? poNumber : null,
        cost_center: isOrgBilling && costCenter ? costCenter : null,
        ...(serviceType === "courier" ? {
          package_size: packageSize,
          pickup_notes: pickupNotes || null,
          dropoff_notes: dropoffNotes || null,
          proof_photo_required: true,
          item_description: itemDescription || null,
          marketplace_delivery: marketplaceDelivery,
        } : {}),
        ...(serviceType === "large_delivery" ? {
          item_description: itemDescription || null,
          requires_loading_help: requiresLoadingHelp,
          stairs_involved: stairsInvolved,
          weight_estimate_kg: weightEstimateKg || null,
          pickup_notes: pickupNotes || null,
          dropoff_notes: dropoffNotes || null,
          proof_photo_required: true,
        } : {}),
        ...(serviceType === "retail_delivery" ? {
          store_id: storeId || null,
          order_value_cents: orderValueCents || null,
          package_size: packageSize,
          signature_required: signatureRequired,
          pickup_notes: pickupNotes || null,
          dropoff_notes: dropoffNotes || null,
          proof_photo_required: true,
        } : {}),
        ...(serviceType === "personal_shopper" ? {
          store_name: storeName || null,
          item_description: itemDescription || null,
          quantity: quantity || 1,
          estimated_item_cost_cents: estimatedItemCostCents || null,
          delivery_fee_cents: (() => {
            const routeKm = directionsData?.distance_km ?? distanceKm ?? 0;
            return Math.max(1200, 1200 + Math.round(routeKm * 150));
          })(),
          shopper_fee_cents: estimatedItemCostCents ? Math.round(Number(estimatedItemCostCents) * 0.10) : 0,
          dropoff_notes: dropoffNotes || null,
          proof_photo_required: true,
          payment_option: "in_app",
        } : {}),
      } as any).select("id").single();
      if (error) throw error;

      // Personal shopper: authorize estimated_total * 1.15
      if (serviceType === "personal_shopper" && rideData) {
        const deliveryCents = Math.max(1200, 1200 + Math.round((directionsData?.distance_km ?? distanceKm ?? 0) * 150));
        const shopperCents = estimatedItemCostCents ? Math.round(Number(estimatedItemCostCents) * 0.10) : 0;
        const estimatedTotalCents = Number(estimatedItemCostCents || 0) + deliveryCents + shopperCents;
        const authorizeCents = Math.round(estimatedTotalCents * 1.15);
        
        const { data: piData, error: piError } = await supabase.functions.invoke(
          "create-payment-intent",
          { body: { ride_id: rideData.id, estimated_fare_cents: authorizeCents } }
        );
        if (piError) {
          await supabase.from("rides").update({ payment_status: "failed", status: "cancelled" }).eq("id", rideData.id);
          throw new Error(piError.message || "Payment authorization failed");
        }
        setPaymentClientSecret(piData.clientSecret);
        setAuthorizedAmountCents(piData.authorized_amount_cents);
        setPendingRideId(rideData.id);
        setLoading(false);
        return;
      }

      // Skip Stripe for org-billed rides
      if (!isOrgBilling && paymentOption === "in_app" && serviceType === "taxi" && rideData) {
        const { data: piData, error: piError } = await supabase.functions.invoke(
          "create-payment-intent",
          { body: { ride_id: rideData.id, estimated_fare_cents: estCents } }
        );
        if (piError) {
          await supabase.from("rides").update({ payment_status: "failed", status: "cancelled" }).eq("id", rideData.id);
          throw new Error(piError.message || "Payment authorization failed");
        }
        setPaymentClientSecret(piData.clientSecret);
        setAuthorizedAmountCents(piData.authorized_amount_cents);
        setPendingRideId(rideData.id);
        setLoading(false);
        return;
      }

      toast.success(billToOrg ? t("rider.rideRequestedOrg") : t("rider.rideRequested"));
      setPickup("");
      setDropoff("");
      setPickupCoords(null);
      setDropoffCoords(null);
      setPassengerCount(1);
      setBillToOrg(false);
      setPoNumber("");
      setCostCenter("");
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentClientSecret(null);
    setPendingRideId(null);
    setAuthorizedAmountCents(0);
    toast.success(t("rider.paymentAuthorized"));
    setPickup("");
    setDropoff("");
    setPickupCoords(null);
    setDropoffCoords(null);
    setPassengerCount(1);
    refetch();
  };

  const statusColor: Record<string, string> = {
    requested: "text-yellow-400",
    dispatched: "text-blue-400",
    accepted: "text-cyan-400",
    in_progress: "text-primary",
    completed: "text-green-400",
    cancelled: "text-muted-foreground",
  };

  const showActiveMap = activeRide && activeMarkers.length > 0;
  const showBookingMap = !activeRide && mapMarkers.length > 0;

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rider")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {activeRide ? t("rider.rideInProgress") : t("rider.requestARide")}
        </h1>
      </div>

      {/* Active ride tracking map */}
      {showActiveMap && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <RideMap markers={activeMarkers} />
          <div className="glass-surface rounded-lg p-4 mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                {activeRide.service_type === "private_hire" ? t("rider.privateHireFlatRate") : activeRide.service_type}
              </span>
              <p className="text-sm font-medium">{activeRide.pickup_address} → {activeRide.dropoff_address}</p>
            </div>
            <p className={`text-xs font-mono uppercase ${statusColor[activeRide.status]}`}>
              {t(`rider.status_${activeRide.status}`)}
            </p>
            {driverProfile && (
              <p className="text-xs text-muted-foreground">{t("rider.driver")}: {driverProfile.full_name}</p>
            )}
            {/* Payment hold indicator for large delivery */}
            {activeRide.service_type === "large_delivery" && activeRide.payment_status === "authorized" && activeRide.authorized_amount_cents > 0 && (
              <div className="mt-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                <CreditCard className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-medium text-primary">{t("rider.paymentAuthorizedLabel")}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {t("rider.heldCaptured", { amount: (activeRide.authorized_amount_cents / 100).toFixed(2) })}
                  </p>
                </div>
              </div>
            )}
            {/* Large delivery bids panel */}
            {activeRide.service_type === "large_delivery" && activeRide.status === "requested" && (
              <div className="mt-3">
                <DeliveryBidsList rideId={activeRide.id} />
              </div>
            )}
            {(activeRide.status === "requested" || activeRide.status === "accepted") && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full mt-2"
                disabled={cancellingRide}
                onClick={cancelRide}
              >
                {cancellingRide ? t("rider.cancelling") : t("rider.cancelRide")}
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Booking form */}
      {!activeRide && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-surface rounded-lg p-6 space-y-4 overflow-visible"
        >
          {/* Service Type Toggle */}
          <div className="space-y-2">
            <Label>{t("rider.serviceType")}</Label>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              {([
                { key: "taxi" as ServiceType, icon: Car, label: t("rider.taxi"), desc: t("rider.meteredRide") },
                { key: "private_hire" as ServiceType, icon: Briefcase, label: t("rider.privateHire"), desc: t("rider.flatFare") },
                { key: "shuttle" as ServiceType, icon: Bus, label: t("rider.shuttle"), desc: t("rider.perSeatPricing") },
                { key: "courier" as ServiceType, icon: Package, label: t("rider.courier"), desc: t("rider.packageDelivery") },
                { key: "large_delivery" as ServiceType, icon: Truck, label: t("rider.largeItem"), desc: t("rider.heavyBulkyItems") },
                { key: "retail_delivery" as ServiceType, icon: Store, label: t("rider.retailDelivery"), desc: t("rider.retailDeliveryDesc") },
                { key: "personal_shopper" as ServiceType, icon: ShoppingCart, label: t("rider.personalShopper"), desc: t("rider.personalShopperDesc") },
              ]).map(({ key, icon: Icon, label, desc }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setServiceType(key); if (key !== "shuttle") setPassengerCount(1); }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                    serviceType === key
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-secondary hover:bg-accent"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${serviceType === key ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Passenger count for shuttle */}
          {serviceType === "shuttle" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {t("rider.passengers")}
              </Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={passengerCount}
                onChange={(e) => setPassengerCount(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                className="w-24 bg-secondary"
              />
            </div>
          )}

          {/* Courier fields */}
          {serviceType === "courier" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  {t("rider.packageSize")}
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPackageSize(size)}
                      className={`p-2 rounded-lg border text-xs font-medium capitalize transition-all ${
                        packageSize === size
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary hover:bg-accent"
                      }`}
                    >
                      {t(`rider.package_${size}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("rider.itemDescription")}</Label>
                <Input
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder={t("rider.describeItem")}
                  className="bg-secondary"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t("rider.marketplaceDelivery")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("rider.marketplaceDeliveryDesc")}</p>
                  </div>
                </div>
                <Switch
                  checked={marketplaceDelivery}
                  onCheckedChange={setMarketplaceDelivery}
                />
              </div>
              {marketplaceDelivery && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-yellow-500">{t("rider.ensureCapacity")}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("rider.pickupNotes")}</Label>
                <Input
                  value={pickupNotes}
                  onChange={(e) => setPickupNotes(e.target.value)}
                  placeholder={t("rider.pickupNotesPlaceholder")}
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rider.dropoffNotes")}</Label>
                <Input
                  value={dropoffNotes}
                  onChange={(e) => setDropoffNotes(e.target.value)}
                  placeholder={t("rider.dropoffNotesPlaceholder")}
                  className="bg-secondary"
                />
              </div>
            </div>
          )}

          {/* Large Delivery fields */}
          {serviceType === "large_delivery" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("rider.itemDescription")}</Label>
                <Input
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder={t("rider.describeItemLarge")}
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rider.estimatedWeight")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={weightEstimateKg}
                  onChange={(e) => setWeightEstimateKg(e.target.value ? parseInt(e.target.value) : "")}
                  placeholder={t("rider.approxWeight")}
                  className="bg-secondary w-32"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-3">
                <div>
                  <p className="text-sm font-medium">{t("rider.requiresLoadingHelp")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("rider.loadingHelpDesc")}</p>
                </div>
                <Switch checked={requiresLoadingHelp} onCheckedChange={setRequiresLoadingHelp} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-3">
                <div>
                  <p className="text-sm font-medium">{t("rider.stairsInvolved")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("rider.stairsDesc")}</p>
                </div>
                <Switch checked={stairsInvolved} onCheckedChange={setStairsInvolved} />
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Truck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">{t("rider.largeVehicleNote")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("rider.pickupNotes")}</Label>
                <Input
                  value={pickupNotes}
                  onChange={(e) => setPickupNotes(e.target.value)}
                  placeholder={t("rider.pickupNotesPlaceholder")}
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rider.dropoffNotes")}</Label>
                <Input
                  value={dropoffNotes}
                  onChange={(e) => setDropoffNotes(e.target.value)}
                  placeholder={t("rider.dropoffNotesPlaceholder")}
                  className="bg-secondary"
                />
              </div>
            </div>
          )}

          {/* Retail Delivery fields */}
          {serviceType === "retail_delivery" && (
            <div className="space-y-3">
              {!riderOrgMembership && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">{t("rider.businessAccountRequired")}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("rider.storeId")}</Label>
                <Input
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  placeholder={t("rider.storeIdPlaceholder")}
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rider.orderValue")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={orderValueCents ? (orderValueCents as number / 100) : ""}
                  onChange={(e) => setOrderValueCents(e.target.value ? Math.round(parseFloat(e.target.value) * 100) : "")}
                  placeholder={t("rider.orderValuePlaceholder")}
                  className="bg-secondary w-40"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  {t("rider.packageSize")}
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPackageSize(size)}
                      className={`p-2 rounded-lg border text-xs font-medium capitalize transition-all ${
                        packageSize === size
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary hover:bg-accent"
                      }`}
                    >
                      {t(`rider.package_${size}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-3">
                <div>
                  <p className="text-sm font-medium">{t("rider.signatureRequired")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("rider.signatureRequiredDesc")}</p>
                </div>
                <Switch checked={signatureRequired} onCheckedChange={setSignatureRequired} />
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Store className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">{t("rider.retailProofNote")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("rider.pickupNotes")}</Label>
                <Input
                  value={pickupNotes}
                  onChange={(e) => setPickupNotes(e.target.value)}
                  placeholder={t("rider.pickupNotesPlaceholder")}
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rider.dropoffNotes")}</Label>
                <Input
                  value={dropoffNotes}
                  onChange={(e) => setDropoffNotes(e.target.value)}
                  placeholder={t("rider.dropoffNotesPlaceholder")}
                  className="bg-secondary"
                />
              </div>
            </div>
          )}

          {/* Personal Shopper fields */}
          {serviceType === "personal_shopper" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("rider.storeName")}</Label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder={t("rider.storeNamePlaceholder")}
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rider.itemDescription")}</Label>
                <Input
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder={t("rider.describeItem")}
                  className="bg-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rider.quantity")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value ? parseInt(e.target.value) : "")}
                  placeholder={t("rider.quantityPlaceholder")}
                  className="bg-secondary w-24"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rider.estimatedItemCost")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={estimatedItemCostCents ? (Number(estimatedItemCostCents) / 100) : ""}
                  onChange={(e) => setEstimatedItemCostCents(e.target.value ? Math.round(parseFloat(e.target.value) * 100) : "")}
                  placeholder={t("rider.estimatedItemCostPlaceholder")}
                  className="bg-secondary w-40"
                />
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <ShoppingCart className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("rider.shopperFeeNote")}</p>
                  <p className="text-xs text-muted-foreground">{t("rider.receiptRequired")}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("rider.dropoffNotes")}</Label>
                <Input
                  value={dropoffNotes}
                  onChange={(e) => setDropoffNotes(e.target.value)}
                  placeholder={t("rider.dropoffNotesPlaceholder")}
                  className="bg-secondary"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("rider.pickupLocation")}</Label>
            <AddressAutocomplete
              value={pickup}
              onChange={(val, lat, lng) => {
                setPickup(val);
                if (lat && lng) setPickupCoords({ lat, lng });
              }}
              placeholder={t("rider.searchPickup")}
              iconColor="text-green-400"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("rider.dropoffLocation")}</Label>
            <AddressAutocomplete
              value={dropoff}
              onChange={(val, lat, lng) => {
                setDropoff(val);
                if (lat && lng) setDropoffCoords({ lat, lng });
              }}
              placeholder={t("rider.searchDropoff")}
              iconColor="text-primary"
            />
          </div>

          {showBookingMap && <RideMap markers={mapMarkers} />}

          {estimatedPrice && serviceType === "private_hire" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t("rider.privateHireFlatRate")}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPinned className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {matchedZone ? matchedZone.zone_name : t("rider.standardRoute")}
                </span>
              </div>
              {pickupZoneKey && dropoffZoneKey && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="px-1.5 py-0.5 rounded bg-secondary">{geoZones?.find(g => g.zone_key === pickupZoneKey)?.zone_name || pickupZoneKey}</span>
                  <span>→</span>
                  <span className="px-1.5 py-0.5 rounded bg-secondary">{geoZones?.find(g => g.zone_key === dropoffZoneKey)?.zone_name || dropoffZoneKey}</span>
                  {!matchedZone && <span className="italic ml-1">{t("rider.noZoneMatch")}</span>}
                </div>
              )}
              <p className="text-2xl font-mono font-bold">${estimatedPrice}</p>
            </div>
          )}

          {estimatedPrice && serviceType === "taxi" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                   <span className="text-sm font-semibold">{t("rider.taxiMeterEstimate")}</span>
                </div>
                <span className="text-2xl font-mono font-bold">${estimatedPrice}</span>
              </div>
              {directionsData && (
                <div className="space-y-1 pt-1 border-t border-border/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Car className="h-3.5 w-3.5" />
                    <span>{t("rider.route")}: {directionsData.distance_km.toFixed(1)} km</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{t("rider.eta")}: {directionsData.duration_in_traffic_text}</span>
                  </div>
                  {trafficDelayMin >= 1 && (
                    <div className="flex items-center gap-2 text-sm text-yellow-500">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{t("rider.trafficDelay", { min: Math.round(trafficDelayMin) })}</span>
                    </div>
                  )}
                </div>
              )}
              {directionsFetching && !directionsData && (
                <p className="text-xs text-muted-foreground animate-pulse">{t("rider.checkingTraffic")}</p>
              )}
              <p className="text-[10px] text-muted-foreground">{t("rider.finalFareNote")}</p>
            </div>
          )}

          {estimatedPrice && serviceType === "shuttle" && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-secondary">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">{t("rider.estimatedPrice")}</span>
              <span className="font-mono font-bold">${estimatedPrice}</span>
              <span className="text-xs text-muted-foreground ml-1">
                ({passengerCount} {passengerCount > 1 ? t("rider.seats") : t("rider.seat")})
              </span>
            </div>
          )}

          {/* Payment option selector for taxi */}
          {serviceType === "taxi" && (
            <div className="space-y-2">
              <Label>{t("rider.paymentMethod")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentOption("in_app")}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                    paymentOption === "in_app"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary hover:bg-accent"
                  }`}
                >
                  <CreditCard className={`h-4 w-4 ${paymentOption === "in_app" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-left">
                    <p className="text-xs font-semibold">{t("rider.payInApp")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("rider.cardOnFile")}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentOption("pay_driver")}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                    paymentOption === "pay_driver"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary hover:bg-accent"
                  }`}
                >
                  <Banknote className={`h-4 w-4 ${paymentOption === "pay_driver" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-left">
                    <p className="text-xs font-semibold">{t("rider.payDriver")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("rider.cashTap")}</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Bill to Organization option */}
          {riderOrgMembership && (
            <div className="space-y-2">
              <Label>{t("rider.billing")}</Label>
              {riderOrgMembership.org_status === "suspended" ? (
                <div className="flex items-center gap-3 w-full p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                  <Building2 className="h-5 w-5 text-destructive" />
                  <div className="text-left flex-1">
                    <p className="text-xs font-semibold text-destructive">{riderOrgMembership.org_name} — {t("rider.suspended")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("rider.orgSuspendedMsg")}</p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const newVal = !billToOrg;
                    setBillToOrg(newVal);
                    if (newVal) setPaymentOption("pay_driver");
                  }}
                  className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-all ${
                    billToOrg
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary hover:bg-accent"
                  }`}
                >
                  <Building2 className={`h-5 w-5 ${billToOrg ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-left flex-1">
                    <p className="text-xs font-semibold">{t("rider.billTo", { name: riderOrgMembership.org_name })}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {billToOrg
                        ? t("rider.willBeInvoiced")
                        : t("rider.tapToBill")}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {t("rider.balance")}: ${(riderOrgMembership.current_balance_cents / 100).toFixed(2)} / ${(riderOrgMembership.credit_limit_cents / 100).toFixed(2)} {t("rider.limit")}
                    </p>
                  </div>
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${billToOrg ? "border-primary" : "border-muted-foreground"}`}>
                    {billToOrg && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                </button>
              )}
            </div>
          )}

          {/* PO Number and Cost Center for org billing */}
          {billToOrg && riderOrgMembership && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("rider.poNumber")}</Label>
                <Input
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder={t("rider.optional")}
                  className="bg-secondary text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("rider.costCenter")}</Label>
                <Input
                  value={costCenter}
                  onChange={(e) => setCostCenter(e.target.value)}
                  placeholder={t("rider.optional")}
                  className="bg-secondary text-sm"
                />
              </div>
            </div>
          )}

          {/* Payment confirmation with Stripe Elements */}
          {paymentClientSecret && (
            <PaymentConfirmation
              clientSecret={paymentClientSecret}
              amountCents={authorizedAmountCents}
              onSuccess={handlePaymentSuccess}
              onFailure={async () => {
                if (pendingRideId) {
                  await supabase.from("rides").update({ payment_status: "failed", status: "cancelled" }).eq("id", pendingRideId);
                }
                setPaymentClientSecret(null);
                setPendingRideId(null);
                setAuthorizedAmountCents(0);
                toast.error(t("rider.paymentFailed"));
                refetch();
              }}
              label={t("rider.authorizeRidePayment")}
            />
          )}

          {/* Outstanding balance notice */}
          {outstandingRide && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-2">
              <p className="text-sm text-yellow-500 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> {t("rider.remainingBalance")}
              </p>
              <div className="text-xs font-mono space-y-1 text-muted-foreground">
                <p>{t("rider.totalFare")}: ${((outstandingRide.final_fare_cents || 0) / 100).toFixed(2)}</p>
                <p>{t("rider.paidInApp")}: ${((outstandingRide.captured_amount_cents || 0) / 100).toFixed(2)}</p>
                <p className="text-yellow-500 font-bold text-sm">
                  {t("rider.amountDueDriver")}: ${((outstandingRide.outstanding_amount_cents || 0) / 100).toFixed(2)}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t("rider.payRemainingNote")}
              </p>
            </div>
          )}

          {!paymentClientSecret && (
            <Button onClick={requestRide} disabled={loading || !pickupCoords || !dropoffCoords || (serviceType === "retail_delivery" && !riderOrgMembership)} className="w-full">
              {loading ? t("rider.requesting") : serviceType === "taxi" ? t("rider.requestTaxi") : serviceType === "private_hire" ? t("rider.requestPrivateHire") : serviceType === "courier" ? t("rider.requestCourier") : serviceType === "large_delivery" ? t("rider.requestLargeDelivery") : serviceType === "retail_delivery" ? t("rider.requestRetailDelivery") : serviceType === "personal_shopper" ? t("rider.requestPersonalShopper") : t("rider.requestShuttle")}
            </Button>
          )}
        </motion.div>
      )}

      {/* Ride history */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("rider.recentRides")}</h2>
        <div className="space-y-2">
          {rides?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("rider.noRidesYet")}</p>
          )}
          {rides?.map((ride) => {
            const totalFare = ride.final_fare_cents || Math.round((ride.final_price || 0) * 100) || Math.round((ride.estimated_price || 0) * 100);
            const captured = ride.captured_amount_cents || 0;
            const outstanding = ride.outstanding_amount_cents || 0;
            return (
            <div key={ride.id} className="glass-surface rounded-lg p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {ride.service_type === "private_hire" ? t("rider.privateHireFlatRate") : ride.service_type}
                  </span>
                  <p className="text-sm font-medium">{ride.pickup_address} → {ride.dropoff_address}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(ride.created_at).toLocaleDateString()}
                </p>
                {/* Fare breakdown for completed rides */}
                {ride.status === "completed" && totalFare > 0 && (
                  <div className="text-[10px] font-mono text-muted-foreground space-x-2">
                    <span>{t("rider.total")}: ${(totalFare / 100).toFixed(2)}</span>
                    {captured > 0 && <span>• {t("rider.inApp")}: ${(captured / 100).toFixed(2)}</span>}
                    {outstanding > 0 && <span className="text-yellow-500">• {t("rider.due")}: ${(outstanding / 100).toFixed(2)}</span>}
                  </div>
                )}
                {/* Large delivery receipt breakdown */}
                {ride.status === "completed" && ride.service_type === "large_delivery" && totalFare > 0 && (
                  <div className="mt-1 text-[10px] font-mono text-muted-foreground border-t border-border pt-1 space-y-0.5">
                    <div className="flex justify-between gap-4">
                      <span>{t("rider.bidAmountLabel")}</span>
                      <span>${(totalFare / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>{t("rider.platformFee")}</span>
                      <span>-${((ride.commission_cents || Math.round(totalFare * 0.08)) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>{t("rider.processingFeeLabel")}</span>
                      <span>-${((ride.stripe_fee_cents || Math.round(totalFare * 0.029 + 30)) / 100).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right flex items-center gap-3">
                {ride.status === "completed" && ride.driver_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => {
                      setManualRateRideId(ride.id);
                      setManualRateDriverId(ride.driver_id);
                      setRatingDialogOpen(true);
                    }}
                  >
                    <Star className="h-3.5 w-3.5" /> {t("rider.rate")}
                  </Button>
                )}
                <div>
                <p className={`text-xs font-mono uppercase ${statusColor[ride.status] || ""}`}>
                    {t(`rider.status_${ride.status}`)}
                  </p>
                  {ride.payment_status === "partial" && (
                    <p className="text-[10px] font-mono text-yellow-500">{t("rider.partialPayment")}</p>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Rating dialog */}
      {currentRatingRideId && currentRatingDriverId && profile?.id && (
        <RideRatingDialog
          open={ratingDialogOpen}
          onOpenChange={(open) => {
            setRatingDialogOpen(open);
            if (!open) {
              setManualRateRideId(null);
              setManualRateDriverId(null);
            }
          }}
          rideId={currentRatingRideId}
          driverId={currentRatingDriverId}
          ratedBy={profile.id}
          driverName={ratingDriverName || undefined}
          onRated={() => {
            refetchUnrated();
            setManualRateRideId(null);
            setManualRateDriverId(null);
          }}
        />
      )}
    </div>
  );
};

export default RiderDashboard;
