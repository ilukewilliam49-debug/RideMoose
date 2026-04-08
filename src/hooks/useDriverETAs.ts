import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DriverCoord {
  id: string;
  latitude: number;
  longitude: number;
}

interface ETAResult {
  duration_text: string;
  duration_sec: number;
  traffic: boolean; // true if traffic-aware
}

type ETAMap = Record<string, ETAResult>;

// Haversine fallback
function haversineEta(lat1: number, lng1: number, lat2: number, lng2: number): ETAResult {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1.3;
  const mins = Math.max(1, Math.round((distKm / 30) * 60));
  return {
    duration_text: mins < 2 ? "~1 min" : `~${mins} min`,
    duration_sec: mins * 60,
    traffic: false,
  };
}

/**
 * Fetches live traffic-based ETAs for a list of drivers relative to the user's location.
 * Falls back to Haversine estimate if the API call fails.
 * Re-fetches every 30 seconds.
 */
export function useDriverETAs(
  drivers: DriverCoord[],
  userLocation: { lat: number; lng: number } | null
): ETAMap {
  const [etas, setEtas] = useState<ETAMap>({});
  const cacheRef = useRef<Record<string, { eta: ETAResult; ts: number }>>({});
  const abortRef = useRef<AbortController | null>(null);

  const fetchETAs = useCallback(async () => {
    if (!userLocation || drivers.length === 0) {
      setEtas({});
      return;
    }

    const CACHE_TTL = 25_000; // 25s cache to avoid redundant calls
    const now = Date.now();
    const result: ETAMap = {};
    const toFetch: DriverCoord[] = [];

    // Check cache first
    for (const d of drivers) {
      const cached = cacheRef.current[d.id];
      if (cached && now - cached.ts < CACHE_TTL) {
        result[d.id] = cached.eta;
      } else {
        toFetch.push(d);
      }
    }

    // Fetch uncached ETAs in parallel (max 5 concurrent to be nice to the API)
    if (toFetch.length > 0) {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const batchSize = 5;
      for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        const promises = batch.map(async (d) => {
          try {
            const { data, error } = await supabase.functions.invoke("directions", {
              body: {
                origin_lat: d.latitude,
                origin_lng: d.longitude,
                dest_lat: userLocation.lat,
                dest_lng: userLocation.lng,
              },
            });

            if (error || !data?.duration_in_traffic_text) {
              throw new Error("API error");
            }

            const eta: ETAResult = {
              duration_text: data.duration_in_traffic_text,
              duration_sec: data.duration_in_traffic_sec,
              traffic: true,
            };
            cacheRef.current[d.id] = { eta, ts: Date.now() };
            return { id: d.id, eta };
          } catch {
            // Fallback to Haversine
            const eta = haversineEta(d.latitude, d.longitude, userLocation.lat, userLocation.lng);
            cacheRef.current[d.id] = { eta, ts: Date.now() };
            return { id: d.id, eta };
          }
        });

        const results = await Promise.all(promises);
        for (const r of results) {
          result[r.id] = r.eta;
        }
      }
    }

    if (!abortRef.current?.signal.aborted) {
      setEtas(result);
    }
  }, [drivers, userLocation]);

  // Fetch on mount and every 30s
  useEffect(() => {
    fetchETAs();
    const interval = setInterval(fetchETAs, 30_000);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchETAs]);

  return etas;
}
