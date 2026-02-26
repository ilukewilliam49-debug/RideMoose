import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Check, X, MapPin } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const DriverDispatch = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch rides dispatched/requested
  const { data: pendingRides } = useQuery({
    queryKey: ["dispatch-rides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .in("status", ["requested", "dispatched"])
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return data;
    },
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("rides-dispatch")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dispatch-rides"] });
        queryClient.invalidateQueries({ queryKey: ["active-ride"] });
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

  const updateRideStatus = async (rideId: string, status: string) => {
    const updates: any = { status };
    if (status === "in_progress") updates.started_at = new Date().toISOString();
    if (status === "completed") updates.completed_at = new Date().toISOString();

    const { error } = await supabase.from("rides").update(updates).eq("id", rideId);
    if (error) toast.error(error.message);
    else toast.success(`Ride ${status.replace("_", " ")}!`);
  };

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-bold">Dispatch Board</h1>

      {/* Active ride */}
      {activeRide && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-surface rounded-lg p-5 border border-primary/30"
        >
          <h2 className="text-sm font-semibold text-primary mb-3">ACTIVE RIDE</h2>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateRideStatus(activeRide.id, "cancelled")}
            >
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* Pending rides */}
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
