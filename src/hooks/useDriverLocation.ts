import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks the current driver's GPS location and updates their profile
 * in the database every `intervalMs` milliseconds.
 *
 * Also pushes a periodic heartbeat (last_seen_at) every 60s so the server
 * can mark a driver offline if their tab/PWA dies without a clean toggle.
 */
export const useDriverLocation = (
  profileId: string | undefined,
  isActive: boolean,
  intervalMs = 10000,
  hasActiveRide = false
) => {
  const watchRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  useEffect(() => {
    if (!profileId || (!isActive && !hasActiveRide)) return;

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

    if ("geolocation" in navigator) {
      watchRef.current = navigator.geolocation.watchPosition(
        updateLocation,
        (err) => console.warn("Geolocation error:", err.message),
        { enableHighAccuracy: true, maximumAge: intervalMs, timeout: 15000 }
      );
    }

    // Heartbeat: every 60s, write a no-op coordinate to refresh last_seen_at.
    // We re-write the existing latitude (which trips the trigger on change),
    // so we instead just force the trigger by writing a tiny jitter when needed.
    // Simpler: poll a single position read and reuse updateLocation.
    heartbeatRef.current = window.setInterval(() => {
      if (!("geolocation" in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        updateLocation,
        () => {
          // If GPS denied, still touch last_seen_at via a benign update so the
          // server-side cron doesn't mark this driver offline.
          supabase
            .from("profiles")
            .update({ updated_at: new Date().toISOString() } as never)
            .eq("id", profileId)
            .then(() => undefined);
        },
        { enableHighAccuracy: false, maximumAge: 30_000, timeout: 10_000 }
      );
    }, 60_000);

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      if (heartbeatRef.current !== null) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [profileId, isActive, hasActiveRide, intervalMs]);
};
