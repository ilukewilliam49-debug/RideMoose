import { useEffect, useState, useRef } from "react";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import TripCompleteSheet from "@/components/rider/TripCompleteSheet";
import RideConfirmSheet from "@/components/rider/RideConfirmSheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, AlertTriangle, CreditCard, Building2,
  Package, ShoppingBag, MapPinned, MapPin, LocateFixed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import PaymentConfirmation from "@/components/PaymentConfirmation";
import { useTranslation } from "react-i18next";
import { useRideBooking } from "@/contexts/RideBookingContext";
import SavedPlaceChips from "@/components/rider/SavedPlaceChips";
import RideRatingDialog from "@/components/RideRatingDialog";
import CancelRideDialog from "@/components/rider/CancelRideDialog";
import ActiveRideMap from "@/components/rider/ActiveRideMap";
import ActiveRideCard from "@/components/rider/ActiveRideCard";
import RideHistory from "@/components/rider/RideHistory";

import ServiceSelector from "@/components/rider/ServiceSelector";
import PassengerCountPicker from "@/components/rider/PassengerCountPicker";
import RouteStopsEditor from "@/components/rider/RouteStopsEditor";
import { useRideBookingState } from "@/hooks/useRideBookingState";
import DriverMatchingOverlay from "@/components/rider/DriverMatchingOverlay";
import { useRideQueries } from "@/hooks/useRideQueries";
import { useNearestDriverETAs } from "@/hooks/useNearestDriverETAs";

const STATUS_COLORS: Record<string, string> = {
  requested: "text-yellow-400",
  dispatched: "text-blue-400",
  accepted: "text-cyan-400",
  in_progress: "text-primary",
  completed: "text-green-400",
  cancelled: "text-muted-foreground",
};

const RiderDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const state = useRideBookingState();
  const rideBooking = useRideBooking();
  const [matchingInProgress, setMatchingInProgress] = useState(false);
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [tripCompleteRide, setTripCompleteRide] = useState<any>(null);
  const prevActiveStatusRef = useRef<string | null>(null);
  const matchingRideIdRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);
  const queries = useRideQueries({
    profileId: profile?.id,
    userId: profile?.user_id,
    serviceType: state.serviceType,
    pickupCoords: state.pickupCoords,
    dropoffCoords: state.dropoffCoords,
    pickup: state.pickup,
    dropoff: state.dropoff,
    distanceKm: state.distanceKm,
    passengerCount: state.passengerCount,
    estimatedItemCostCents: state.estimatedItemCostCents,
    stops: state.stops,
  });

  const driverETAs = useNearestDriverETAs(state.userLocation);

  // Detect ride completion → auto-show trip summary
  useEffect(() => {
    const currentStatus = queries.activeRide?.status || null;
    const prevStatus = prevActiveStatusRef.current;
    if (prevStatus && (prevStatus === "in_progress" || prevStatus === "accepted") && !currentStatus) {
      // Ride just completed or disappeared — fetch last completed ride
      (async () => {
        if (!profile?.id) return;
        const { data } = await supabase
          .from("rides")
          .select("*")
          .eq("rider_id", profile.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setTripCompleteRide(data);
      })();
    }
    prevActiveStatusRef.current = currentStatus;
  }, [queries.activeRide?.status, profile?.id]);

  // Auto-open rating dialog when unrated ride found (only if not previously dismissed)
  useEffect(() => {
    if (queries.unratedRide && !state.manualRateRideId) {
      const dismissedKey = `rating_dismissed_${queries.unratedRide.id}`;
      if (!sessionStorage.getItem(dismissedKey)) {
        state.setRatingDialogOpen(true);
      }
    }
  }, [queries.unratedRide, state.manualRateRideId]);

  const currentRatingRideId = state.manualRateRideId || queries.unratedRide?.id;
  const currentRatingDriverId = state.manualRateDriverId || queries.unratedRide?.driver_id;

  const useMyLocation = async () => {
    state.setLocatingUser(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      state.setUserLocation({ lat: latitude, lng: longitude });
      state.setPickupCoords({ lat: latitude, lng: longitude });
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
      const geo = await res.json();
      state.setPickup(geo.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      toast.success(t("rider.locationFound", "Location found"));
    } catch {
      toast.error(t("rider.locationError", "Could not get your location"));
    } finally {
      state.setLocatingUser(false);
    }
  };

  const requestRide = async () => {
    if (submittingRef.current) return;
    // Debounce: prevent rapid duplicate submissions within 3 seconds
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < 3000) return;
    lastSubmitTimeRef.current = now;
    if (!profile?.id || !state.pickup || !state.dropoff || !state.pickupCoords || !state.dropoffCoords) {
      toast.error(t("rider.pickAddressError", "Please select valid pickup and drop-off addresses from the suggestions"));
      return;
    }
    // Block submission if any added stop is incomplete
    const incompleteStop = (state.stops ?? []).find((s) => !s.address || !s.lat || !s.lng);
    if (incompleteStop) {
      toast.error(t("rider.completeAllStops", "Please complete or remove empty stops"));
      return;
    }
    // Block if there's already an active ride (DB trigger would throw a
    // cryptic error otherwise).
    if (queries.activeRide) {
      toast.error(t("rider.alreadyHasActiveRide", "You already have an active ride"));
      return;
    }
    // Block submission until fare estimate is ready (prevents $0 payment auth)
    if (!queries.estimatedPrice || parseFloat(queries.estimatedPrice) <= 0) {
      toast.error(t("rider.fareNotReady", "Fare estimate is still calculating — please wait a moment"));
      return;
    }
    // Personal-shopper requires an item cost
    if (state.serviceType === "personal_shopper" && (!state.estimatedItemCostCents || Number(state.estimatedItemCostCents) <= 0)) {
      toast.error(t("rider.itemCostRequired", "Please enter an estimated item cost"));
      return;
    }
    if (state.serviceType === "retail_delivery" && !queries.riderOrgMembership) {
      toast.error(t("rider.businessAccountRequired"));
      return;
    }

    // Source of truth: context (filled by RiderSelector / PickupTimeSelector)
    // with URL params as a fallback for deep links from DashboardHome.
    const scheduledAtSource = rideBooking.scheduledAt ?? (state.searchParams.get("scheduledAt") ? new Date(state.searchParams.get("scheduledAt")!) : null);
    // Reject scheduled times that have drifted into the past (user picked
    // "in 15 min" then idled).
    let scheduledAtFinal: string | null = null;
    if (scheduledAtSource) {
      if (scheduledAtSource.getTime() <= Date.now() - 30_000) {
        toast.error(t("rider.scheduledInPast", "Scheduled pickup time is in the past — choose a new time"));
        return;
      }
      scheduledAtFinal = scheduledAtSource.toISOString();
    }
    const bookingForFinal: "self" | "guest" =
      rideBooking.bookingFor === "guest" || state.searchParams.get("bookingFor") === "guest" ? "guest" : "self";
    const guestNameFinal = bookingForFinal === "guest"
      ? (rideBooking.guestName || state.searchParams.get("guestName") || "").trim() || null
      : null;
    const guestPhoneFinal = bookingForFinal === "guest"
      ? (rideBooking.guestPhone || state.searchParams.get("guestPhone") || "").trim() || null
      : null;
    if (bookingForFinal === "guest" && (!guestNameFinal || !guestPhoneFinal)) {
      toast.error(t("rider.guestInfoMissing", "Please add the rider's name and phone number"));
      return;
    }

    submittingRef.current = true;
    state.setLoading(true);
    try {
      const estCents = Math.round(parseFloat(queries.estimatedPrice || "0") * 100);
      const isOrgBilling = (state.billToOrg && queries.riderOrgMembership) || (state.serviceType === "retail_delivery" && queries.riderOrgMembership);

      if (isOrgBilling && queries.riderOrgMembership) {
        if (queries.riderOrgMembership.org_status === "suspended") {
          toast.error(t("rider.orgSuspendedError"));
          state.setLoading(false);
          return;
        }
        const projectedBalance = queries.riderOrgMembership.current_balance_cents + estCents;
        if (projectedBalance > queries.riderOrgMembership.credit_limit_cents) {
          toast.error(t("rider.creditLimitError", { limit: (queries.riderOrgMembership.credit_limit_cents / 100).toFixed(2), balance: (queries.riderOrgMembership.current_balance_cents / 100).toFixed(2) }));
          state.setLoading(false);
          return;
        }
      }

      const validStops = (state.stops ?? []).filter((s) => s.address && s.lat && s.lng);
      const { data: rideData, error } = await supabase.from("rides").insert({
        rider_id: profile.id,
        pickup_address: state.pickup,
        dropoff_address: state.dropoff,
        pickup_lat: state.pickupCoords.lat,
        pickup_lng: state.pickupCoords.lng,
        dropoff_lat: state.dropoffCoords.lat,
        dropoff_lng: state.dropoffCoords.lng,
        stops: validStops as any,
        estimated_price: parseFloat(queries.estimatedPrice || "0"),
        distance_km: state.distanceKm ? parseFloat(state.distanceKm.toFixed(2)) : null,
        service_type: state.serviceType,
        passenger_count: state.passengerCount,
        pricing_model: state.serviceType === "courier" ? "courier" : state.serviceType === "large_delivery" ? "large_delivery" : state.serviceType === "retail_delivery" ? "retail_delivery" : state.serviceType === "personal_shopper" ? "personal_shopper" : "metered",
        status: "requested",
        payment_option: "in_app",
        billed_to: isOrgBilling ? "organization" : "individual",
        organization_id: isOrgBilling ? queries.riderOrgMembership!.organization_id : null,
        payment_status: isOrgBilling ? "invoiced_pending" : "unpaid",
        po_number: isOrgBilling && state.poNumber ? state.poNumber : null,
        cost_center: isOrgBilling && state.costCenter ? state.costCenter : null,
        scheduled_at: scheduledAtFinal,
        booking_for: bookingForFinal,
        guest_name: bookingForFinal === "guest" ? guestNameFinal : null,
        guest_phone: bookingForFinal === "guest" ? guestPhoneFinal : null,
        ...(state.serviceType === "courier" ? {
          package_size: state.packageSize, pickup_notes: state.pickupNotes || null,
          dropoff_notes: state.dropoffNotes || null, proof_photo_required: true,
          item_description: state.itemDescription || null, marketplace_delivery: state.marketplaceDelivery,
        } : {}),
        ...(state.serviceType === "large_delivery" ? {
          item_description: state.itemDescription || null, requires_loading_help: state.requiresLoadingHelp,
          stairs_involved: state.stairsInvolved, weight_estimate_kg: state.weightEstimateKg || null,
          pickup_notes: state.pickupNotes || null, dropoff_notes: state.dropoffNotes || null, proof_photo_required: true,
        } : {}),
        ...(state.serviceType === "retail_delivery" ? {
          store_id: state.storeId || null, order_value_cents: state.orderValueCents || null,
          package_size: state.packageSize, signature_required: state.signatureRequired,
          pickup_notes: state.pickupNotes || null, dropoff_notes: state.dropoffNotes || null, proof_photo_required: true,
        } : {}),
        ...(state.serviceType === "personal_shopper" ? {
          store_name: state.storeName || null, item_description: state.itemDescription || null,
          quantity: state.quantity || 1, estimated_item_cost_cents: state.estimatedItemCostCents || null,
          delivery_fee_cents: Math.max(1200, 1200 + Math.round((queries.directionsData?.distance_km ?? state.distanceKm ?? 0) * 150)),
          shopper_fee_cents: state.estimatedItemCostCents ? Math.round(Number(state.estimatedItemCostCents) * 0.10) : 0,
          dropoff_notes: state.dropoffNotes || null, proof_photo_required: true, payment_option: "in_app",
        } : {}),
      } as any).select("id").single();
      if (error) throw error;

      // Payment authorization for specific service types
      // CRITICAL: private_hire MUST be included — capture-payment requires a
      // PaymentIntent or it throws "No payment intent for this ride".
      const needsAuth = (state.serviceType === "personal_shopper" ||
        (!isOrgBilling && (state.serviceType === "taxi" || state.serviceType === "private_hire")));
      if (needsAuth && rideData) {
        let authCents = estCents;
        if (state.serviceType === "personal_shopper") {
          const deliveryCents = Math.max(1200, 1200 + Math.round((queries.directionsData?.distance_km ?? state.distanceKm ?? 0) * 150));
          const shopperCents = state.estimatedItemCostCents ? Math.round(Number(state.estimatedItemCostCents) * 0.10) : 0;
          authCents = Math.round((Number(state.estimatedItemCostCents || 0) + deliveryCents + shopperCents) * 1.15);
        }
        const { data: piData, error: piError } = await supabase.functions.invoke("create-payment-intent", {
          body: {
            ride_id: rideData.id,
            estimated_fare_cents: authCents,
            service_type: state.serviceType, // server adds surcharge+GST for private_hire
          },
        });
        if (piError) {
          await supabase.from("rides").update({ payment_status: "failed", status: "cancelled" }).eq("id", rideData.id);
          throw new Error(piError.message || "Payment authorization failed");
        }
        state.setPaymentClientSecret(piData.clientSecret);
        state.setAuthorizedAmountCents(piData.authorized_amount_cents);
        state.setPendingRideId(rideData.id);
        setConfirmSheetOpen(false);
        state.setLoading(false);
        return;
      }

      // Trigger automated driver matching
      if (rideData) {
        setConfirmSheetOpen(false);
        setMatchingInProgress(true);
        matchingRideIdRef.current = rideData.id;
        supabase.functions.invoke("match-driver", { body: { ride_id: rideData.id } })
          .then(({ data: matchData }) => {
            if (!matchingRideIdRef.current) return; // cancelled
            if (matchData?.matched) {
              toast.success(t("rider.driverFound", "Driver found! {{name}} is {{eta}} away", {
                name: matchData.driver_name,
                eta: matchData.eta_text,
              }));
            } else {
              toast.info(t("rider.noDriverYet", "No driver matched yet — your ride is visible to all nearby drivers."));
            }
            queries.refetch();
          })
          .catch(() => {
            queries.refetch();
          })
          .finally(() => {
            matchingRideIdRef.current = null;
            setMatchingInProgress(false);
          });
      } else {
        setConfirmSheetOpen(false);
        toast.success(state.billToOrg ? t("rider.rideRequestedOrg") : t("rider.rideRequested"));
      }
      state.resetBookingForm();
      queries.refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      state.setLoading(false);
      submittingRef.current = false;
    }
  };

  const handlePaymentSuccess = () => {
    state.setPaymentClientSecret(null);
    state.setPendingRideId(null);
    state.setAuthorizedAmountCents(0);
    toast.success(t("rider.paymentAuthorized"));
    state.resetBookingForm();
    queries.refetch();
  };

  // Build markers
  const mapMarkers: MapMarker[] = [
    ...(state.pickupCoords ? [{ lat: state.pickupCoords.lat, lng: state.pickupCoords.lng, type: "pickup" as const, label: t("rider.pickup") }] : []),
    ...state.stops
      .filter((s) => s.lat !== 0 && s.lng !== 0)
      .map((s, i) => ({ lat: s.lat, lng: s.lng, type: "stop" as const, label: s.address, index: i + 1 })),
    ...(state.dropoffCoords ? [{ lat: state.dropoffCoords.lat, lng: state.dropoffCoords.lng, type: "dropoff" as const, label: t("rider.dropoff") }] : []),
  ];

  const activeMarkers: MapMarker[] = queries.activeRide
    ? [
        ...(queries.activeRide.pickup_lat && queries.activeRide.pickup_lng ? [{ lat: queries.activeRide.pickup_lat, lng: queries.activeRide.pickup_lng, type: "pickup" as const, label: t("rider.pickup") }] : []),
        ...(queries.activeRide.dropoff_lat && queries.activeRide.dropoff_lng ? [{ lat: queries.activeRide.dropoff_lat, lng: queries.activeRide.dropoff_lng, type: "dropoff" as const, label: t("rider.dropoff") }] : []),
        ...(queries.driverProfile?.latitude && queries.driverProfile?.longitude ? [{ lat: queries.driverProfile.latitude, lng: queries.driverProfile.longitude, type: "driver" as const, label: queries.driverProfile.full_name || t("rider.driver") }] : []),
      ]
    : [];

  const showActiveMap = queries.activeRide && activeMarkers.length > 0;
  const showBookingMap = !queries.activeRide && mapMarkers.length > 0;
  const routePolyline = queries.directionsData?.polyline ?? null;
  const routeInfo = queries.directionsData
    ? { distanceKm: queries.directionsData.distance_km, durationText: queries.directionsData.duration_text }
    : null;

  return (
    <div className="space-y-6 pt-4">
      <InstallAppPrompt />
      <DriverMatchingOverlay
        visible={matchingInProgress}
        onCancel={async () => {
          const rideId = matchingRideIdRef.current;
          matchingRideIdRef.current = null;
          setMatchingInProgress(false);
          if (rideId) {
            await supabase.from("rides").update({ status: "cancelled", cancellation_reason: "Rider cancelled during matching" }).eq("id", rideId);
            toast.info(t("rider.searchCancelled", "Driver search cancelled"));
            queries.refetch();
          }
        }}
      />
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rider")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {queries.activeRide
              ? t("rider.rideInProgress")
              : state.mode === "delivery"
                ? t("rider.requestDelivery")
                : state.serviceType === "private_hire"
                  ? t("rider.requestPrivateHire")
                  : t("rider.requestARide")}
          </h1>
        </div>
        {state.searchParams.get("scheduledAt") && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">
              Scheduled: {format(new Date(state.searchParams.get("scheduledAt")!), "MMM d, h:mm a")}
            </span>
          </div>
        )}
      </div>




      {/* Active ride map */}
      {showActiveMap && !state.paymentClientSecret && (
        <ActiveRideMap
          markers={activeMarkers}
          polyline={queries.activeRoutePolyline}
          liveEta={queries.liveEta}
          activeRideDirections={queries.activeRideDirections}
          activeTrafficDelayMin={queries.activeTrafficDelayMin}
          activeRideStatus={queries.activeRide?.status}
        />
      )}

      {/* Active ride card */}
      {queries.activeRide && !state.paymentClientSecret && (
        <ActiveRideCard
          activeRide={queries.activeRide}
          driverName={queries.driverProfile?.full_name}
          driverProfile={queries.driverProfile}
          statusColor={STATUS_COLORS}
          onCancelClick={() => state.setCancelDialogOpen(true)}
        />
      )}

      {/* Booking form */}
      {!queries.activeRide && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-surface rounded-lg p-6 space-y-4 overflow-visible">
          {/* Map */}
          {showBookingMap ? (
            <RideMap markers={mapMarkers} polyline={routePolyline} routeInfo={routeInfo} />
          ) : state.userLocation ? (
            <RideMap markers={[{ lat: state.userLocation.lat, lng: state.userLocation.lng, type: "pickup" as const, label: t("rider.you", "You") }]} polyline={null} />
          ) : (
            <div className="h-48 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground text-sm">
              <MapPin className="h-5 w-5 mr-2" />
              {t("rider.enterAddressToSeeMap", "Enter addresses to see the map")}
            </div>
          )}

          {/* Courier fields moved to dedicated /rider/courier page */}

          {/* Pickup & Dropoff – hidden; values come from URL params set on the home screen */}

          {/* Trip summary – pickup, stops, dropoff at a glance */}
          {(state.pickup || state.dropoff) && (
            <div className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("rider.tripSummary", "Your trip")}
              </p>
              <div className="relative space-y-2.5">
                {/* Vertical connector line */}
                <div
                  aria-hidden
                  className="absolute left-[11px] top-5 bottom-5 w-px bg-border"
                />

                {/* Pickup */}
                {state.pickup && (
                  <div className="relative flex items-start gap-3">
                    <span className="relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-success ring-2 ring-background">
                      <MapPin className="h-3 w-3 text-success-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("rider.pickup", "Pickup")}
                      </p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {state.pickup}
                      </p>
                    </div>
                  </div>
                )}

                {/* Stops */}
                {state.stops.map((stop, idx) => (
                  <div key={idx} className="relative flex items-start gap-3">
                    <span className="relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("rider.stopN", "Stop {{n}}", { n: idx + 1 })}
                      </p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {stop.address || t("rider.stopUnnamed", "Unnamed stop")}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Dropoff */}
                {state.dropoff && (
                  <div className="relative flex items-start gap-3">
                    <span className="relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary ring-2 ring-background">
                      <MapPin className="h-3 w-3 text-primary-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("rider.dropoff", "Dropoff")}
                      </p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {state.dropoff}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intermediate stops – riders can add up to 3 stops between pickup and dropoff.
              Always rendered when at least pickup is set so riders can build multi-stop trips. */}
          {state.pickup && (
            <div className="rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("rider.stopsTitle", "Stops along the way")}
                </p>
                {state.stops.length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {state.stops.length}/3
                  </span>
                )}
              </div>
              <RouteStopsEditor stops={state.stops} onChange={state.setStops} />
            </div>
          )}

          {/* Route info */}
          {queries.directionsData && state.pickupCoords && state.dropoffCoords && (
            <div className="glass-surface rounded-lg p-3 mt-2 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPinned className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{queries.directionsData.distance_km.toFixed(1)} km</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{queries.directionsData.duration_in_traffic_text || queries.directionsData.duration_text}</span>
              </div>
              {queries.trafficDelayMin > 2 && (
                <div className="flex items-center gap-1.5 text-amber-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-medium">+{Math.round(queries.trafficDelayMin)} min traffic</span>
                </div>
              )}
            </div>
          )}

          {/* Passenger count selection */}
          <PassengerCountPicker
            value={state.passengerCount}
            onChange={state.setPassengerCount}
          />

          {/* Service selection cards with prices */}
          <ServiceSelector
            selected={state.serviceType}
            onSelect={state.setServiceType}
            prices={queries.allServicePrices}
            etaText={queries.directionsData?.duration_in_traffic_text || null}
            driverETAs={driverETAs}
          />

          {/* All rides are paid in-app via card on file */}

          {/* Bill to Organization option */}
          {queries.riderOrgMembership && (
            <div className="space-y-2">
              <Label>{t("rider.billing")}</Label>
              {queries.riderOrgMembership.org_status === "suspended" ? (
                <div className="flex items-center gap-3 w-full p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                  <Building2 className="h-5 w-5 text-destructive" />
                  <div className="text-left flex-1">
                    <p className="text-xs font-semibold text-destructive">{queries.riderOrgMembership.org_name} — {t("rider.suspended")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("rider.orgSuspendedMsg")}</p>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => state.setBillToOrg(!state.billToOrg)}
                  className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-all ${state.billToOrg ? "border-primary bg-primary/10" : "border-border bg-secondary hover:bg-accent"}`}>
                  <Building2 className={`h-5 w-5 ${state.billToOrg ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-left flex-1">
                    <p className="text-xs font-semibold">{t("rider.billTo", { name: queries.riderOrgMembership.org_name })}</p>
                    <p className="text-[10px] text-muted-foreground">{state.billToOrg ? t("rider.willBeInvoiced") : t("rider.tapToBill")}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {t("rider.balance")}: ${(queries.riderOrgMembership.current_balance_cents / 100).toFixed(2)} / ${(queries.riderOrgMembership.credit_limit_cents / 100).toFixed(2)} {t("rider.limit")}
                    </p>
                  </div>
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${state.billToOrg ? "border-primary" : "border-muted-foreground"}`}>
                    {state.billToOrg && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                </button>
              )}
            </div>
          )}

          {/* PO Number and Cost Center */}
          {state.billToOrg && queries.riderOrgMembership && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t("rider.poNumber")}</Label>
                <Input value={state.poNumber} onChange={(e) => state.setPoNumber(e.target.value)} placeholder={t("rider.optional")} className="bg-secondary text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("rider.costCenter")}</Label>
                <Input value={state.costCenter} onChange={(e) => state.setCostCenter(e.target.value)} placeholder={t("rider.optional")} className="bg-secondary text-sm" />
              </div>
            </div>
          )}

          {/* Payment confirmation moved outside active ride check below */}

          {/* Outstanding balance */}
          {queries.outstandingRide && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-2">
              <p className="text-sm text-yellow-500 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> {t("rider.remainingBalance")}
              </p>
              <div className="text-xs font-mono space-y-1 text-muted-foreground">
                <p>{t("rider.totalFare")}: ${((queries.outstandingRide.final_fare_cents || 0) / 100).toFixed(2)}</p>
                <p>{t("rider.paidInApp")}: ${((queries.outstandingRide.captured_amount_cents || 0) / 100).toFixed(2)}</p>
                <p className="text-yellow-500 font-bold text-sm">{t("rider.amountDueDriver")}: ${((queries.outstandingRide.outstanding_amount_cents || 0) / 100).toFixed(2)}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10"
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke("create-payment-intent", {
                      body: {
                        ride_id: queries.outstandingRide!.id,
                        estimated_fare_cents: queries.outstandingRide!.outstanding_amount_cents || 0,
                        is_overage: true,
                      },
                    });
                    if (error) throw new Error(error.message);
                    if (data?.clientSecret) {
                      state.setPaymentClientSecret(data.clientSecret);
                      state.setAuthorizedAmountCents(queries.outstandingRide!.outstanding_amount_cents || 0);
                      state.setPendingRideId(queries.outstandingRide!.id);
                    }
                  } catch (err: any) {
                    toast.error(err.message || "Could not initiate payment");
                  }
                }}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {t("rider.payNow", "Pay Now")} — ${((queries.outstandingRide.outstanding_amount_cents || 0) / 100).toFixed(2)}
              </Button>
              <p className="text-[10px] text-muted-foreground">{t("rider.payRemainingNote")}</p>
            </div>
          )}

          {!state.paymentClientSecret && (
            <Button onClick={() => setConfirmSheetOpen(true)} disabled={state.loading || !state.pickupCoords || !state.dropoffCoords} className="w-full">
              {state.loading ? t("rider.requesting") : state.serviceType === "taxi" ? t("rider.requestTaxi") : state.serviceType === "private_hire" ? t("rider.requestPrivateHire") : t("rider.requestCourier")}
            </Button>
          )}
        </motion.div>
      )}

      {/* Payment confirmation – rendered outside active ride check so it persists */}
      <AnimatePresence>
        {state.paymentClientSecret && (
          <motion.div
            key="payment-confirm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="glass-surface rounded-lg p-6"
          >
            <PaymentConfirmation
              clientSecret={state.paymentClientSecret}
              amountCents={state.authorizedAmountCents}
              onSuccess={handlePaymentSuccess}
              onSavedCardSuccess={handlePaymentSuccess}
              onFailure={async () => {
                if (state.pendingRideId) {
                  await supabase.from("rides").update({ payment_status: "failed", status: "cancelled" }).eq("id", state.pendingRideId);
                }
                state.setPaymentClientSecret(null);
                state.setPendingRideId(null);
                state.setAuthorizedAmountCents(0);
                toast.error(t("rider.paymentFailed"));
                queries.refetch();
              }}
              label={t("rider.authorizeRidePayment")}
              rideId={state.pendingRideId || undefined}
              serviceType={state.serviceType}
              estimatedFareCents={Math.round(parseFloat(queries.estimatedPrice || "0") * 100)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ride history */}
      <RideHistory
        rides={queries.rides}
        statusColor={STATUS_COLORS}
        onRate={(rideId, driverId) => {
          state.setManualRateRideId(rideId);
          state.setManualRateDriverId(driverId);
          state.setRatingDialogOpen(true);
        }}
        onRefresh={() => queries.refetch()}
      />

      {/* Rating dialog */}
      {currentRatingRideId && currentRatingDriverId && profile?.id && (
        <RideRatingDialog
          open={state.ratingDialogOpen}
          onOpenChange={(open) => {
            state.setRatingDialogOpen(open);
            if (!open) {
              // Persist dismissal so dialog doesn't reappear on reload
              if (currentRatingRideId && !state.manualRateRideId) {
                sessionStorage.setItem(`rating_dismissed_${currentRatingRideId}`, "1");
              }
              state.setManualRateRideId(null);
              state.setManualRateDriverId(null);
            }
          }}
          rideId={currentRatingRideId}
          driverId={currentRatingDriverId}
          ratedBy={profile.id}
          driverName={queries.ratingDriverName || undefined}
          onRated={() => { queries.refetchUnrated(); state.setManualRateRideId(null); state.setManualRateDriverId(null); }}
        />
      )}

      {/* Cancel ride dialog */}
      {queries.activeRide && (
        <CancelRideDialog
          open={state.cancelDialogOpen}
          onOpenChange={state.setCancelDialogOpen}
          rideId={queries.activeRide.id}
          rideStatus={queries.activeRide.status}
          driverAccepted={queries.activeRide.status === "accepted" || queries.activeRide.status === "in_progress"}
          onCancelled={() => {
            queries.queryClient.invalidateQueries({ queryKey: ["rider-active-ride"] });
            queries.queryClient.invalidateQueries({ queryKey: ["my-rides"] });
          }}
        />
      )}

      {/* Ride confirmation sheet */}
      <RideConfirmSheet
        open={confirmSheetOpen}
        onOpenChange={setConfirmSheetOpen}
        onConfirm={() => {
          requestRide();
        }}
        pickup={state.pickup}
        dropoff={state.dropoff}
        serviceType={state.serviceType}
        estimatedPrice={queries.estimatedPrice}
        paymentOption={state.paymentOption}
        scheduledAt={state.searchParams.get("scheduledAt")}
        loading={state.loading}
      />

      {/* Trip complete auto-display */}
      {tripCompleteRide && (
        <TripCompleteSheet
          ride={tripCompleteRide}
          open={!!tripCompleteRide}
          onOpenChange={(open) => { if (!open) setTripCompleteRide(null); }}
          onRate={() => {
            state.setManualRateRideId(tripCompleteRide.id);
            state.setManualRateDriverId(tripCompleteRide.driver_id);
            state.setRatingDialogOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default RiderDashboard;
