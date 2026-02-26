import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { MapPin, Navigation, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const RiderDashboard = () => {
  const { profile } = useAuth();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [loading, setLoading] = useState(false);

  const estimatedPrice = pickup && dropoff ? (Math.random() * 20 + 5).toFixed(2) : null;

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

  const requestRide = async () => {
    if (!profile?.id || !pickup || !dropoff) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("rides").insert({
        rider_id: profile.id,
        pickup_address: pickup,
        dropoff_address: dropoff,
        estimated_price: parseFloat(estimatedPrice || "0"),
        status: "requested",
      });
      if (error) throw error;
      toast.success("Ride requested! Looking for a driver...");
      setPickup("");
      setDropoff("");
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    requested: "text-yellow-400",
    dispatched: "text-blue-400",
    accepted: "text-cyan-400",
    in_progress: "text-primary",
    completed: "text-green-400",
    cancelled: "text-muted-foreground",
  };

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-bold">Request a Ride</h1>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-surface rounded-lg p-6 space-y-4"
      >
        <div className="space-y-2">
          <Label>Pickup Location</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400" />
            <Input
              placeholder="Enter pickup address"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              className="pl-10 bg-secondary"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Dropoff Location</Label>
          <div className="relative">
            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input
              placeholder="Enter dropoff address"
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              className="pl-10 bg-secondary"
            />
          </div>
        </div>

        {estimatedPrice && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-secondary">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Estimated price:</span>
            <span className="font-mono font-bold">${estimatedPrice}</span>
          </div>
        )}

        <Button onClick={requestRide} disabled={loading || !pickup || !dropoff} className="w-full">
          {loading ? "Requesting..." : "Request Ride"}
        </Button>
      </motion.div>

      {/* Ride history */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Rides</h2>
        <div className="space-y-2">
          {rides?.length === 0 && (
            <p className="text-sm text-muted-foreground">No rides yet.</p>
          )}
          {rides?.map((ride) => (
            <div key={ride.id} className="glass-surface rounded-lg p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">{ride.pickup_address} → {ride.dropoff_address}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(ride.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-mono uppercase ${statusColor[ride.status] || ""}`}>
                  {ride.status.replace("_", " ")}
                </p>
                {ride.estimated_price && (
                  <p className="text-sm font-mono">${Number(ride.estimated_price).toFixed(2)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RiderDashboard;
