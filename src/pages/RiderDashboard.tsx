import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DollarSign, ArrowLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";

const RiderDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate distance-based price estimate
  const estimatedPrice = pickupCoords && dropoffCoords
    ? (() => {
        const R = 6371;
        const dLat = ((dropoffCoords.lat - pickupCoords.lat) * Math.PI) / 180;
        const dLon = ((dropoffCoords.lng - pickupCoords.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos((pickupCoords.lat * Math.PI) / 180) * Math.cos((dropoffCoords.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
        const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.max(5, 2.5 + km * 1.2).toFixed(2);
      })()
    : null;

  const mapMarkers: MapMarker[] = [
    ...(pickupCoords ? [{ lat: pickupCoords.lat, lng: pickupCoords.lng, type: "pickup" as const, label: "Pickup" }] : []),
    ...(dropoffCoords ? [{ lat: dropoffCoords.lat, lng: dropoffCoords.lng, type: "dropoff" as const, label: "Dropoff" }] : []),
  ];

  // Active ride — show driver location
  const { data: activeRide } = useQuery({
    queryKey: ["rider-active-ride", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("rider_id", profile.id)
        .in("status", ["requested", "accepted", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch driver profile for active ride (for location)
  const { data: driverProfile } = useQuery({
    queryKey: ["driver-location", activeRide?.driver_id],
    queryFn: async () => {
      if (!activeRide?.driver_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, latitude, longitude")
        .eq("id", activeRide.driver_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeRide?.driver_id,
    refetchInterval: 5000,
  });

  // Realtime subscription for ride updates
  useEffect(() => {
    const channel = supabase
      .channel("rider-rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => {
        queryClient.invalidateQueries({ queryKey: ["rider-active-ride"] });
        queryClient.invalidateQueries({ queryKey: ["my-rides"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Build active ride markers
  const activeMarkers: MapMarker[] = activeRide
    ? [
        ...(activeRide.pickup_lat && activeRide.pickup_lng ? [{ lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, type: "pickup" as const, label: "Pickup" }] : []),
        ...(activeRide.dropoff_lat && activeRide.dropoff_lng ? [{ lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng, type: "dropoff" as const, label: "Dropoff" }] : []),
        ...(driverProfile?.latitude && driverProfile?.longitude ? [{ lat: driverProfile.latitude, lng: driverProfile.longitude, type: "driver" as const, label: driverProfile.full_name || "Driver" }] : []),
      ]
    : [];

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
    if (!profile?.id || !pickup || !dropoff || !pickupCoords || !dropoffCoords) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("rides").insert({
        rider_id: profile.id,
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        dropoff_lat: dropoffCoords.lat,
        dropoff_lng: dropoffCoords.lng,
        estimated_price: parseFloat(estimatedPrice || "0"),
        status: "requested",
      });
      if (error) throw error;
      toast.success("Ride requested! Looking for a driver...");
      setPickup("");
      setDropoff("");
      setPickupCoords(null);
      setDropoffCoords(null);
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

  const showActiveMap = activeRide && activeMarkers.length > 0;
  const showBookingMap = !activeRide && mapMarkers.length > 0;

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/rider")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {activeRide ? "Ride in Progress" : "Request a Ride"}
        </h1>
      </div>

      {/* Active ride tracking map */}
      {showActiveMap && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <RideMap markers={activeMarkers} />
          <div className="glass-surface rounded-lg p-4 mt-3 space-y-1">
            <p className="text-sm font-medium">{activeRide.pickup_address} → {activeRide.dropoff_address}</p>
            <p className={`text-xs font-mono uppercase ${statusColor[activeRide.status]}`}>
              {activeRide.status.replace("_", " ")}
            </p>
            {driverProfile && (
              <p className="text-xs text-muted-foreground">Driver: {driverProfile.full_name}</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Booking form */}
      {!activeRide && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-surface rounded-lg p-6 space-y-4"
        >
          <div className="space-y-2">
            <Label>Pickup Location</Label>
            <AddressAutocomplete
              value={pickup}
              onChange={(val, lat, lng) => {
                setPickup(val);
                if (lat && lng) setPickupCoords({ lat, lng });
              }}
              placeholder="Search pickup address..."
              iconColor="text-green-400"
            />
          </div>
          <div className="space-y-2">
            <Label>Dropoff Location</Label>
            <AddressAutocomplete
              value={dropoff}
              onChange={(val, lat, lng) => {
                setDropoff(val);
                if (lat && lng) setDropoffCoords({ lat, lng });
              }}
              placeholder="Search dropoff address..."
              iconColor="text-primary"
            />
          </div>

          {showBookingMap && <RideMap markers={mapMarkers} />}

          {estimatedPrice && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-secondary">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Estimated price:</span>
              <span className="font-mono font-bold">${estimatedPrice}</span>
            </div>
          )}

          <Button onClick={requestRide} disabled={loading || !pickupCoords || !dropoffCoords} className="w-full">
            {loading ? "Requesting..." : "Request Ride"}
          </Button>
        </motion.div>
      )}

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
