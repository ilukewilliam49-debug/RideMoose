import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Haversine distance in meters */
const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const ARRIVAL_RADIUS_M = 200;

interface Ride {
  id: string;
  service_type: string;
  status: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
}

/**
 * Monitors driver GPS and fires a pet-arrival-notify edge function
 * when the driver is within ARRIVAL_RADIUS_M of the pickup (status=accepted)
 * or dropoff (status=in_progress) for pet_transport rides.
 *
 * Each arrival type fires only once per ride.
 */
export const usePetArrivalCheck = (ride: Ride | null | undefined) => {
  const notifiedRef = useRef<{ pickup?: boolean; dropoff?: boolean }>({});
  const prevRideId = useRef<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  const isPetRide = ride?.service_type === "pet_transport" &&
    (ride.status === "accepted" || ride.status === "in_progress");

  // Reset when ride changes
  if (ride?.id !== prevRideId.current) {
    notifiedRef.current = {};
    prevRideId.current = ride?.id ?? null;
  }

  // Watch GPS only for active pet transport rides
  useEffect(() => {
    if (!isPetRide || !("geolocation" in navigator)) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [isPetRide]);

  const notify = useCallback(async (rideId: string, arrivalType: "pickup" | "dropoff") => {
    try {
      await supabase.functions.invoke("pet-arrival-notify", {
        body: { ride_id: rideId, arrival_type: arrivalType },
      });
    } catch (err) {
      console.error("Pet arrival notify failed:", err);
    }
  }, []);

  useEffect(() => {
    if (!ride || !isPetRide || !pos) return;

    // Check pickup proximity (when accepted, heading to pickup)
    if (
      ride.status === "accepted" &&
      ride.pickup_lat &&
      ride.pickup_lng &&
      !notifiedRef.current.pickup
    ) {
      const dist = haversineMeters(pos.lat, pos.lng, ride.pickup_lat, ride.pickup_lng);
      if (dist <= ARRIVAL_RADIUS_M) {
        notifiedRef.current.pickup = true;
        notify(ride.id, "pickup");
      }
    }

    // Check dropoff proximity (when in_progress, heading to dropoff)
    if (
      ride.status === "in_progress" &&
      ride.dropoff_lat &&
      ride.dropoff_lng &&
      !notifiedRef.current.dropoff
    ) {
      const dist = haversineMeters(pos.lat, pos.lng, ride.dropoff_lat, ride.dropoff_lng);
      if (dist <= ARRIVAL_RADIUS_M) {
        notifiedRef.current.dropoff = true;
        notify(ride.id, "dropoff");
      }
    }
  }, [ride, isPetRide, pos, notify]);
};
