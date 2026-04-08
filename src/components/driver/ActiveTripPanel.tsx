import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import {
  Navigation,
  Clock,
  AlertTriangle,
  Phone,
  ArrowRight,
  X,
  Plane,
  CircleDot,
  CheckCircle2,
  Circle,
  MapPinCheck,
} from "lucide-react";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import TaxiMeter from "@/components/TaxiMeter";
import TurnByTurnNav, { type NavStep } from "@/components/TurnByTurnNav";
import ServiceIcon from "@/components/driver/ServiceIcon";
import { serviceLabels, fmt, isAirportTrip, isDeliveryType } from "@/lib/driver-constants";
import type { Ride, RiderProfileSummary, DirectionsData, LiveEtaData, Profile } from "@/types/driver";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// ─── Trip lifecycle steps ───
const TRIP_STEPS = [
  { key: "accepted", label: "Heading to pickup" },
  { key: "arrived", label: "At pickup" },
  { key: "in_progress", label: "Trip in progress" },
  { key: "completed", label: "Completed" },
];

function TripStepper({ currentStatus }: { currentStatus: string }) {
  const stepIndex =
    currentStatus === "in_progress" ? 2 :
    currentStatus === "arrived" ? 1 :
    currentStatus === "accepted" ? 0 : 3;
  return (
    <div className="flex items-center gap-1 py-2">
      {TRIP_STEPS.map((step, i) => {
        const isActive = i === stepIndex;
        const isDone = i < stepIndex;
        return (
          <div key={step.key} className="flex items-center gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              ) : isActive ? (
                <CircleDot className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/30" />
              )}
              <span
                className={`text-[10px] font-medium truncate ${
                  isActive ? "text-primary" : isDone ? "text-green-500" : "text-muted-foreground/40"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < TRIP_STEPS.length - 1 && (
              <div className={`h-px flex-1 min-w-2 ${isDone ? "bg-green-500/40" : "bg-border/30"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail row ───
function DetailRow({ icon, label, value, warn }: { icon: string; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${warn ? "text-amber-500" : "text-muted-foreground"}`}>
      <span>{icon}</span>
      {label && <span>{label}:</span>}
      <span className={`font-medium ${warn ? "" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

// ─── Active trip service-specific details ───
function TripServiceDetails({ ride, proofInputRef, receiptInputRef, uploadingProof, uploadingReceipt, uploadProofPhoto, uploadReceiptPhoto, finalItemCostInput, setFinalItemCostInput }: {
  ride: Ride;
  proofInputRef: React.RefObject<HTMLInputElement>;
  receiptInputRef: React.RefObject<HTMLInputElement>;
  uploadingProof: boolean;
  uploadingReceipt: boolean;
  uploadProofPhoto: (rideId: string, file: File) => void;
  uploadReceiptPhoto: (rideId: string, file: File, costCents: number) => void;
  finalItemCostInput: string;
  setFinalItemCostInput: (v: string) => void;
}) {
  const details: JSX.Element[] = [];
  const r = ride as any;

  if (["courier", "large_delivery", "retail_delivery"].includes(ride.service_type)) {
    if (r.item_description) details.push(<DetailRow key="item" icon="📦" label="Item" value={r.item_description} />);
    if (r.package_size) details.push(<DetailRow key="pkg" icon="📏" label="Size" value={r.package_size} />);
    if (r.weight_estimate_kg) details.push(<DetailRow key="wt" icon="⚖️" label="Weight" value={`~${r.weight_estimate_kg} kg`} />);
    if (r.requires_loading_help) details.push(<DetailRow key="load" icon="⚠️" label="" value="Loading help required" warn />);
    if (r.stairs_involved) details.push(<DetailRow key="strs" icon="⚠️" label="" value="Stairs involved" warn />);
    if (r.store_id) details.push(<DetailRow key="store" icon="🏪" label="Store" value={r.store_id} />);
    if (r.order_value_cents) details.push(<DetailRow key="val" icon="💰" label="Order value" value={`$${(r.order_value_cents / 100).toFixed(2)}`} />);
    if (r.signature_required) details.push(<DetailRow key="sig" icon="✍️" label="" value="Signature required" warn />);
    if (r.marketplace_delivery) details.push(<DetailRow key="mkt" icon="🛒" label="" value="Marketplace delivery" warn />);

    if (ride.status === "in_progress" && r.proof_photo_required && !r.proof_photo_url) {
      details.push(
        <div key="proof" className="p-3 rounded-xl bg-amber-500/5 ring-1 ring-amber-500/20 space-y-2">
          <p className="text-xs font-semibold text-amber-500">📸 Delivery proof photo required</p>
          <input ref={proofInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProofPhoto(ride.id, f); }} />
          <Button size="sm" variant="outline" className="h-10 rounded-xl active:scale-[0.98]" disabled={uploadingProof} onClick={() => proofInputRef.current?.click()}>
            {uploadingProof ? "Uploading…" : "Take photo"}
          </Button>
        </div>
      );
    }
    if (r.proof_photo_url) details.push(<DetailRow key="proofok" icon="✅" label="" value="Proof uploaded" />);
  }

  if (ride.service_type === "personal_shopper") {
    if (r.store_name) details.push(<DetailRow key="store" icon="🏪" label="Store" value={r.store_name} />);
    if (r.item_description) details.push(<DetailRow key="item" icon="📦" label="Items" value={r.item_description} />);
    if (r.quantity) details.push(<DetailRow key="qty" icon="🔢" label="Qty" value={String(r.quantity)} />);
    if (r.estimated_item_cost_cents) details.push(<DetailRow key="est" icon="💰" label="Est. cost" value={`$${(r.estimated_item_cost_cents / 100).toFixed(2)}`} />);

    if (ride.status === "in_progress" && !r.receipt_photo_url) {
      details.push(
        <div key="receipt" className="p-3 rounded-xl bg-amber-500/5 ring-1 ring-amber-500/20 space-y-2">
          <p className="text-xs font-semibold text-amber-500">🧾 Receipt photo required</p>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Final item cost ($)</label>
            <Input type="number" min={0} value={finalItemCostInput} onChange={(e) => setFinalItemCostInput(e.target.value)} placeholder="0.00" className="bg-secondary w-32 h-9 rounded-lg text-sm" />
          </div>
          <input ref={receiptInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && finalItemCostInput) uploadReceiptPhoto(ride.id, f, Math.round(parseFloat(finalItemCostInput) * 100)); }} />
          <Button size="sm" variant="outline" className="h-10 rounded-xl active:scale-[0.98]" disabled={uploadingReceipt || !finalItemCostInput} onClick={() => receiptInputRef.current?.click()}>
            {uploadingReceipt ? "Uploading…" : "Upload receipt"}
          </Button>
        </div>
      );
    }
    if (r.receipt_photo_url) details.push(<DetailRow key="rcptok" icon="✅" label="" value="Receipt uploaded" />);
  }

  if (ride.service_type === "food_delivery") {
    if (r.store_name) details.push(<DetailRow key="rest" icon="🍽️" label="Restaurant" value={r.store_name} />);
    if (r.order_value_cents) details.push(<DetailRow key="val" icon="💰" label="Order" value={`$${(r.order_value_cents / 100).toFixed(2)}`} />);
  }

  if (ride.service_type === "pet_transport") {
    if (r.pet_type) details.push(<DetailRow key="type" icon="🐾" label="Pet" value={r.pet_type} />);
    if (r.pet_mode) details.push(<DetailRow key="mode" icon="🚗" label="Mode" value={r.pet_mode.replace("_", " ")} />);
    if (r.pet_weight_estimate) details.push(<DetailRow key="pwt" icon="⚖️" label="Weight" value={`~${r.pet_weight_estimate} kg`} />);
    if (r.destination_type) details.push(<DetailRow key="dest" icon="📍" label="Destination" value={r.destination_type} />);
    if (r.emergency_contact_phone) details.push(<DetailRow key="emrg" icon="📞" label="Emergency" value={r.emergency_contact_phone} />);
    if (r.crate_confirmed) details.push(<DetailRow key="crate" icon="✅" label="" value="Crate confirmed" />);
  }

  if (details.length === 0) return null;
  return <div className="space-y-2 pb-2">{details}</div>;
}

interface ActiveTripPanelProps {
  activeRide: Ride;
  riderProfile: RiderProfileSummary | null;
  profile: Profile | null;
  activeRideDirections: DirectionsData | null;
  liveEta: LiveEtaData | null;
}

export default function ActiveTripPanel({
  activeRide,
  riderProfile,
  profile,
  activeRideDirections,
  liveEta,
}: ActiveTripPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [finalItemCostInput, setFinalItemCostInput] = useState("");
  const proofInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const activeMarkers: MapMarker[] = [
    ...(activeRide.pickup_lat && activeRide.pickup_lng ? [{ lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, type: "pickup" as const, label: t("dispatch.pickup") }] : []),
    ...(activeRide.dropoff_lat && activeRide.dropoff_lng ? [{ lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng, type: "dropoff" as const, label: t("dispatch.dropoff") }] : []),
    ...(profile?.latitude && profile?.longitude ? [{ lat: profile.latitude, lng: profile.longitude, type: "driver" as const, label: t("dispatch.you") }] : []),
  ];

  const activeTrafficDelayMin = liveEta
    ? Math.max((liveEta.duration_in_traffic_sec - liveEta.duration_sec) / 60, 0)
    : activeRideDirections
      ? Math.max((activeRideDirections.duration_in_traffic_sec - activeRideDirections.duration_sec) / 60, 0)
      : 0;

  const updateRideStatus = async (rideId: string, status: string) => {
    const updates: Record<string, unknown> = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("rides").update(updates as any).eq("id", rideId);
    if (error) { toast.error(error.message); return; }
    if (status === "completed" && (activeRide.service_type === "large_delivery" || activeRide.service_type === "personal_shopper") && activeRide.payment_status === "authorized") {
      try { await supabase.functions.invoke("capture-payment", { body: { ride_id: rideId } }); } catch (e) { console.error("Payment capture failed:", e); }
    }
    toast.success(t("dispatch.rideStatusUpdate", { status: status.replace("_", " ") }));
    queryClient.invalidateQueries({ queryKey: ["active-ride"] });
  };

  const uploadProofPhoto = async (rideId: string, file: File) => {
    setUploadingProof(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${rideId}/proof.${ext}`;
      const { error: uploadError } = await supabase.storage.from("proof-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("proof-photos").getPublicUrl(path);
      const { error: updateError } = await supabase.from("rides").update({ proof_photo_url: urlData.publicUrl } as any).eq("id", rideId);
      if (updateError) throw updateError;
      toast.success(t("dispatch.proofPhotoUploaded"));
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    } catch (err: any) { toast.error(err.message); } finally { setUploadingProof(false); }
  };

  const uploadReceiptPhoto = async (rideId: string, file: File, finalCostCents: number) => {
    setUploadingReceipt(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${rideId}/receipt.${ext}`;
      const { error: uploadError } = await supabase.storage.from("proof-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("proof-photos").getPublicUrl(path);
      const { error: updateError } = await supabase.from("rides").update({ receipt_photo_url: urlData.publicUrl, final_item_cost_cents: finalCostCents } as any).eq("id", rideId);
      if (updateError) throw updateError;
      toast.success(t("dispatch.receiptPhotoUploaded"));
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    } catch (err: any) { toast.error(err.message); } finally { setUploadingReceipt(false); }
  };

  const getNextActionLabel = () => {
    if (activeRide.status === "accepted") return isDeliveryType(activeRide.service_type) ? "I've arrived" : "I've arrived";
    if (activeRide.status === "arrived") return isDeliveryType(activeRide.service_type) ? "Start pickup" : "Start trip";
    if (activeRide.status === "in_progress") return isDeliveryType(activeRide.service_type) ? "Complete delivery" : "Complete trip";
    return "";
  };

  const getNextActionDisabled = () => {
    if (activeRide.status !== "in_progress") return false;
    const r = activeRide as any;
    if (["courier", "large_delivery", "retail_delivery"].includes(activeRide.service_type) && r.proof_photo_required && !r.proof_photo_url) return true;
    if (activeRide.service_type === "personal_shopper" && !r.receipt_photo_url) return true;
    return false;
  };

  const handleNextAction = () => {
    if (activeRide.status === "accepted") updateRideStatus(activeRide.id, "arrived");
    else if (activeRide.status === "arrived") updateRideStatus(activeRide.id, "in_progress");
    else if (activeRide.status === "in_progress") updateRideStatus(activeRide.id, "completed");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Map */}
      {activeMarkers.length > 0 && (
        <div className="rounded-2xl overflow-hidden ring-1 ring-border/50">
          <RideMap markers={activeMarkers} polyline={activeRideDirections?.polyline ?? null} />
        </div>
      )}

      {/* ETA strip + Navigate button */}
      {(liveEta || activeRideDirections) && (
        <div className="flex items-center gap-3 rounded-2xl bg-card ring-1 ring-border/50 px-4 py-3 text-sm">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-primary" />
              <span className="font-semibold tabular-nums">
                {(liveEta?.distance_km ?? activeRideDirections?.distance_km ?? 0).toFixed(1)} km
              </span>
              <span className="text-[10px] text-muted-foreground">
                {activeRide.status === "in_progress" ? "to drop" : "to pickup"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-semibold">
                {liveEta ? (liveEta.duration_in_traffic_text || liveEta.duration_text) : (activeRideDirections?.duration_in_traffic_text || activeRideDirections?.duration_text)}
              </span>
              {liveEta && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              )}
            </div>
            {activeTrafficDelayMin > 2 && (
              <div className="flex items-center gap-1 text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">+{Math.round(activeTrafficDelayMin)}m</span>
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 font-semibold"
            onClick={() => {
              const dest = activeRide.status === "in_progress"
                ? { lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng, addr: activeRide.dropoff_address }
                : { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, addr: activeRide.pickup_address };
              const destination = dest.lat && dest.lng
                ? `${dest.lat},${dest.lng}`
                : encodeURIComponent(dest.addr || "");
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`, "_blank");
            }}
          >
            <Navigation className="h-3.5 w-3.5" />
            Navigate
          </Button>
        </div>
      )}

      {/* Turn-by-turn nav */}
      {liveEta?.steps && liveEta.steps.length > 0 && (
        <TurnByTurnNav steps={liveEta.steps as any} driverLat={profile?.latitude} driverLng={profile?.longitude} />
      )}

      {/* Trip card */}
      <div className="rounded-2xl bg-card ring-1 ring-primary/20 overflow-hidden">
        {/* Header with service type */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <ServiceIcon type={activeRide.service_type} className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold">{serviceLabels[activeRide.service_type] || activeRide.service_type}</span>
                {isAirportTrip(activeRide) && (
                  <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    <Plane className="h-2.5 w-2.5" /> Airport
                  </span>
                )}
                {activeRide.estimated_price && (
                  <span className="text-sm font-semibold text-primary tabular-nums ml-1">
                    {fmt(Number(activeRide.estimated_price) * 100)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
            activeRide.status === "in_progress" ? "bg-green-500/10 text-green-500" :
            activeRide.status === "arrived" ? "bg-amber-500/10 text-amber-500" :
            "bg-primary/10 text-primary"
          }`}>
            {activeRide.status === "in_progress" ? "In progress" : activeRide.status === "arrived" ? "At pickup" : "Accepted"}
          </span>
        </div>

        {/* Stepper */}
        <div className="px-4">
          <TripStepper currentStatus={activeRide.status} />
        </div>

        {/* Addresses */}
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-green-500/20" />
              <div className="w-px h-6 bg-border" />
              <div className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-primary/20" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium leading-tight">{activeRide.pickup_address}</p>
                {(activeRide as any).pickup_notes && (
                  <p className="text-xs text-muted-foreground mt-0.5">📝 {(activeRide as any).pickup_notes}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Drop-off</p>
                <p className="text-sm font-medium leading-tight">{activeRide.dropoff_address}</p>
                {(activeRide as any).dropoff_notes && (
                  <p className="text-xs text-muted-foreground mt-0.5">📝 {(activeRide as any).dropoff_notes}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rider / customer context */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                {riderProfile?.full_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{riderProfile?.full_name || "Customer"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {isDeliveryType(activeRide.service_type) ? "Sender" : `${activeRide.passenger_count} passenger${activeRide.passenger_count > 1 ? "s" : ""}`}
                  {activeRide.payment_option === "pay_driver" && " · Cash payment"}
                  {activeRide.billed_to === "organization" && " · Corporate"}
                </p>
              </div>
            </div>
            {riderProfile?.phone && (
              <a
                href={`tel:${riderProfile.phone}`}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary active:scale-95 transition-transform shrink-0"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        {/* Trip details by service type */}
        <div className="px-4 pb-3">
          {activeRide.service_type === "taxi" ? (
            <TaxiMeter rideId={activeRide.id} meterStatus={activeRide.meter_status} />
          ) : (
            <TripServiceDetails
              ride={activeRide}
              proofInputRef={proofInputRef}
              receiptInputRef={receiptInputRef}
              uploadingProof={uploadingProof}
              uploadingReceipt={uploadingReceipt}
              uploadProofPhoto={uploadProofPhoto}
              uploadReceiptPhoto={uploadReceiptPhoto}
              finalItemCostInput={finalItemCostInput}
              setFinalItemCostInput={setFinalItemCostInput}
            />
          )}
        </div>

        {/* Action buttons */}
        {activeRide.service_type !== "taxi" && (
          <div className="px-4 pb-4 flex gap-2">
            <Button
              className="flex-1 h-14 rounded-xl text-[15px] font-bold active:scale-[0.98] transition-transform"
              disabled={getNextActionDisabled()}
              onClick={handleNextAction}
            >
              {activeRide.status === "accepted" && <MapPinCheck className="mr-2 h-4 w-4" />}
              {getNextActionLabel()}
              {activeRide.status !== "accepted" && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              className="h-14 w-14 rounded-xl active:scale-[0.98]"
              onClick={() => updateRideStatus(activeRide.id, "cancelled")}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
