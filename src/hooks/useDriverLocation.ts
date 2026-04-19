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

    // Heartbeat: every 60s, refresh last_seen_at via a benign update so the
    // server-side cron doesn't mark this driver offline. If GPS is allowed, we
    // re-write the live position; if denied, we call a SECURITY DEFINER RPC
    // that touches last_seen_at directly.
    heartbeatRef.current = window.setInterval(() => {
      if (!("geolocation" in navigator)) {
        supabase.rpc("touch_driver_seen").then(() => undefined);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        updateLocation,
        () => {
          // GPS denied/unavailable — touch last_seen_at via RPC so the
          // auto-offline cron doesn't kick this driver offline.
          supabase.rpc("touch_driver_seen").then(() => undefined);
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
