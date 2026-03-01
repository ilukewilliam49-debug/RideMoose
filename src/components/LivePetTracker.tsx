import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import RideMap, { type MapMarker } from "@/components/map/MapContainer";
import { PawPrint, MapPin, Clock, Phone } from "lucide-react";
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

const LivePetTracker = ({ ride }: LivePetTrackerProps) => {
  const { t } = useTranslation();
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
