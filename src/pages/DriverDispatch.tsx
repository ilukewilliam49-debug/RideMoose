import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  MapPin,
  MapPinned,
  Car,
  Bus,
  Briefcase,
  Banknote,
  Package,
  AlertTriangle,
  ShoppingBag,
  Truck,
  Weight,
  Receipt,
  Store,
  ShoppingCart,
  UtensilsCrossed,
  PawPrint,
  Clock,
  Navigation,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CircleDot,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { usePetArrivalCheck } from "@/hooks/usePetArrivalCheck";
import TaxiMeter from "@/components/TaxiMeter";
import DriverBidForm from "@/components/DriverBidForm";
import TurnByTurnNav, { type NavStep } from "@/components/TurnByTurnNav";

// ─── Service helpers ───
const serviceLabels: Record<string, string> = {
  taxi: "Taxi",
  private_hire: "Private Hire",
  shuttle: "Shuttle",
  courier: "Courier",
  large_delivery: "Large Delivery",
  retail_delivery: "Retail Delivery",
  personal_shopper: "Personal Shopper",
  food_delivery: "Food Delivery",
  pet_transport: "Pet Transport",
};

const ServiceIcon = ({ type, className = "h-4 w-4" }: { type: string; className?: string }) => {
  const icons: Record<string, any> = {
    shuttle: Bus,
    private_hire: Briefcase,
    courier: Package,
    large_delivery: Truck,
    retail_delivery: Store,
    personal_shopper: ShoppingCart,
    food_delivery: UtensilsCrossed,
    pet_transport: PawPrint,
  };
  const Icon = icons[type] || Car;
  return <Icon className={className} />;
};

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ─── Trip lifecycle steps ───
const TRIP_STEPS = [
  { key: "accepted", label: "Heading to pickup" },
  { key: "arrived", label: "At pickup" },
  { key: "in_progress", label: "Trip in progress" },
  { key: "completed", label: "Completed" },
];

function TripStepper({ currentStatus }: { currentStatus: string }) {
  const stepIndex = currentStatus === "in_progress" ? 2 : currentStatus === "accepted" ? 0 : 3;
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

const DriverDispatch = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [finalItemCostInput, setFinalItemCostInput] = useState<string>("");
  const [showOutstanding, setShowOutstanding] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  useDriverLocation(profile?.id, !!profile?.is_available);

  // Only fetch rides matching driver's capabilities
  const { data: pendingRides } = useQuery({
    queryKey: ["dispatch-rides", profile?.can_taxi, profile?.can_private_hire, profile?.can_shuttle, profile?.can_courier, profile?.can_food_delivery, profile?.pet_approved, profile?.vehicle_type],
    queryFn: async () => {
      const serviceTypes: string[] = [];
      if (profile?.can_taxi) serviceTypes.push("taxi");
      if (profile?.can_private_hire) serviceTypes.push("private_hire");
      if (profile?.can_shuttle) serviceTypes.push("shuttle");
      if (profile?.can_courier) { serviceTypes.push("courier"); serviceTypes.push("retail_delivery"); serviceTypes.push("personal_shopper"); }
      if (profile?.can_food_delivery) serviceTypes.push("food_delivery");
      if (profile?.pet_approved) serviceTypes.push("pet_transport");
      if (profile?.vehicle_type && ["SUV", "truck", "van"].includes(profile.vehicle_type)) serviceTypes.push("large_delivery");
      if (serviceTypes.length === 0) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .in("status", ["requested", "dispatched"])
        .in("service_type", serviceTypes as any)
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
    refetchInterval: 5000,
  });

  const { data: activeRide } = useQuery({
    queryKey: ["active-ride", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", profile.id)
        .in("status", ["accepted", "in_progress"])
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch rider profile for active trip context
  const { data: riderProfile } = useQuery({
    queryKey: ["rider-profile", activeRide?.rider_id],
    queryFn: async () => {
      if (!activeRide?.rider_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", activeRide.rider_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!activeRide?.rider_id,
  });

  usePetArrivalCheck(activeRide as any);

  const { data: myBids } = useQuery({
    queryKey: ["my-delivery-bids", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("delivery_bids")
        .select("*")
        .eq("driver_id", profile.id)
        .in("status", ["pending", "accepted", "rejected"]);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
    refetchInterval: 5000,
  });

  const bidsByRide = new Map<string, any>();
  myBids?.forEach((b: any) => { bidsByRide.set(b.ride_id, b); });

  const { data: outstandingRides } = useQuery({
    queryKey: ["outstanding-rides", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", profile.id)
        .eq("status", "completed")
        .or("payment_status.eq.partial,and(payment_option.eq.pay_driver,payment_status.eq.unpaid)")
        .order("completed_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  const { data: recentDeliveries } = useQuery({
    queryKey: ["recent-deliveries", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", profile.id)
        .eq("status", "completed")
        .in("service_type", ["large_delivery", "courier", "retail_delivery", "personal_shopper", "food_delivery", "pet_transport"] as any)
        .order("completed_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    const channel = supabase
      .channel("rides-dispatch")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dispatch-rides"] });
        queryClient.invalidateQueries({ queryKey: ["active-ride"] });
        queryClient.invalidateQueries({ queryKey: ["outstanding-rides"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_bids" }, () => {
        queryClient.invalidateQueries({ queryKey: ["my-delivery-bids"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // ─── Actions ───
  const acceptRide = async (rideId: string) => {
    if (!profile?.id) return;
    const { error } = await supabase
      .from("rides")
      .update({ driver_id: profile.id, status: "accepted" })
      .eq("id", rideId)
      .eq("status", "requested");
    if (error) toast.error(t("dispatch.couldNotAccept"));
    else toast.success(t("dispatch.rideAccepted"));
  };

  const declineRide = (rideId: string) => {
    // Just hide from list — no DB change needed for decline
    toast.info("Request declined");
  };

  const markOutstandingCollected = async (rideId: string) => {
    const { error } = await supabase
      .from("rides")
      .update({
        outstanding_amount_cents: 0,
        driver_collected_outstanding_at: new Date().toISOString(),
        payment_status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", rideId);
    if (error) toast.error(error.message);
    else {
      toast.success(t("dispatch.markedCollected"));
      queryClient.invalidateQueries({ queryKey: ["outstanding-rides"] });
    }
  };

  const uploadProofPhoto = async (rideId: string, file: File) => {
    setUploadingProof(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${rideId}/proof.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("proof-photos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("proof-photos").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("rides")
        .update({ proof_photo_url: urlData.publicUrl } as any)
        .eq("id", rideId);
      if (updateError) throw updateError;
      toast.success(t("dispatch.proofPhotoUploaded"));
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingProof(false);
    }
  };

  const uploadReceiptPhoto = async (rideId: string, file: File, finalCostCents: number) => {
    setUploadingReceipt(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${rideId}/receipt.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("proof-photos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("proof-photos").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("rides")
        .update({ receipt_photo_url: urlData.publicUrl, final_item_cost_cents: finalCostCents } as any)
        .eq("id", rideId);
      if (updateError) throw updateError;
      toast.success(t("dispatch.receiptPhotoUploaded"));
      queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingReceipt(false);
    }
  };

  const updateRideStatus = async (rideId: string, status: string) => {
    const updates: any = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("rides").update(updates).eq("id", rideId);
    if (error) { toast.error(error.message); return; }
    if (status === "completed" && (activeRide?.service_type === "large_delivery" || activeRide?.service_type === "personal_shopper") && activeRide?.payment_status === "authorized") {
      try {
        await supabase.functions.invoke("capture-payment", { body: { ride_id: rideId } });
      } catch (e) { console.error("Payment capture failed:", e); }
    }
    toast.success(t("dispatch.rideStatusUpdate", { status: status.replace("_", " ") }));
  };

  // ─── Map data ───
  const activeMarkers: MapMarker[] = activeRide
    ? [
        ...(activeRide.pickup_lat && activeRide.pickup_lng ? [{ lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, type: "pickup" as const, label: t("dispatch.pickup") }] : []),
        ...(activeRide.dropoff_lat && activeRide.dropoff_lng ? [{ lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng, type: "dropoff" as const, label: t("dispatch.dropoff") }] : []),
        ...(profile?.latitude && profile?.longitude ? [{ lat: profile.latitude, lng: profile.longitude, type: "driver" as const, label: t("dispatch.you") }] : []),
      ]
    : [];

  const { data: activeRideDirections } = useQuery({
    queryKey: ["driver-active-directions", activeRide?.id],
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

  const roundCoord = (v: number) => Math.round(v * 1000) / 1000;
  const myLat = profile?.latitude ? roundCoord(profile.latitude) : null;
  const myLng = profile?.longitude ? roundCoord(profile.longitude) : null;
  const driverDestLat = activeRide?.status === "in_progress" ? activeRide.dropoff_lat : activeRide?.pickup_lat;
  const driverDestLng = activeRide?.status === "in_progress" ? activeRide.dropoff_lng : activeRide?.pickup_lng;

  const { data: liveEta } = useQuery({
    queryKey: ["driver-live-eta", activeRide?.id, myLat, myLng, driverDestLat, driverDestLng],
    queryFn: async () => {
      if (!myLat || !myLng || !driverDestLat || !driverDestLng) return null;
      const { data, error } = await supabase.functions.invoke("directions", {
        body: { origin_lat: myLat, origin_lng: myLng, dest_lat: driverDestLat, dest_lng: driverDestLng },
      });
      if (error) return null;
      return data as { distance_km: number; duration_text: string; duration_in_traffic_text: string; duration_in_traffic_sec: number; duration_sec: number; steps?: NavStep[] };
    },
    enabled: !!myLat && !!myLng && !!driverDestLat && !!driverDestLng && !!activeRide,
    staleTime: 25_000,
    refetchInterval: 30_000,
  });

  const activeTrafficDelayMin = liveEta
    ? Math.max((liveEta.duration_in_traffic_sec - liveEta.duration_sec) / 60, 0)
    : activeRideDirections
      ? Math.max((activeRideDirections.duration_in_traffic_sec - activeRideDirections.duration_sec) / 60, 0)
      : 0;

  const pendingMarkers: MapMarker[] = (pendingRides || [])
    .filter((r) => r.pickup_lat && r.pickup_lng)
    .map((r) => ({ lat: r.pickup_lat!, lng: r.pickup_lng!, type: "pickup" as const, label: r.pickup_address }));

  const isDeliveryType = (type: string) =>
    ["courier", "large_delivery", "retail_delivery", "personal_shopper", "food_delivery", "pet_transport"].includes(type);

  const getNextActionLabel = () => {
    if (!activeRide) return "";
    if (activeRide.status === "accepted") return isDeliveryType(activeRide.service_type) ? "Start pickup" : "Start trip";
    if (activeRide.status === "in_progress") return isDeliveryType(activeRide.service_type) ? "Complete delivery" : "Complete trip";
    return "";
  };

  const getNextActionDisabled = () => {
    if (!activeRide || activeRide.status !== "in_progress") return false;
    if ((activeRide.service_type === "courier" || activeRide.service_type === "large_delivery" || activeRide.service_type === "retail_delivery") && (activeRide as any).proof_photo_required && !(activeRide as any).proof_photo_url) return true;
    if (activeRide.service_type === "personal_shopper" && !(activeRide as any).receipt_photo_url) return true;
    return false;
  };

  const handleNextAction = () => {
    if (!activeRide) return;
    if (activeRide.status === "accepted") updateRideStatus(activeRide.id, "in_progress");
    else if (activeRide.status === "in_progress") updateRideStatus(activeRide.id, "completed");
  };

  return (
    <div className="space-y-4 pb-6">
      {/* ─── Page header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Dispatch
          </p>
          <h1 className="text-xl font-bold tracking-tight">
            {activeRide ? "Active trip" : "Waiting for trips"}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${profile?.is_available ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-xs font-medium text-muted-foreground">
            {profile?.is_available ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ─── ACTIVE TRIP PANEL ─── */}
      {/* ═══════════════════════════════════════ */}
      {activeRide && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Map */}
          {activeMarkers.length > 0 && (
            <div className="rounded-2xl overflow-hidden ring-1 ring-border/50">
              <RideMap markers={activeMarkers} polyline={activeRideDirections?.polyline ?? null} />
            </div>
          )}

          {/* ETA strip */}
          {(liveEta || activeRideDirections) && (
            <div className="flex items-center gap-4 rounded-2xl bg-card ring-1 ring-border/50 px-4 py-3 text-sm">
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
          )}

          {/* Turn-by-turn nav */}
          {liveEta?.steps && liveEta.steps.length > 0 && (
            <TurnByTurnNav steps={liveEta.steps} driverLat={profile?.latitude} driverLng={profile?.longitude} />
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
                  <span className="text-sm font-bold">{serviceLabels[activeRide.service_type] || activeRide.service_type}</span>
                  {activeRide.estimated_price && (
                    <span className="ml-2 text-sm font-semibold text-primary tabular-nums">
                      {fmt(Number(activeRide.estimated_price) * 100)}
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                activeRide.status === "in_progress" ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"
              }`}>
                {activeRide.status === "in_progress" ? "In progress" : "Accepted"}
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
                <>
                  <TripServiceDetails ride={activeRide} t={t} proofInputRef={proofInputRef} receiptInputRef={receiptInputRef} uploadingProof={uploadingProof} uploadingReceipt={uploadingReceipt} uploadProofPhoto={uploadProofPhoto} uploadReceiptPhoto={uploadReceiptPhoto} finalItemCostInput={finalItemCostInput} setFinalItemCostInput={setFinalItemCostInput} />
                </>
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
                  {getNextActionLabel()}
                  <ArrowRight className="ml-2 h-4 w-4" />
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
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ─── OUTSTANDING BALANCES ─── */}
      {/* ═══════════════════════════════════════ */}
      {outstandingRides && outstandingRides.length > 0 && (
        <div>
          <button
            onClick={() => setShowOutstanding(!showOutstanding)}
            className="flex w-full items-center justify-between rounded-2xl bg-amber-500/8 ring-1 ring-amber-500/20 px-4 py-3 text-left active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3">
              <Banknote className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-sm font-semibold">Outstanding balances</p>
                <p className="text-xs text-muted-foreground">{outstandingRides.length} ride{outstandingRides.length > 1 ? "s" : ""} to collect</p>
              </div>
            </div>
            {showOutstanding ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showOutstanding && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2 mt-2">
                {outstandingRides.map((ride) => {
                  const totalFare = Number(ride.final_fare_cents || ride.final_price || 0);
                  const captured = Number(ride.captured_amount_cents || 0);
                  const outstanding = Number(ride.outstanding_amount_cents || 0);
                  const displayOutstanding = outstanding > 0 ? outstanding : totalFare;
                  return (
                    <div key={ride.id} className="rounded-2xl bg-card ring-1 ring-border/50 p-4 space-y-2">
                      <p className="text-sm font-medium truncate">{ride.pickup_address} → {ride.dropoff_address}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                        <span>Total: {fmt(totalFare)}</span>
                        {captured > 0 && <span>Paid: {fmt(captured)}</span>}
                        <span className="text-amber-500 font-semibold">Due: {fmt(displayOutstanding)}</span>
                      </div>
                      <Button size="sm" className="w-full h-10 rounded-xl gap-1.5 active:scale-[0.98]" onClick={() => markOutstandingCollected(ride.id)}>
                        <Banknote className="h-3.5 w-3.5" /> Mark collected
                      </Button>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ─── INCOMING REQUESTS ─── */}
      {/* ═══════════════════════════════════════ */}
      {!activeRide && (
        <>
          {!activeRide && pendingMarkers.length > 0 && (
            <div className="rounded-2xl overflow-hidden ring-1 ring-border/50">
              <RideMap markers={pendingMarkers} />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Incoming requests
              </h2>
              {(pendingRides?.length ?? 0) > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {pendingRides?.length}
                </span>
              )}
            </div>

            {pendingRides?.length === 0 && (
              <div className="rounded-2xl bg-card/50 ring-1 ring-border/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">No pending requests right now</p>
                <p className="text-xs text-muted-foreground/60 mt-1">New trips will appear here automatically</p>
              </div>
            )}

            <div className="space-y-3">
              {pendingRides?.map((ride, i) => (
                <motion.div
                  key={ride.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl bg-card ring-1 ring-border/50 overflow-hidden"
                >
                  {/* Request header */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <div className="flex items-center gap-2">
                      <ServiceIcon type={ride.service_type} className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold">{serviceLabels[ride.service_type] || ride.service_type}</span>
                      {ride.service_type === "shuttle" && (
                        <span className="text-[10px] text-muted-foreground">{ride.passenger_count} pax</span>
                      )}
                    </div>
                    <span className="text-base font-bold text-primary tabular-nums">
                      {fmt(Number(ride.estimated_price || 0) * 100)}
                    </span>
                  </div>

                  {/* Addresses */}
                  <div className="px-4 py-2 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="mt-1 h-2 w-2 rounded-full bg-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-tight line-clamp-1">{ride.pickup_address}</p>
                        {ride.pickup_notes && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">📝 {ride.pickup_notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-tight line-clamp-1">{ride.dropoff_address}</p>
                        {ride.dropoff_notes && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">📝 {ride.dropoff_notes}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contextual metadata row */}
                  <div className="px-4 pb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {ride.scheduled_at && (
                      <span className="flex items-center gap-1 bg-secondary/80 px-2 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" />
                        {new Date(ride.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    {(ride.service_type === "taxi" || ride.service_type === "private_hire" || ride.service_type === "shuttle") && ride.passenger_count > 1 && (
                      <span className="bg-secondary/80 px-2 py-0.5 rounded-full">{ride.passenger_count} passengers</span>
                    )}
                    {ride.distance_km && (
                      <span className="tabular-nums">{Number(ride.distance_km).toFixed(1)} km</span>
                    )}
                    {ride.payment_option === "pay_driver" && (
                      <span className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                        <Banknote className="h-3 w-3" /> Cash
                      </span>
                    )}
                  </div>

                  {/* Extra details */}
                  <RequestDetails ride={ride} t={t} />

                  {/* Actions */}
                  <div className="px-4 pb-3 pt-1">
                    {ride.service_type === "large_delivery" ? (
                      <DriverBidForm
                        rideId={ride.id}
                        driverId={profile?.id || ""}
                        estimatedPrice={Number(ride.estimated_price || 0)}
                        existingBid={bidsByRide.get(ride.id) || null}
                        onBidChanged={() => queryClient.invalidateQueries({ queryKey: ["my-delivery-bids"] })}
                      />
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 h-12 rounded-xl font-bold active:scale-[0.98] transition-transform"
                          onClick={() => acceptRide(ride.id)}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          className="h-12 w-12 rounded-xl active:scale-[0.98]"
                          onClick={() => declineRide(ride.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ─── RECENT DELIVERIES (collapsible) ─── */}
      {/* ═══════════════════════════════════════ */}
      {recentDeliveries && recentDeliveries.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex w-full items-center justify-between rounded-2xl bg-card ring-1 ring-border/50 px-4 py-3 text-left active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3">
              <Receipt className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Recent deliveries</p>
            </div>
            {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2 mt-2">
                {recentDeliveries.map((ride: any) => (
                  <div key={ride.id} className="rounded-2xl bg-card ring-1 ring-border/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <ServiceIcon type={ride.service_type} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium truncate">{ride.pickup_address} → {ride.dropoff_address}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {ride.completed_at ? new Date(ride.completed_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="text-muted-foreground">Fare: {fmt(ride.final_fare_cents || 0)}</span>
                      <span className="text-primary font-semibold">Net: {fmt(ride.driver_earnings_cents || 0)}</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

// ─── Request detail chips ───
function RequestDetails({ ride, t }: { ride: any; t: any }) {
  const chips: { label: string; warn?: boolean }[] = [];

  if (ride.service_type === "courier") {
    if (ride.item_description) chips.push({ label: `📦 ${ride.item_description}` });
    if (ride.marketplace_delivery) chips.push({ label: "Marketplace", warn: true });
    if (ride.package_size) chips.push({ label: ride.package_size });
  } else if (ride.service_type === "large_delivery") {
    if (ride.item_description) chips.push({ label: `📦 ${ride.item_description}` });
    if (ride.weight_estimate_kg) chips.push({ label: `~${ride.weight_estimate_kg} kg` });
    if (ride.requires_loading_help) chips.push({ label: "Loading help", warn: true });
    if (ride.stairs_involved) chips.push({ label: "Stairs", warn: true });
  } else if (ride.service_type === "retail_delivery") {
    if (ride.store_id) chips.push({ label: `🏪 ${ride.store_id}` });
    if (ride.signature_required) chips.push({ label: "Signature req.", warn: true });
  } else if (ride.service_type === "personal_shopper") {
    if (ride.store_name) chips.push({ label: `🏪 ${ride.store_name}` });
    if (ride.item_description) chips.push({ label: `📦 ${ride.item_description}` });
  } else if (ride.service_type === "food_delivery") {
    if (ride.store_name) chips.push({ label: `🍽️ ${ride.store_name}` });
    if (ride.order_value_cents) chips.push({ label: `$${(ride.order_value_cents / 100).toFixed(2)}` });
  } else if (ride.service_type === "pet_transport") {
    if (ride.pet_type) chips.push({ label: `🐾 ${ride.pet_type}` });
    if (ride.pet_mode) chips.push({ label: ride.pet_mode.replace("_", " ") });
    if (ride.destination_type) chips.push({ label: `→ ${ride.destination_type}` });
  }

  if (chips.length === 0) return null;

  return (
    <div className="px-4 pb-2 flex flex-wrap gap-1.5">
      {chips.map((c, i) => (
        <span
          key={i}
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            c.warn ? "bg-amber-500/10 text-amber-500" : "bg-secondary text-secondary-foreground"
          }`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ─── Active trip service-specific details ───
function TripServiceDetails({ ride, t, proofInputRef, receiptInputRef, uploadingProof, uploadingReceipt, uploadProofPhoto, uploadReceiptPhoto, finalItemCostInput, setFinalItemCostInput }: any) {
  const details: JSX.Element[] = [];

  if (ride.service_type === "courier" || ride.service_type === "large_delivery" || ride.service_type === "retail_delivery") {
    if (ride.item_description) details.push(<DetailRow key="item" icon="📦" label="Item" value={ride.item_description} />);
    if (ride.package_size) details.push(<DetailRow key="pkg" icon="📏" label="Size" value={ride.package_size} />);
    if (ride.weight_estimate_kg) details.push(<DetailRow key="wt" icon="⚖️" label="Weight" value={`~${ride.weight_estimate_kg} kg`} />);
    if (ride.requires_loading_help) details.push(<DetailRow key="load" icon="⚠️" label="" value="Loading help required" warn />);
    if (ride.stairs_involved) details.push(<DetailRow key="strs" icon="⚠️" label="" value="Stairs involved" warn />);
    if (ride.store_id) details.push(<DetailRow key="store" icon="🏪" label="Store" value={ride.store_id} />);
    if (ride.order_value_cents) details.push(<DetailRow key="val" icon="💰" label="Order value" value={`$${(ride.order_value_cents / 100).toFixed(2)}`} />);
    if (ride.signature_required) details.push(<DetailRow key="sig" icon="✍️" label="" value="Signature required" warn />);
    if (ride.marketplace_delivery) details.push(<DetailRow key="mkt" icon="🛒" label="" value="Marketplace delivery" warn />);

    // Proof photo for in_progress
    if (ride.status === "in_progress" && ride.proof_photo_required && !ride.proof_photo_url) {
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
    if (ride.proof_photo_url) details.push(<DetailRow key="proofok" icon="✅" label="" value="Proof uploaded" />);
  }

  if (ride.service_type === "personal_shopper") {
    if (ride.store_name) details.push(<DetailRow key="store" icon="🏪" label="Store" value={ride.store_name} />);
    if (ride.item_description) details.push(<DetailRow key="item" icon="📦" label="Items" value={ride.item_description} />);
    if (ride.quantity) details.push(<DetailRow key="qty" icon="🔢" label="Qty" value={String(ride.quantity)} />);
    if (ride.estimated_item_cost_cents) details.push(<DetailRow key="est" icon="💰" label="Est. cost" value={`$${(ride.estimated_item_cost_cents / 100).toFixed(2)}`} />);

    if (ride.status === "in_progress" && !ride.receipt_photo_url) {
      details.push(
        <div key="receipt" className="p-3 rounded-xl bg-amber-500/5 ring-1 ring-amber-500/20 space-y-2">
          <p className="text-xs font-semibold text-amber-500">🧾 Receipt photo required</p>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Final item cost ($)</label>
            <Input type="number" min={0} value={finalItemCostInput} onChange={(e: any) => setFinalItemCostInput(e.target.value)} placeholder="0.00" className="bg-secondary w-32 h-9 rounded-lg text-sm" />
          </div>
          <input ref={receiptInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && finalItemCostInput) uploadReceiptPhoto(ride.id, f, Math.round(parseFloat(finalItemCostInput) * 100)); }} />
          <Button size="sm" variant="outline" className="h-10 rounded-xl active:scale-[0.98]" disabled={uploadingReceipt || !finalItemCostInput} onClick={() => receiptInputRef.current?.click()}>
            {uploadingReceipt ? "Uploading…" : "Upload receipt"}
          </Button>
        </div>
      );
    }
    if (ride.receipt_photo_url) details.push(<DetailRow key="rcptok" icon="✅" label="" value="Receipt uploaded" />);
  }

  if (ride.service_type === "food_delivery") {
    if (ride.store_name) details.push(<DetailRow key="rest" icon="🍽️" label="Restaurant" value={ride.store_name} />);
    if (ride.order_value_cents) details.push(<DetailRow key="val" icon="💰" label="Order" value={`$${(ride.order_value_cents / 100).toFixed(2)}`} />);
  }

  if (ride.service_type === "pet_transport") {
    if (ride.pet_type) details.push(<DetailRow key="type" icon="🐾" label="Pet" value={ride.pet_type} />);
    if (ride.pet_mode) details.push(<DetailRow key="mode" icon="🚗" label="Mode" value={ride.pet_mode.replace("_", " ")} />);
    if (ride.pet_weight_estimate) details.push(<DetailRow key="pwt" icon="⚖️" label="Weight" value={`~${ride.pet_weight_estimate} kg`} />);
    if (ride.destination_type) details.push(<DetailRow key="dest" icon="📍" label="Destination" value={ride.destination_type} />);
    if (ride.emergency_contact_phone) details.push(<DetailRow key="emrg" icon="📞" label="Emergency" value={ride.emergency_contact_phone} />);
    if (ride.crate_confirmed) details.push(<DetailRow key="crate" icon="✅" label="" value="Crate confirmed" />);
  }

  if (details.length === 0) return null;

  return <div className="space-y-2 pb-2">{details}</div>;
}

function DetailRow({ icon, label, value, warn }: { icon: string; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${warn ? "text-amber-500" : "text-muted-foreground"}`}>
      <span>{icon}</span>
      {label && <span>{label}:</span>}
      <span className={`font-medium ${warn ? "" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

export default DriverDispatch;
