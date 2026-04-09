import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Play, Square, MapPin, Navigation, Zap, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SimulatorMap from "@/components/admin/SimulatorMap";

/**
 * Interpolate `steps` evenly-spaced points between two lat/lng pairs.
 */
function interpolateRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  steps: number
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Add slight random jitter to make movement look natural
    const jitter = () => (Math.random() - 0.5) * 0.0003;
    points.push({
      lat: start.lat + (end.lat - start.lat) * t + jitter(),
      lng: start.lng + (end.lng - start.lng) * t + jitter(),
    });
  }
  return points;
}

const MockDriverSimulator = () => {
  const [selectedRideId, setSelectedRideId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [speedMs, setSpeedMs] = useState(3000);
  const [returnTrip, setReturnTrip] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeRef = useRef<{ lat: number; lng: number }[]>([]);
  const [visibleRoute, setVisibleRoute] = useState<{ lat: number; lng: number }[]>([]);

  // Fetch active rides (accepted or in_progress) with driver assigned
  const { data: activeRides, isLoading } = useQuery({
    queryKey: ["admin-active-rides-sim"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("id, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status, service_type, driver_id, driver:driver_id(full_name)")
        .in("status", ["accepted", "in_progress"])
        .not("driver_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const selectedRide = activeRides?.find((r: any) => r.id === selectedRideId);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  const start = useCallback(() => {
    if (!selectedRide) {
      toast.error("Select a ride first");
      return;
    }

    const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, driver_id } = selectedRide as any;
    if (!pickup_lat || !pickup_lng || !dropoff_lat || !dropoff_lng) {
      toast.error("Ride is missing coordinates");
      return;
    }
    if (!driver_id) {
      toast.error("No driver assigned to this ride");
      return;
    }

    const steps = 40;
    const outbound = interpolateRoute(
      { lat: pickup_lat, lng: pickup_lng },
      { lat: dropoff_lat, lng: dropoff_lng },
      steps
    );
    const route = returnTrip
      ? [...outbound, ...interpolateRoute({ lat: dropoff_lat, lng: dropoff_lng }, { lat: pickup_lat, lng: pickup_lng }, steps)]
      : outbound;

    routeRef.current = route;
    setVisibleRoute(route);
    setCurrentPos(route[0]);
    setTotalSteps(route.length - 1);
    setStepIndex(0);
    setIsRunning(true);

    let idx = 0;
    intervalRef.current = setInterval(async () => {
      if (idx >= route.length) {
        stop();
        toast.success(returnTrip ? "Round trip complete — driver back at pickup" : "Simulation complete — driver arrived at dropoff");
        return;
      }

      const point = route[idx];
      const { error } = await supabase
        .from("profiles")
        .update({ latitude: point.lat, longitude: point.lng })
        .eq("id", driver_id);

      if (error) {
        console.error("Failed to update driver location:", error.message);
      }

      idx++;
      setStepIndex(idx);
      setCurrentPos(point);
    }, speedMs);
  }, [selectedRide, speedMs, stop]);

  const progress = totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0;

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Mock Driver Simulator</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Select an active ride with an assigned driver. The simulator will move the driver's GPS position
        from pickup to dropoff so you can test the rider's live tracking experience.
      </p>

      <div className="rounded-xl border border-border/50 bg-card/70 p-5 space-y-5">
        {/* Ride selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Active Ride</label>
          <Select
            value={selectedRideId}
            onValueChange={setSelectedRideId}
            disabled={isRunning}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoading ? "Loading rides…" : "Select a ride"} />
            </SelectTrigger>
            <SelectContent>
              {activeRides?.length === 0 && (
                <SelectItem value="none" disabled>No active rides with drivers</SelectItem>
              )}
              {activeRides?.map((r: any) => (
                <SelectItem key={r.id} value={r.id}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {r.service_type.replace("_", " ")}
                    </Badge>
                    <span className="truncate max-w-[200px]">
                      {r.pickup_address} → {r.dropoff_address}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected ride info */}
        {selectedRide && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-500" />
              <span className="truncate">{(selectedRide as any).pickup_address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-destructive" />
              <span className="truncate">{(selectedRide as any).dropoff_address}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>Driver: {(selectedRide as any).driver?.full_name || "Unknown"}</span>
              <Badge variant="outline" className="text-xs capitalize">{(selectedRide as any).status.replace("_", " ")}</Badge>
            </div>
          </div>
        )}

        {/* Speed control */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Update interval: {(speedMs / 1000).toFixed(1)}s
          </label>
          <Slider
            value={[speedMs]}
            onValueChange={([v]) => setSpeedMs(v)}
            min={500}
            max={5000}
            step={250}
            disabled={isRunning}
          />
          <p className="text-xs text-muted-foreground">
            Lower = faster movement. Default 3s mimics real GPS updates.
          </p>
        </div>

        {/* Return trip toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-foreground">Return trip</label>
            <p className="text-xs text-muted-foreground">Reverse route back to pickup after dropoff</p>
          </div>
          <Switch checked={returnTrip} onCheckedChange={setReturnTrip} disabled={isRunning} />
        </div>

        {/* Progress */}
        {isRunning && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Simulating…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          {!isRunning ? (
            <Button onClick={start} disabled={!selectedRideId}>
              <Play className="h-4 w-4 mr-2" /> Start Simulation
            </Button>
          ) : (
            <Button variant="destructive" onClick={stop}>
              <Square className="h-4 w-4 mr-2" /> Stop
            </Button>
          )}
        </div>
      </div>

      {/* Mini-map */}
      {selectedRide && (
        <SimulatorMap
          pickup={
            (selectedRide as any).pickup_lat
              ? { lat: (selectedRide as any).pickup_lat, lng: (selectedRide as any).pickup_lng }
              : null
          }
          dropoff={
            (selectedRide as any).dropoff_lat
              ? { lat: (selectedRide as any).dropoff_lat, lng: (selectedRide as any).dropoff_lng }
              : null
          }
          driverPos={currentPos}
          route={visibleRoute}
        />
      )}
    </div>
  );
};

export default MockDriverSimulator;
