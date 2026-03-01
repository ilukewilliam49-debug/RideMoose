import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import { PawPrint, MapPin, Clock, Phone, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface LivePetTrackerProps {
  ride: {
    id: string;
    driver_id: string | null;
    pickup_address: string;
    dropoff_address: string;
    pickup_lat: number | null;
    pickup_lng: number | null;
    dropoff_lat: number | null;
    dropoff_lng: number | null;
    status: string;
    started_at: string | null;
    pet_mode?: string;
    pet_type?: string;
    destination_type?: string;
    emergency_contact_phone?: string;
  };
}

/** Haversine distance in km */
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const LivePetTracker = ({ ride }: LivePetTrackerProps) => {
  const { t } = useTranslation();
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [etaData, setEtaData] = useState<{ etaMin: number; distKm: number } | null>(null);
  const [etaLoading, setEtaLoading] = useState(false);

  // Initial fetch of driver location
  useEffect(() => {
    if (!ride.driver_id) return;
    const fetchDriver = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, latitude, longitude")
        .eq("id", ride.driver_id!)
        .single();
      if (data?.latitude && data?.longitude) {
        setDriverLocation({ lat: data.latitude, lng: data.longitude, name: data.full_name || "Driver" });
        setLastUpdated(new Date());
      }
    };
    fetchDriver();
  }, [ride.driver_id]);

  // Realtime subscription for driver location changes
  useEffect(() => {
    if (!ride.driver_id) return;

    const channel = supabase
      .channel(`pet-tracker-${ride.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${ride.driver_id}`,
        },
        (payload) => {
          const { latitude, longitude, full_name } = payload.new as any;
          if (latitude && longitude) {
            setDriverLocation({ lat: latitude, lng: longitude, name: full_name || "Driver" });
            setLastUpdated(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ride.driver_id, ride.id]);

  // Determine the destination the driver is heading toward
  const destination = useMemo(() => {
    // Before trip starts → heading to pickup; during trip → heading to dropoff
    if (ride.status === "in_progress" && ride.dropoff_lat && ride.dropoff_lng) {
      return { lat: ride.dropoff_lat, lng: ride.dropoff_lng };
    }
    if (ride.pickup_lat && ride.pickup_lng) {
      return { lat: ride.pickup_lat, lng: ride.pickup_lng };
    }
    return null;
  }, [ride.status, ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng]);

  // Fetch ETA via Directions API when driver location changes
  useEffect(() => {
    if (!driverLocation || !destination) return;

    // Quick straight-line check: skip API if very close
    const straightKm = haversineKm(driverLocation.lat, driverLocation.lng, destination.lat, destination.lng);
    if (straightKm < 0.1) {
      setEtaData({ etaMin: 0, distKm: straightKm });
      return;
    }

    // Debounce: only call when location meaningfully changed
    const timer = setTimeout(async () => {
      setEtaLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("directions", {
          body: {
            origin_lat: driverLocation.lat,
            origin_lng: driverLocation.lng,
            dest_lat: destination.lat,
            dest_lng: destination.lng,
          },
        });
        if (!error && data) {
          const etaSec = data.duration_in_traffic_sec ?? data.duration_sec ?? 0;
          setEtaData({
            etaMin: Math.max(1, Math.round(etaSec / 60)),
            distKm: data.distance_km ?? straightKm,
          });
        }
      } catch {
        // Fallback: rough estimate at 30 km/h city speed
        setEtaData({ etaMin: Math.max(1, Math.round((straightKm / 30) * 60)), distKm: straightKm });
      } finally {
        setEtaLoading(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [driverLocation?.lat, driverLocation?.lng, destination?.lat, destination?.lng]);

  const markers: MapMarker[] = [
    ...(ride.pickup_lat && ride.pickup_lng
      ? [{ lat: ride.pickup_lat, lng: ride.pickup_lng, type: "pickup" as const, label: t("rider.pickup") }]
      : []),
    ...(ride.dropoff_lat && ride.dropoff_lng
      ? [{ lat: ride.dropoff_lat, lng: ride.dropoff_lng, type: "dropoff" as const, label: t("rider.dropoff") }]
      : []),
    ...(driverLocation
      ? [{ lat: driverLocation.lat, lng: driverLocation.lng, type: "driver" as const, label: `🐾 ${driverLocation.name}` }]
      : []),
  ];

  const elapsedMin = ride.started_at
    ? Math.round((Date.now() - new Date(ride.started_at).getTime()) / 60000)
    : null;

  const petEmoji = (ride as any).pet_type === "dog" ? "🐕" : (ride as any).pet_type === "cat" ? "🐈" : "🐾";

  const etaLabel = ride.status === "in_progress" ? t("rider.etaDropoff") : t("rider.etaPickup");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {/* Live map */}
      <div className="relative">
        <RideMap markers={markers} className="h-[300px]" />
        {lastUpdated && (
          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5 border border-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">LIVE</span>
          </div>
        )}
      </div>

      {/* ETA countdown banner */}
      {driverLocation && etaData && etaData.etaMin > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">{etaLabel}</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {etaLoading ? "…" : `${etaData.etaMin} min`}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground font-mono">
              {etaData.distKm.toFixed(1)} km away
            </p>
          </div>
        </motion.div>
      )}

      {/* Arrived indicator */}
      {driverLocation && etaData && etaData.etaMin === 0 && (
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3"
        >
          <PawPrint className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary">
            {ride.status === "in_progress" ? t("rider.arrivedAtDropoff") : t("rider.driverArriving")}
          </span>
        </motion.div>
      )}

      {/* Pet transport info card */}
      <div className="glass-surface rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PawPrint className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t("rider.petTransport")}</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono uppercase">
              {petEmoji} {(ride as any).pet_type}
            </span>
          </div>
          {elapsedMin !== null && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{elapsedMin} min</span>
            </div>
          )}
        </div>

        {/* Route */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <span className="text-xs text-muted-foreground">{ride.pickup_address}</span>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            <span className="text-xs text-muted-foreground">{ride.dropoff_address}</span>
          </div>
        </div>

        {/* Pet details */}
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="bg-secondary px-2 py-0.5 rounded-full capitalize">
            {(ride as any).pet_mode?.replace("_", " ")}
          </span>
          {(ride as any).destination_type && (
            <span className="bg-secondary px-2 py-0.5 rounded-full capitalize">
              → {(ride as any).destination_type}
            </span>
          )}
        </div>

        {/* Driver info */}
        {driverLocation && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {t("rider.driver")}: <span className="text-foreground font-medium">{driverLocation.name}</span>
            </p>
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground font-mono">
                Updated {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
              </span>
            )}
          </div>
        )}

        {/* Emergency contact */}
        {(ride as any).emergency_contact_phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <Phone className="h-3 w-3" />
            <span>{t("dispatch.emergencyContact")}: {(ride as any).emergency_contact_phone}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default LivePetTracker;
