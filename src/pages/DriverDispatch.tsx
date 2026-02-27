import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, MapPin, Car, Bus, Briefcase, Banknote } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import TaxiMeter from "@/components/TaxiMeter";

const DriverDispatch = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  useDriverLocation(profile?.id, !!profile?.is_available);

  // Only fetch rides matching driver's capabilities
  const { data: pendingRides } = useQuery({
    queryKey: ["dispatch-rides", profile?.can_taxi, profile?.can_private_hire, profile?.can_shuttle],
    queryFn: async () => {
      const serviceTypes: ("taxi" | "private_hire" | "shuttle")[] = [];
      if (profile?.can_taxi) serviceTypes.push("taxi");
      if (profile?.can_private_hire) serviceTypes.push("private_hire");
      if (profile?.can_shuttle) serviceTypes.push("shuttle");
      if (serviceTypes.length === 0) return [];

      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .in("status", ["requested", "dispatched"])
        .in("service_type", serviceTypes)
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

  // Completed rides awaiting cash payment
  const { data: unpaidRides } = useQuery({
    queryKey: ["unpaid-rides", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", profile.id)
        .eq("status", "completed")
        .eq("payment_option", "pay_driver")
        .eq("payment_status", "unpaid")
        .order("completed_at", { ascending: false })
        .limit(5);
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
        queryClient.invalidateQueries({ queryKey: ["unpaid-rides"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const acceptRide = async (rideId: string) => {
    if (!profile?.id) return;
    const { error } = await supabase
      .from("rides")
      .update({ driver_id: profile.id, status: "accepted" })
      .eq("id", rideId)
      .eq("status", "requested");
    if (error) {
      toast.error("Could not accept ride. It may have been taken.");
    } else {
      toast.success("Ride accepted!");
    }
  };

  const markAsPaid = async (rideId: string) => {
    const { error } = await supabase
      .from("rides")
      .update({ payment_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", rideId);
    if (error) toast.error(error.message);
    else {
      toast.success("Marked as paid!");
      queryClient.invalidateQueries({ queryKey: ["unpaid-rides"] });
    }
  };
  const updateRideStatus = async (rideId: string, status: string) => {
    const updates: any = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("rides").update(updates).eq("id", rideId);
    if (error) toast.error(error.message);
    else toast.success(`Ride ${status.replace("_", " ")}!`);
  };

  const activeMarkers: MapMarker[] = activeRide
    ? [
        ...(activeRide.pickup_lat && activeRide.pickup_lng ? [{ lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, type: "pickup" as const, label: "Pickup" }] : []),
        ...(activeRide.dropoff_lat && activeRide.dropoff_lng ? [{ lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng, type: "dropoff" as const, label: "Dropoff" }] : []),
        ...(profile?.latitude && profile?.longitude ? [{ lat: profile.latitude, lng: profile.longitude, type: "driver" as const, label: "You" }] : []),
      ]
    : [];

  const pendingMarkers: MapMarker[] = (pendingRides || [])
    .filter((r) => r.pickup_lat && r.pickup_lng)
    .map((r) => ({
      lat: r.pickup_lat!,
      lng: r.pickup_lng!,
      type: "pickup" as const,
      label: r.pickup_address,
    }));

  const ServiceIcon = ({ type }: { type: string }) =>
    type === "shuttle" ? <Bus className="h-3.5 w-3.5" /> : type === "private_hire" ? <Briefcase className="h-3.5 w-3.5" /> : <Car className="h-3.5 w-3.5" />;

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dispatch Board</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {profile?.can_taxi && <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary"><Car className="h-3 w-3" /> Taxi</span>}
          {profile?.can_private_hire && <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary"><Briefcase className="h-3 w-3" /> Private</span>}
          {profile?.can_shuttle && <span className="flex items-center gap-1 px-2 py-1 rounded bg-secondary"><Bus className="h-3 w-3" /> Shuttle</span>}
        </div>
      </div>

      {/* Active ride with map */}
      {activeRide && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {activeMarkers.length > 0 && <RideMap markers={activeMarkers} />}
          <div className="glass-surface rounded-lg p-5 border border-primary/30">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-primary">ACTIVE RIDE</h2>
              <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                {activeRide.service_type === "private_hire" ? "Private Hire – Flat Rate" : activeRide.service_type}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-green-400 mt-0.5" />
                <span className="text-sm">{activeRide.pickup_address}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-0.5" />
                <span className="text-sm">{activeRide.dropoff_address}</span>
              </div>
            </div>
            {/* Taxi rides use the meter */}
            {activeRide.service_type === "taxi" ? (
              <TaxiMeter rideId={activeRide.id} meterStatus={activeRide.meter_status} />
            ) : (
              <div className="flex gap-2">
                {activeRide.status === "accepted" && (
                  <Button size="sm" onClick={() => updateRideStatus(activeRide.id, "in_progress")}>
                    Start Trip
                  </Button>
                )}
                {activeRide.status === "in_progress" && (
                  <Button size="sm" onClick={() => updateRideStatus(activeRide.id, "completed")}>
                    Complete Trip
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => updateRideStatus(activeRide.id, "cancelled")}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Unpaid cash rides */}
      {unpaidRides && unpaidRides.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-yellow-500" />
            Awaiting Cash Payment
          </h2>
          <div className="space-y-2">
            {unpaidRides.map((ride) => (
              <div key={ride.id} className="glass-surface rounded-lg p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium truncate">
                    {ride.pickup_address} → {ride.dropoff_address}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Fare: ${(Number(ride.final_fare_cents || ride.final_price || 0) / 100).toFixed(2)}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => markAsPaid(ride.id)}
                >
                  <Banknote className="h-3.5 w-3.5" /> Mark as Paid
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!activeRide && pendingMarkers.length > 0 && (
        <RideMap markers={pendingMarkers} />
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Incoming Requests</h2>
        {pendingRides?.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending ride requests.</p>
        )}
        <div className="space-y-2">
          {pendingRides?.map((ride) => (
            <motion.div
              key={ride.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-surface rounded-lg p-4 flex items-center justify-between"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                    <ServiceIcon type={ride.service_type} />
                    {ride.service_type}
                  </span>
                  {ride.service_type === "shuttle" && (
                    <span className="text-xs text-muted-foreground">{ride.passenger_count} pax</span>
                  )}
                </div>
                <p className="text-sm font-medium truncate">
                  {ride.pickup_address} → {ride.dropoff_address}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  ${Number(ride.estimated_price || 0).toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2 ml-3">
                <Button size="icon" variant="ghost" onClick={() => acceptRide(ride.id)}>
                  <Check className="h-4 w-4 text-green-400" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DriverDispatch;
