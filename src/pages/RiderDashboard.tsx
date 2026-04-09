import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, AlertTriangle, CreditCard, Banknote, Building2,
  Package, ShoppingBag, MapPinned, MapPin, LocateFixed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import PaymentConfirmation from "@/components/PaymentConfirmation";
import { useTranslation } from "react-i18next";
import SavedPlaceChips from "@/components/rider/SavedPlaceChips";
import RideRatingDialog from "@/components/RideRatingDialog";
import CancelRideDialog from "@/components/rider/CancelRideDialog";
import ActiveRideMap from "@/components/rider/ActiveRideMap";
import ActiveRideCard from "@/components/rider/ActiveRideCard";
import RideHistory from "@/components/rider/RideHistory";
import ServiceSelector from "@/components/rider/ServiceSelector";
import { useRideBookingState } from "@/hooks/useRideBookingState";
import { useRideQueries } from "@/hooks/useRideQueries";

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
    petMode: state.petMode,
  });

  // Auto-open rating dialog when unrated ride found
  useEffect(() => {
    if (queries.unratedRide && !state.manualRateRideId) {
      state.setRatingDialogOpen(true);
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
    if (!profile?.id || !state.pickup || !state.dropoff || !state.pickupCoords || !state.dropoffCoords) return;
    if (state.serviceType === "retail_delivery" && !queries.riderOrgMembership) {
      toast.error(t("rider.businessAccountRequired"));
      return;
    }
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

      const scheduledAtParam = state.searchParams.get("scheduledAt");
      const { data: rideData, error } = await supabase.from("rides").insert({
        rider_id: profile.id,
        pickup_address: state.pickup,
        dropoff_address: state.dropoff,
        pickup_lat: state.pickupCoords.lat,
        pickup_lng: state.pickupCoords.lng,
        dropoff_lat: state.dropoffCoords.lat,
        dropoff_lng: state.dropoffCoords.lng,
        estimated_price: parseFloat(queries.estimatedPrice || "0"),
        distance_km: state.distanceKm ? parseFloat(state.distanceKm.toFixed(2)) : null,
        service_type: state.serviceType,
        passenger_count: state.passengerCount,
        pricing_model: state.serviceType === "private_hire" ? "flat_zone" : state.serviceType === "courier" ? "courier" : state.serviceType === "large_delivery" ? "large_delivery" : state.serviceType === "retail_delivery" ? "retail_delivery" : state.serviceType === "personal_shopper" ? "personal_shopper" : "metered",
        status: "requested",
        payment_option: isOrgBilling ? "pay_driver" : state.paymentOption,
        billed_to: isOrgBilling ? "organization" : "individual",
        organization_id: isOrgBilling ? queries.riderOrgMembership!.organization_id : null,
        payment_status: isOrgBilling ? "invoiced_pending" : "unpaid",
        po_number: isOrgBilling && state.poNumber ? state.poNumber : null,
        cost_center: isOrgBilling && state.costCenter ? state.costCenter : null,
        scheduled_at: scheduledAtParam || null,
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
        ...(state.serviceType === "pet_transport" ? {
          pet_mode: state.petMode, pet_type: state.petType, pet_weight_estimate: state.petWeightEstimate || null,
          crate_confirmed: state.crateConfirmed, destination_type: state.destinationType,
          emergency_contact_phone: state.emergencyContactPhone, payment_option: "in_app",
        } : {}),
      } as any).select("id").single();
      if (error) throw error;

      // Payment authorization for specific service types
      const needsAuth = (state.serviceType === "personal_shopper" || state.serviceType === "pet_transport" ||
        (!isOrgBilling && state.paymentOption === "in_app" && state.serviceType === "taxi"));
      if (needsAuth && rideData) {
        let authCents = estCents;
        if (state.serviceType === "personal_shopper") {
          const deliveryCents = Math.max(1200, 1200 + Math.round((queries.directionsData?.distance_km ?? state.distanceKm ?? 0) * 150));
          const shopperCents = state.estimatedItemCostCents ? Math.round(Number(state.estimatedItemCostCents) * 0.10) : 0;
          authCents = Math.round((Number(state.estimatedItemCostCents || 0) + deliveryCents + shopperCents) * 1.15);
        }
        const { data: piData, error: piError } = await supabase.functions.invoke("create-payment-intent", { body: { ride_id: rideData.id, estimated_fare_cents: authCents } });
        if (piError) {
          await supabase.from("rides").update({ payment_status: "failed", status: "cancelled" }).eq("id", rideData.id);
          throw new Error(piError.message || "Payment authorization failed");
        }
        state.setPaymentClientSecret(piData.clientSecret);
        state.setAuthorizedAmountCents(piData.authorized_amount_cents);
        state.setPendingRideId(rideData.id);
        state.setLoading(false);
        return;
      }

      toast.success(state.billToOrg ? t("rider.rideRequestedOrg") : t("rider.rideRequested"));
      state.resetBookingForm();
      queries.refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      state.setLoading(false);
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
      {showActiveMap && (
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
      {queries.activeRide && (
        <ActiveRideCard
          activeRide={queries.activeRide}
          driverName={queries.driverProfile?.full_name}
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

          {/* Courier fields */}
          {state.serviceType === "courier" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" />{t("rider.packageSize")}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <button key={size} type="button" onClick={() => state.setPackageSize(size)}
                      className={`p-2 rounded-lg border text-xs font-medium capitalize transition-all ${state.packageSize === size ? "border-primary bg-primary/10" : "border-border bg-secondary hover:bg-accent"}`}>
                      {t(`rider.package_${size}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("rider.itemDescription")}</Label>
                <Input value={state.itemDescription} onChange={(e) => state.setItemDescription(e.target.value)} placeholder={t("rider.describeItem")} className="bg-secondary" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t("rider.marketplaceDelivery")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("rider.marketplaceDeliveryDesc")}</p>
                  </div>
                </div>
                <Switch checked={state.marketplaceDelivery} onCheckedChange={state.setMarketplaceDelivery} />
              </div>
              {state.marketplaceDelivery && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-yellow-500">{t("rider.ensureCapacity")}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t("rider.pickupNotes")}</Label>
                <Input value={state.pickupNotes} onChange={(e) => state.setPickupNotes(e.target.value)} placeholder={t("rider.pickupNotesPlaceholder")} className="bg-secondary" />
              </div>
              <div className="space-y-2">
                <Label>{t("rider.dropoffNotes")}</Label>
                <Input value={state.dropoffNotes} onChange={(e) => state.setDropoffNotes(e.target.value)} placeholder={t("rider.dropoffNotesPlaceholder")} className="bg-secondary" />
              </div>
            </div>
          )}

          {/* Pickup & Dropoff – hidden; values come from URL params set on the home screen */}

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

          {/* Service selection cards with prices */}
          <ServiceSelector
            selected={state.serviceType}
            onSelect={state.setServiceType}
            prices={queries.allServicePrices}
            etaText={queries.directionsData?.duration_in_traffic_text || null}
          />

          {/* Payment option selector for taxi */}
          {state.serviceType === "taxi" && (
            <div className="space-y-2">
              <Label>{t("rider.paymentMethod")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => state.setPaymentOption("in_app")}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${state.paymentOption === "in_app" ? "border-primary bg-primary/10" : "border-border bg-secondary hover:bg-accent"}`}>
                  <CreditCard className={`h-4 w-4 ${state.paymentOption === "in_app" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-left">
                    <p className="text-xs font-semibold">{t("rider.payInApp")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("rider.cardOnFile")}</p>
                  </div>
                </button>
                <button type="button" onClick={() => state.setPaymentOption("pay_driver")}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${state.paymentOption === "pay_driver" ? "border-primary bg-primary/10" : "border-border bg-secondary hover:bg-accent"}`}>
                  <Banknote className={`h-4 w-4 ${state.paymentOption === "pay_driver" ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="text-left">
                    <p className="text-xs font-semibold">{t("rider.payDriver")}</p>
                    <p className="text-[10px] text-muted-foreground">{t("rider.cashTap")}</p>
                  </div>
                </button>
              </div>
            </div>
          )}

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
                <button type="button" onClick={() => { const newVal = !state.billToOrg; state.setBillToOrg(newVal); if (newVal) state.setPaymentOption("pay_driver"); }}
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

          {/* Payment confirmation */}
          {state.paymentClientSecret && (
            <PaymentConfirmation
              clientSecret={state.paymentClientSecret}
              amountCents={state.authorizedAmountCents}
              onSuccess={handlePaymentSuccess}
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
            />
          )}

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
              <p className="text-[10px] text-muted-foreground">{t("rider.payRemainingNote")}</p>
            </div>
          )}

          {!state.paymentClientSecret && (
            <Button onClick={requestRide} disabled={state.loading || !state.pickupCoords || !state.dropoffCoords} className="w-full">
              {state.loading ? t("rider.requesting") : state.serviceType === "taxi" ? t("rider.requestTaxi") : state.serviceType === "private_hire" ? t("rider.requestPrivateHire") : t("rider.requestCourier")}
            </Button>
          )}
        </motion.div>
      )}

      {/* Ride history */}
      <RideHistory
        rides={queries.rides}
        statusColor={STATUS_COLORS}
        onRate={(rideId, driverId) => {
          state.setManualRateRideId(rideId);
          state.setManualRateDriverId(driverId);
          state.setRatingDialogOpen(true);
        }}
      />

      {/* Rating dialog */}
      {currentRatingRideId && currentRatingDriverId && profile?.id && (
        <RideRatingDialog
          open={state.ratingDialogOpen}
          onOpenChange={(open) => { state.setRatingDialogOpen(open); if (!open) { state.setManualRateRideId(null); state.setManualRateDriverId(null); } }}
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
    </div>
  );
};

export default RiderDashboard;
