import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { DollarSign, ArrowLeft, Car, Bus, Users, Star } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import AddressAutocomplete from "@/components/map/AddressAutocomplete";
import { Input } from "@/components/ui/input";
import RideRatingDialog from "@/components/RideRatingDialog";

type ServiceType = "taxi" | "shuttle";

const RiderDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>("taxi");
  const [passengerCount, setPassengerCount] = useState(1);

  // Fetch service pricing
  const { data: servicePricing } = useQuery({
    queryKey: ["service-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_pricing")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const currentPricing = useMemo(
    () => servicePricing?.find((p) => p.service_type === serviceType),
    [servicePricing, serviceType]
  );

  // Calculate distance
  const distanceKm = useMemo(() => {
    if (!pickupCoords || !dropoffCoords) return null;
    const R = 6371;
    const dLat = ((dropoffCoords.lat - pickupCoords.lat) * Math.PI) / 180;
    const dLon = ((dropoffCoords.lng - pickupCoords.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((pickupCoords.lat * Math.PI) / 180) * Math.cos((dropoffCoords.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [pickupCoords, dropoffCoords]);

  // Dynamic price estimate from service_pricing
  const estimatedPrice = useMemo(() => {
    if (!distanceKm || !currentPricing) return null;
    if (currentPricing.is_flat_rate && currentPricing.flat_rate) {
      return (Number(currentPricing.flat_rate) * (serviceType === "shuttle" ? passengerCount : 1)).toFixed(2);
    }
    let price = Number(currentPricing.base_fare) + distanceKm * Number(currentPricing.per_km_rate);
    if (serviceType === "shuttle" && currentPricing.per_seat_rate) {
      price += passengerCount * Number(currentPricing.per_seat_rate);
    }
    price *= Number(currentPricing.surge_multiplier);
    return Math.max(Number(currentPricing.minimum_fare), price).toFixed(2);
  }, [distanceKm, currentPricing, serviceType, passengerCount]);

  const mapMarkers: MapMarker[] = [
    ...(pickupCoords ? [{ lat: pickupCoords.lat, lng: pickupCoords.lng, type: "pickup" as const, label: "Pickup" }] : []),
    ...(dropoffCoords ? [{ lat: dropoffCoords.lat, lng: dropoffCoords.lng, type: "dropoff" as const, label: "Dropoff" }] : []),
  ];

  // Active ride
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

  // Find most recent completed ride that hasn't been rated yet
  const { data: unratedRide, refetch: refetchUnrated } = useQuery({
    queryKey: ["unrated-ride", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      // Get completed rides
      const { data: completedRides, error } = await supabase
        .from("rides")
        .select("id, driver_id, dropoff_address, completed_at")
        .eq("rider_id", profile.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      if (!completedRides?.length) return null;

      // Check which have already been rated
      const { data: existingRatings } = await supabase
        .from("ride_ratings")
        .select("ride_id")
        .eq("rated_by", profile.id)
        .in("ride_id", completedRides.map((r) => r.id));

      const ratedIds = new Set(existingRatings?.map((r) => r.ride_id) || []);
      return completedRides.find((r) => !ratedIds.has(r.id)) || null;
    },
    enabled: !!profile?.id,
  });

  // Fetch driver name for rating dialog
  const { data: ratingDriverName } = useQuery({
    queryKey: ["rating-driver-name", unratedRide?.driver_id],
    queryFn: async () => {
      if (!unratedRide?.driver_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", unratedRide.driver_id)
        .single();
      return data?.full_name || null;
    },
    enabled: !!unratedRide?.driver_id,
  });

  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [manualRateRideId, setManualRateRideId] = useState<string | null>(null);
  const [manualRateDriverId, setManualRateDriverId] = useState<string | null>(null);

  // Auto-open rating dialog when unrated ride is found
  useEffect(() => {
    if (unratedRide && !manualRateRideId) {
      setRatingDialogOpen(true);
    }
  }, [unratedRide, manualRateRideId]);

  const currentRatingRideId = manualRateRideId || unratedRide?.id;
  const currentRatingDriverId = manualRateDriverId || unratedRide?.driver_id;

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
        distance_km: distanceKm ? parseFloat(distanceKm.toFixed(2)) : null,
        service_type: serviceType,
        passenger_count: passengerCount,
        status: "requested",
      });
      if (error) throw error;
      toast.success("Ride requested! Looking for a driver...");
      setPickup("");
      setDropoff("");
      setPickupCoords(null);
      setDropoffCoords(null);
      setPassengerCount(1);
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                {activeRide.service_type}
              </span>
              <p className="text-sm font-medium">{activeRide.pickup_address} → {activeRide.dropoff_address}</p>
            </div>
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
          {/* Service Type Toggle */}
          <div className="space-y-2">
            <Label>Service Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setServiceType("taxi"); setPassengerCount(1); }}
                className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                  serviceType === "taxi"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-secondary hover:bg-accent"
                }`}
              >
                <Car className={`h-6 w-6 ${serviceType === "taxi" ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <p className="text-sm font-semibold">Taxi</p>
                  <p className="text-xs text-muted-foreground">Private ride</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setServiceType("shuttle")}
                className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                  serviceType === "shuttle"
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-secondary hover:bg-accent"
                }`}
              >
                <Bus className={`h-6 w-6 ${serviceType === "shuttle" ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <p className="text-sm font-semibold">Shuttle</p>
                  <p className="text-xs text-muted-foreground">Shared ride</p>
                </div>
              </button>
            </div>
          </div>

          {/* Passenger count for shuttle */}
          {serviceType === "shuttle" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Passengers
              </Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={passengerCount}
                onChange={(e) => setPassengerCount(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                className="w-24 bg-secondary"
              />
            </div>
          )}

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
              {serviceType === "shuttle" && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({passengerCount} seat{passengerCount > 1 ? "s" : ""})
                </span>
              )}
            </div>
          )}

          <Button onClick={requestRide} disabled={loading || !pickupCoords || !dropoffCoords} className="w-full">
            {loading ? "Requesting..." : `Request ${serviceType === "taxi" ? "Taxi" : "Shuttle"}`}
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
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {ride.service_type}
                  </span>
                  <p className="text-sm font-medium">{ride.pickup_address} → {ride.dropoff_address}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(ride.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right flex items-center gap-3">
                {ride.status === "completed" && ride.driver_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => {
                      setManualRateRideId(ride.id);
                      setManualRateDriverId(ride.driver_id);
                      setRatingDialogOpen(true);
                    }}
                  >
                    <Star className="h-3.5 w-3.5" /> Rate
                  </Button>
                )}
                <div>
                  <p className={`text-xs font-mono uppercase ${statusColor[ride.status] || ""}`}>
                    {ride.status.replace("_", " ")}
                  </p>
                  {ride.estimated_price && (
                    <p className="text-sm font-mono">${Number(ride.estimated_price).toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rating dialog */}
      {currentRatingRideId && currentRatingDriverId && profile?.id && (
        <RideRatingDialog
          open={ratingDialogOpen}
          onOpenChange={(open) => {
            setRatingDialogOpen(open);
            if (!open) {
              setManualRateRideId(null);
              setManualRateDriverId(null);
            }
          }}
          rideId={currentRatingRideId}
          driverId={currentRatingDriverId}
          ratedBy={profile.id}
          driverName={ratingDriverName || undefined}
          onRated={() => {
            refetchUnrated();
            setManualRateRideId(null);
            setManualRateDriverId(null);
          }}
        />
      )}
    </div>
  );
};

export default RiderDashboard;
