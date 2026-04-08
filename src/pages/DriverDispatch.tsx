import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Car } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { usePetArrivalCheck } from "@/hooks/usePetArrivalCheck";
import type { NavStep } from "@/components/TurnByTurnNav";
import type { Ride, RiderProfileSummary, DirectionsData, LiveEtaData } from "@/types/driver";
import { isDeliveryType } from "@/lib/driver-constants";

import ActiveTripPanel from "@/components/driver/ActiveTripPanel";
import TripSummaryCard from "@/components/driver/TripSummaryCard";
import IncomingRequestCard from "@/components/driver/IncomingRequestCard";
import OutstandingBalances from "@/components/driver/OutstandingBalances";
import RecentDeliveries from "@/components/driver/RecentDeliveries";
import ErrorRetry from "@/components/driver/ErrorRetry";
import { DispatchCardSkeleton } from "@/components/driver/DriverDashboardSkeletons";

const DriverDispatch = () => {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const prevPendingCountRef = useRef(0);

  useDriverLocation(profile?.id, !!profile?.is_available);

  // ─── Pending rides ───
  const { data: pendingRides, isError: pendingError, refetch: refetchPending } = useQuery({
    queryKey: ["dispatch-rides", profile?.can_taxi, profile?.can_private_hire, profile?.can_shuttle, profile?.can_courier, profile?.can_food_delivery, profile?.pet_approved, profile?.vehicle_type],
    queryFn: async () => {
      const serviceTypes: string[] = [];
      if (profile?.can_taxi) serviceTypes.push("taxi");
      if (profile?.can_private_hire) serviceTypes.push("private_hire");
      if (profile?.can_shuttle) serviceTypes.push("shuttle");
      if (profile?.can_courier) { serviceTypes.push("courier", "retail_delivery", "personal_shopper"); }
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
      return data as Ride[];
    },
    enabled: !!profile,
    refetchInterval: 5000,
  });

  // ─── Active ride ───
  const { data: activeRide, isError: activeError, refetch: refetchActive } = useQuery({
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
      return (data as Ride) || null;
    },
    enabled: !!profile?.id,
  });

  // ─── Rider profile ───
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
      return data as RiderProfileSummary;
    },
    enabled: !!activeRide?.rider_id,
  });

  usePetArrivalCheck(activeRide as any);

  // ─── My bids ───
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
  myBids?.forEach((b) => { bidsByRide.set(b.ride_id, b); });

  // ─── Outstanding rides ───
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
      return data as Ride[];
    },
    enabled: !!profile?.id,
  });

  // ─── Recent deliveries ───
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
      return data as Ride[];
    },
    enabled: !!profile?.id,
  });

  // ─── Directions ───
  const { data: activeRideDirections } = useQuery({
    queryKey: ["driver-active-directions", activeRide?.id],
    queryFn: async () => {
      if (!activeRide?.pickup_lat || !activeRide?.pickup_lng || !activeRide?.dropoff_lat || !activeRide?.dropoff_lng) return null;
      const { data, error } = await supabase.functions.invoke("directions", {
        body: { origin_lat: activeRide.pickup_lat, origin_lng: activeRide.pickup_lng, dest_lat: activeRide.dropoff_lat, dest_lng: activeRide.dropoff_lng },
      });
      if (error) return null;
      return data as DirectionsData;
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
      return data as LiveEtaData;
    },
    enabled: !!myLat && !!myLng && !!driverDestLat && !!driverDestLng && !!activeRide,
    staleTime: 25_000,
    refetchInterval: 30_000,
  });

  // ─── Realtime ───
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

  // ─── Sound + vibration on new requests ───
  useEffect(() => {
    const currentCount = visiblePendingRides.length;
    if (currentCount > prevPendingCountRef.current && prevPendingCountRef.current >= 0) {
      // Play alert sound
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
        setTimeout(() => ctx.close(), 600);
      } catch { /* audio not available */ }

      // Vibrate
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    }
    prevPendingCountRef.current = currentCount;
  });

  // ─── Actions ───
  const acceptRide = useCallback(async (rideId: string) => {
    if (!profile?.id) return;
    setAcceptingId(rideId);
    try {
      const { error } = await supabase
        .from("rides")
        .update({ driver_id: profile.id, status: "accepted" })
        .eq("id", rideId)
        .eq("status", "requested");
      if (error) toast.error(t("dispatch.couldNotAccept"));
      else toast.success(t("dispatch.rideAccepted"));
    } finally {
      setAcceptingId(null);
    }
  }, [profile?.id, t]);

  const declineRide = useCallback((rideId: string) => {
    setDeclinedIds((prev) => new Set(prev).add(rideId));
    toast.info("Request declined");
  }, []);

  const visiblePendingRides = (pendingRides || []).filter((r) => !declinedIds.has(r.id));

  const pendingMarkers: MapMarker[] = visiblePendingRides
    .filter((r) => r.pickup_lat && r.pickup_lng)
    .map((r) => ({ lat: r.pickup_lat!, lng: r.pickup_lng!, type: "pickup" as const, label: r.pickup_address }));

  // Error states
  if (pendingError && !activeRide) {
    return (
      <div className="space-y-4 pb-6">
        <PageHeader profile={profile} />
        <ErrorRetry message="Failed to load ride requests" onRetry={() => refetchPending()} />
      </div>
    );
  }

  if (activeError) {
    return (
      <div className="space-y-4 pb-6">
        <PageHeader profile={profile} />
        <ErrorRetry message="Failed to load active trip" onRetry={() => refetchActive()} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader profile={profile} />

      {/* Active trip */}
      {activeRide && (
        <ActiveTripPanel
          activeRide={activeRide}
          riderProfile={riderProfile || null}
          profile={profile}
          activeRideDirections={activeRideDirections || null}
          liveEta={liveEta || null}
        />
      )}

      {/* Outstanding balances */}
      <OutstandingBalances rides={outstandingRides || []} />

      {/* Incoming requests */}
      {!activeRide && (
        <>
          {pendingMarkers.length > 0 && (
            <div className="rounded-2xl overflow-hidden ring-1 ring-border/50">
              <RideMap markers={pendingMarkers} />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Incoming requests
              </h2>
              {visiblePendingRides.length > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {visiblePendingRides.length}
                </span>
              )}
            </div>

            {visiblePendingRides.length === 0 && (
              <div className="rounded-2xl bg-card/50 ring-1 ring-border/30 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 mx-auto mb-3">
                  <Car className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No pending requests</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Trips will appear here when available</p>
              </div>
            )}

            <div className="space-y-3">
              {visiblePendingRides.map((ride, i) => (
                <IncomingRequestCard
                  key={ride.id}
                  ride={ride}
                  index={i}
                  acceptingId={acceptingId}
                  existingBid={bidsByRide.get(ride.id) || null}
                  driverId={profile?.id || ""}
                  onAccept={acceptRide}
                  onDecline={declineRide}
                  onBidChanged={() => queryClient.invalidateQueries({ queryKey: ["my-delivery-bids"] })}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Recent deliveries */}
      <RecentDeliveries rides={recentDeliveries || []} />
    </div>
  );
};

function PageHeader({ profile }: { profile: any }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Dispatch
        </p>
        <h1 className="text-xl font-bold tracking-tight">
          Waiting for trips
        </h1>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${profile?.is_available ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
        <span className="text-xs font-medium text-muted-foreground">
          {profile?.is_available ? "Online" : "Offline"}
        </span>
      </div>
    </div>
  );
}

export default DriverDispatch;
