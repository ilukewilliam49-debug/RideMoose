import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks the current driver's GPS location and updates their profile
 * in the database every `intervalMs` milliseconds.
 */
export const useDriverLocation = (profileId: string | undefined, isActive: boolean, intervalMs = 10000) => {
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profileId || !isActive) return;

    const updateLocation = (pos: GeolocationPosition) => {
      supabase
        .from("profiles")
        .update({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
        .eq("id", profileId)
        .then(({ error }) => {
          if (error) console.error("Location update failed:", error.message);
        });
    };

    // Use watchPosition for continuous tracking
    if ("geolocation" in navigator) {
      watchRef.current = navigator.geolocation.watchPosition(
        updateLocation,
        (err) => console.warn("Geolocation error:", err.message),
        { enableHighAccuracy: true, maximumAge: intervalMs, timeout: 15000 }
      );
    }

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [profileId, isActive, intervalMs]);
};
