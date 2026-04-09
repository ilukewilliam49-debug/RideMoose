import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRideQueries } from "@/hooks/useRideQueries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowLeft, Package, ShoppingBag, AlertTriangle, MapPin,
  MapPinned, Clock, Truck, Info,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import PaymentConfirmation from "@/components/PaymentConfirmation";

const CourierBooking = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Address state from URL params
  const [pickup, setPickup] = useState(searchParams.get("pickup") || "");
  const [dropoff, setDropoff] = useState(searchParams.get("dropoff") || "");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(
    searchParams.get("plat") && searchParams.get("plng")
      ? { lat: parseFloat(searchParams.get("plat")!), lng: parseFloat(searchParams.get("plng")!) }
      : null
  );
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(
    searchParams.get("dlat") && searchParams.get("dlng")
      ? { lat: parseFloat(searchParams.get("dlat")!), lng: parseFloat(searchParams.get("dlng")!) }
      : null
  );

  // Courier-specific fields
  const [packageSize, setPackageSize] = useState<"small" | "medium" | "large">("small");
  const [itemDescription, setItemDescription] = useState("");
  const [pickupNotes, setPickupNotes] = useState("");
  const [dropoffNotes, setDropoffNotes] = useState("");
  const [marketplaceDelivery, setMarketplaceDelivery] = useState(false);

  // Payment
  const [paymentOption, setPaymentOption] = useState<"in_app" | "pay_driver">("in_app");
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [authorizedAmountCents, setAuthorizedAmountCents] = useState(0);
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Distance
  const distanceKm = useMemo(() => {
    if (!pickupCoords || !dropoffCoords) return null;
    const R = 6371;
    const dLat = ((dropoffCoords.lat - pickupCoords.lat) * Math.PI) / 180;
    const dLng = ((dropoffCoords.lng - pickupCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((pickupCoords.lat * Math.PI) / 180) *
        Math.cos((dropoffCoords.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [pickupCoords, dropoffCoords]);

  const queries = useRideQueries({
    profileId: profile?.id,
    userId: profile?.user_id,
    serviceType: "courier",
    pickupCoords,
    dropoffCoords,
    pickup,
    dropoff,
    distanceKm,
    passengerCount: 1,
    estimatedItemCostCents: 0,
    petMode: "pet_with_owner",
  });

  const mapMarkers: MapMarker[] = [
    ...(pickupCoords ? [{ lat: pickupCoords.lat, lng: pickupCoords.lng, type: "pickup" as const, label: t("rider.pickup") }] : []),
    ...(dropoffCoords ? [{ lat: dropoffCoords.lat, lng: dropoffCoords.lng, type: "dropoff" as const, label: t("rider.dropoff") }] : []),
  ];

  const routePolyline = queries.directionsData?.polyline ?? null;
  const routeInfo = queries.directionsData
    ? { distanceKm: queries.directionsData.distance_km, durationText: queries.directionsData.duration_text }
    : null;

  const requestCourier = async () => {
    if (!profile?.id || !pickup || !dropoff || !pickupCoords || !dropoffCoords) return;
    setLoading(true);
    try {
      const { data: rideData, error } = await supabase.from("rides").insert({
        rider_id: profile.id,
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        dropoff_lat: dropoffCoords.lat,
        dropoff_lng: dropoffCoords.lng,
        estimated_price: parseFloat(queries.allServicePrices.courier || "0"),
        distance_km: distanceKm ? parseFloat(distanceKm.toFixed(2)) : null,
        service_type: "courier" as const,
        passenger_count: 1,
        pricing_model: "courier",
        status: "requested",
        payment_option: paymentOption,
        package_size: packageSize,
        pickup_notes: pickupNotes || null,
        dropoff_notes: dropoffNotes || null,
        proof_photo_required: true,
        item_description: itemDescription || null,
        marketplace_delivery: marketplaceDelivery,
      } as any).select("id").single();

      if (error) throw error;

      toast.success(t("rider.rideRequested", "Courier request submitted!"));
      navigate("/rider/rides");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const packageSizeInfo: Record<string, { label: string; desc: string; icon: string }> = {
    small: { label: t("rider.package_small", "Small"), desc: t("rider.packageSmallDesc", "Envelope, small box"), icon: "📦" },
    medium: { label: t("rider.package_medium", "Medium"), desc: t("rider.packageMediumDesc", "Shoebox, laptop bag"), icon: "📦" },
    large: { label: t("rider.package_large", "Large"), desc: t("rider.packageLargeDesc", "Suitcase, large box"), icon: "📦" },
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            {t("rider.requestCourier", "Send a Parcel")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("rider.courierSubtitle", "Fast & reliable local delivery")}</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        {/* Map */}
        {mapMarkers.length > 0 ? (
          <RideMap markers={mapMarkers} polyline={routePolyline} routeInfo={routeInfo} />
        ) : (
          <div className="h-40 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground text-sm">
            <MapPin className="h-5 w-5 mr-2" />
            {t("rider.enterAddressToSeeMap", "Enter addresses to see the map")}
          </div>
        )}

        {/* Route info */}
        {queries.directionsData && pickupCoords && dropoffCoords && (
          <div className="glass-surface rounded-lg p-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPinned className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">{queries.directionsData.distance_km.toFixed(1)} km</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">{queries.directionsData.duration_in_traffic_text || queries.directionsData.duration_text}</span>
            </div>
          </div>
        )}

        {/* Addresses */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("rider.pickupAddress", "Pickup address")}</Label>
            <AddressAutocomplete
              value={pickup}
              onChange={(val, lat, lng) => { setPickup(val); if (lat !== undefined && lng !== undefined) setPickupCoords({ lat, lng }); }}
              placeholder={t("rider.pickupPlaceholder", "Where to pick up")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("rider.dropoffAddress", "Dropoff address")}</Label>
            <AddressAutocomplete
              value={dropoff}
              onChange={(val, lat, lng) => { setDropoff(val); if (lat !== undefined && lng !== undefined) setDropoffCoords({ lat, lng }); }}
              placeholder={t("rider.dropoffPlaceholder", "Where to deliver")}
            />
          </div>
        </div>

        {/* Package Size */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Package className="h-4 w-4" />
            {t("rider.packageSize", "Package Size")}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {(["small", "medium", "large"] as const).map((size) => {
              const info = packageSizeInfo[size];
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPackageSize(size)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                    packageSize === size
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-transparent bg-card hover:bg-accent/50"
                  }`}
                >
                  <span className="text-lg">{info.icon}</span>
                  <span className="text-xs font-bold">{info.label}</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{info.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Item Description */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("rider.itemDescription", "Item Description")}
          </Label>
          <Textarea
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder={t("rider.describeItem", "e.g. Documents, electronics, fragile items...")}
            className="bg-card resize-none"
            rows={2}
          />
        </div>

        {/* Marketplace toggle */}
        <div className="flex items-center justify-between rounded-xl border-2 border-transparent bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <ShoppingBag className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold">{t("rider.marketplaceDelivery", "Marketplace Delivery")}</p>
              <p className="text-[10px] text-muted-foreground">{t("rider.marketplaceDeliveryDesc", "Driver buys & delivers for you")}</p>
            </div>
          </div>
          <Switch checked={marketplaceDelivery} onCheckedChange={setMarketplaceDelivery} />
        </div>

        {marketplaceDelivery && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-500">{t("rider.ensureCapacity", "Make sure the store has the item in stock. Driver will purchase on your behalf.")}</p>
          </div>
        )}

        {/* Pickup Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("rider.pickupNotes", "Pickup Notes")}
          </Label>
          <Input
            value={pickupNotes}
            onChange={(e) => setPickupNotes(e.target.value)}
            placeholder={t("rider.pickupNotesPlaceholder", "e.g. Ring doorbell, ask for John")}
            className="bg-card"
          />
        </div>

        {/* Dropoff Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("rider.dropoffNotes", "Dropoff Notes")}
          </Label>
          <Input
            value={dropoffNotes}
            onChange={(e) => setDropoffNotes(e.target.value)}
            placeholder={t("rider.dropoffNotesPlaceholder", "e.g. Leave at front door")}
            className="bg-card"
          />
        </div>

        {/* Price estimate */}
        {queries.allServicePrices.courier && (
          <div className="glass-surface rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">{t("rider.estimatedFare", "Estimated Fare")}</span>
              </div>
              <span className="text-xl font-mono font-bold text-primary">${queries.allServicePrices.courier}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground">
                {t("rider.courierPricingNote", "Includes base fare + distance. Vehicle surcharge may apply.")}
              </p>
            </div>
          </div>
        )}

        {/* Payment confirmation */}
        {paymentClientSecret && (
          <PaymentConfirmation
            clientSecret={paymentClientSecret}
            amountCents={authorizedAmountCents}
            onSuccess={() => {
              setPaymentClientSecret(null);
              setPendingRideId(null);
              setAuthorizedAmountCents(0);
              toast.success(t("rider.paymentAuthorized"));
              navigate("/rider/rides");
            }}
            onFailure={async () => {
              if (pendingRideId) {
                await supabase.from("rides").update({ payment_status: "failed", status: "cancelled" }).eq("id", pendingRideId);
              }
              setPaymentClientSecret(null);
              setPendingRideId(null);
              setAuthorizedAmountCents(0);
              toast.error(t("rider.paymentFailed"));
            }}
            label={t("rider.authorizeRidePayment")}
          />
        )}

        {/* Submit */}
        {!paymentClientSecret && (
          <Button
            onClick={requestCourier}
            disabled={loading || !pickupCoords || !dropoffCoords}
            className="w-full h-12 text-base font-bold"
            size="lg"
          >
            {loading ? t("rider.requesting", "Requesting...") : (
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t("rider.requestCourier", "Send a Parcel")}
                {queries.allServicePrices.courier && <span className="opacity-75">· ${queries.allServicePrices.courier}</span>}
              </span>
            )}
          </Button>
        )}
      </motion.div>
    </div>
  );
};

export default CourierBooking;
