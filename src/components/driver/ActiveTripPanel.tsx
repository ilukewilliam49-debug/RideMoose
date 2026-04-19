import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import RideChatSheet from "@/components/RideChatSheet";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    (currentStatus as string) === "arrived" ? 1 :
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
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
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

  const [transitioning, setTransitioning] = useState(false);

  const handleArrivedAtPickup = async (rideId: string) => {
    setTransitioning(true);
    try {
      const body: Record<string, unknown> = { ride_id: rideId };
      if (profile?.latitude != null && profile?.longitude != null) {
        body.driver_lat = profile.latitude;
        body.driver_lng = profile.longitude;
      }
      const { data, error } = await supabase.functions.invoke("arrive-ride", { body });
      if (error) { toast.error("Failed to mark arrival"); return; }
      if (data?.error) {
        if (data?.code === "too_far_from_pickup") {
          toast.error(data.error, { duration: 5000 });
        } else {
          toast.error(data.error);
        }
        return;
      }
      toast.success("Marked as arrived at pickup");
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    } finally { setTransitioning(false); }
  };

  const handleStartTrip = async (rideId: string) => {
    setTransitioning(true);
    try {
      const body: Record<string, unknown> = { ride_id: rideId };
      if (profile?.latitude != null && profile?.longitude != null) {
        body.driver_lat = profile.latitude;
        body.driver_lng = profile.longitude;
      }
      const { data, error } = await supabase.functions.invoke("start-ride", { body });
      if (error) { toast.error("Failed to start ride"); return; }
      if (data?.error) {
        if (data?.code === "too_far_from_pickup") {
          toast.error(data.error, { duration: 5000 });
        } else {
          toast.error(data.error);
        }
        return;
      }
      toast.success("Trip started");
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    } finally { setTransitioning(false); }
  };

  const handleCompleteTrip = async (rideId: string) => {
    setTransitioning(true);
    try {
      const body: Record<string, unknown> = { ride_id: rideId };
      if (activeRide.final_fare_cents) body.final_fare_cents = activeRide.final_fare_cents;
      const { data, error } = await supabase.functions.invoke("complete-ride", { body });
      if (error) { toast.error("Failed to complete ride"); return; }
      if (data?.error) { toast.error(data.error); return; }
      toast.success("Trip completed!");
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    } finally { setTransitioning(false); }
  };

  const uploadProofPhoto = async (rideId: string, file: File) => {
    setUploadingProof(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${rideId}/proof.${ext}`;
      const { error: uploadError } = await supabase.storage.from("proof-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = await supabase.storage.from("proof-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error: updateError } = await supabase.from("rides").update({ proof_photo_url: urlData?.signedUrl } as any).eq("id", rideId);
      if (updateError) throw updateError;
      toast.success(t("dispatch.proofPhotoUploaded"));
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    } catch (err: any) { toast.error(err.message); } finally { setUploadingProof(false); }
  };

  const uploadReceiptPhoto = async (rideId: string, file: File, finalCostCents: number) => {
    setUploadingReceipt(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${rideId}/receipt.${ext}`;
      const { error: uploadError } = await supabase.storage.from("proof-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = await supabase.storage.from("proof-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error: updateError } = await supabase.from("rides").update({ receipt_photo_url: urlData?.signedUrl, final_item_cost_cents: finalCostCents } as any).eq("id", rideId);
      if (updateError) throw updateError;
      toast.success(t("dispatch.receiptPhotoUploaded"));
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    } catch (err: any) { toast.error(err.message); } finally { setUploadingReceipt(false); }
  };

  const getNextActionLabel = () => {
    if (activeRide.status === "accepted") return isDeliveryType(activeRide.service_type) ? "I've arrived" : "I've arrived";
    if ((activeRide.status as string) === "arrived") return isDeliveryType(activeRide.service_type) ? "Start pickup" : "Start trip";
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

  const CANCEL_REASONS = [
    "Vehicle issue / breakdown",
    "Personal emergency",
    "Rider unreachable",
    "Safety concern",
    "Wrong pickup location",
  ];

  const handleDriverCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Please select a reason");
      return;
    }
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("rides")
        .update({
          status: "cancelled" as any,
          cancellation_reason: `Driver cancelled: ${cancelReason}`,
          driver_id: null,
        } as any)
        .eq("id", activeRide.id);
      if (error) throw error;

      // Notify the rider
      await supabase.from("notifications").insert({
        user_id: activeRide.rider_id,
        title: "Driver cancelled your ride",
        body: `Your driver cancelled the ride. Reason: ${cancelReason}. Please request a new ride.`,
        type: "ride_cancelled",
        ride_id: activeRide.id,
      });

      toast.info("Ride cancelled");
      setCancelDialogOpen(false);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
      queryClient.invalidateQueries({ queryKey: ["dispatch-rides"] });
    } catch (err: any) {
      toast.error(err.message || "Could not cancel ride");
    } finally {
      setCancelling(false);
    }
  };

  const handleNextAction = () => {
    if (activeRide.status === "accepted") handleArrivedAtPickup(activeRide.id);
    else if ((activeRide.status as string) === "arrived") handleStartTrip(activeRide.id);
    else if (activeRide.status === "in_progress") handleCompleteTrip(activeRide.id);
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
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold"
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
              Maps
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold"
              onClick={() => {
                const dest = activeRide.status === "in_progress"
                  ? { lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng }
                  : { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng };
                if (dest.lat && dest.lng) {
                  window.open(`https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`, "_blank");
                }
              }}
            >
              Waze
            </Button>
          </div>
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
            (activeRide.status as string) === "arrived" ? "bg-amber-500/10 text-amber-500" :
            "bg-primary/10 text-primary"
          }`}>
            {activeRide.status === "in_progress" ? "In progress" : (activeRide.status as string) === "arrived" ? "At pickup" : "Accepted"}
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
                  {activeRide.billed_to === "organization" && " · Corporate"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <RideChatSheet rideId={activeRide.id} otherPartyName={riderProfile?.full_name || undefined} />
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
        </div>

        {/* Trip details by service type */}
        <div className="px-4 pb-3">
          {(activeRide.service_type === "taxi" || activeRide.service_type === "private_hire") ? (
            <TaxiMeter rideId={activeRide.id} meterStatus={activeRide.meter_status} serviceType={activeRide.service_type} />
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
        {/* Action buttons — show for ALL service types */}
        {/* For taxi: show after meter is stopped, or if not in_progress yet */}
        {(activeRide.service_type !== "taxi" || activeRide.status !== "in_progress" || activeRide.meter_status === "stopped") && (
          <div className="px-4 pb-4 flex gap-2">
            <Button
              className="flex-1 h-14 rounded-xl text-[15px] font-bold active:scale-[0.98] transition-transform"
              disabled={getNextActionDisabled() || transitioning}
              onClick={handleNextAction}
            >
              {transitioning ? "Processing…" : (
                <>
                  {activeRide.status === "accepted" && <MapPinCheck className="mr-2 h-4 w-4" />}
                  {getNextActionLabel()}
                  {activeRide.status !== "accepted" && <ArrowRight className="ml-2 h-4 w-4" />}
                </>
              )}
            </Button>
            {activeRide.status === "accepted" && (
              <Button
                variant="outline"
                className="h-14 w-14 rounded-xl active:scale-[0.98] border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => setCancelDialogOpen(true)}
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Driver cancel dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this ride?</AlertDialogTitle>
            <AlertDialogDescription>
              The rider will be notified and can request a new driver. Please select a reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            {CANCEL_REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => setCancelReason(reason)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  cancelReason === reason
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30 font-medium"
                    : "bg-secondary/50 text-foreground hover:bg-secondary"
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep ride</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDriverCancel}
              disabled={!cancelReason || cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? "Cancelling…" : "Cancel ride"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
