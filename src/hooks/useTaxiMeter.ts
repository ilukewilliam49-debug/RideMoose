import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TaxiRates {
  base_fare_cents: number;
  per_km_cents: number;
  per_min_cents: number;
  waiting_per_min_cents: number;
}

interface MeterState {
  status: "idle" | "running" | "paused" | "completed";
  distanceKm: number;
  durationMin: number;
  waitingMin: number;
  liveFareCents: number;
  receipt: FareReceipt | null;
}

export interface FareReceipt {
  baseFare: number;
  distanceCharge: number;
  movingCharge: number;
  waitingCharge: number;
  totalCents: number;
  distanceKm: number;
  durationMin: number;
  waitingMin: number;
  movingMin: number;
}

const SPEED_THRESHOLD_KMH = 10;
const DB_SYNC_INTERVAL = 15_000;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useTaxiMeter(rideId: string | undefined, meterStatusFromDb: string | undefined) {
  const queryClient = useQueryClient();
  const [rates, setRates] = useState<TaxiRates | null>(null);
  const [state, setState] = useState<MeterState>({
    status: "idle",
    distanceKm: 0,
    durationMin: 0,
    waitingMin: 0,
    liveFareCents: 0,
    receipt: null,
  });

  const lastPos = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const distRef = useRef(0);
  const waitRef = useRef(0);
  const startedAt = useRef<Date | null>(null);
  const watchId = useRef<number | null>(null);
  const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isWaiting = useRef(false);

  // Load rates
  useEffect(() => {
    supabase
      .from("taxi_rates")
      .select("*")
      .eq("active", true)
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (data && !error) setRates(data as unknown as TaxiRates);
      });
  }, []);

  // Sync initial meter_status from DB
  useEffect(() => {
    if (meterStatusFromDb === "completed") {
      setState((s) => ({ ...s, status: "completed" }));
    } else if (meterStatusFromDb === "running") {
      setState((s) => ({ ...s, status: "running" }));
    }
  }, [meterStatusFromDb]);

  const computeFare = useCallback(
    (dist: number, durMin: number, waitMin: number): number => {
      if (!rates) return 0;
      const movingMin = Math.max(durMin - waitMin, 0);
      return (
        rates.base_fare_cents +
        Math.round(dist * rates.per_km_cents) +
        Math.round(movingMin * rates.per_min_cents) +
        Math.round(waitMin * rates.waiting_per_min_cents)
      );
    },
    [rates]
  );

  const computeReceipt = useCallback(
    (dist: number, durMin: number, waitMin: number): FareReceipt | null => {
      if (!rates) return null;
      const movingMin = Math.max(durMin - waitMin, 0);
      return {
        baseFare: rates.base_fare_cents,
        distanceCharge: Math.round(dist * rates.per_km_cents),
        movingCharge: Math.round(movingMin * rates.per_min_cents),
        waitingCharge: Math.round(waitMin * rates.waiting_per_min_cents),
        totalCents:
          rates.base_fare_cents +
          Math.round(dist * rates.per_km_cents) +
          Math.round(movingMin * rates.per_min_cents) +
          Math.round(waitMin * rates.waiting_per_min_cents),
        distanceKm: dist,
        durationMin: durMin,
        waitingMin: waitMin,
        movingMin,
      };
    },
    [rates]
  );

  // Live tick: update duration + fare every second
  const startTick = useCallback(() => {
    if (tickInterval.current) return;
    tickInterval.current = setInterval(() => {
      if (!startedAt.current) return;
      const durMin = (Date.now() - startedAt.current.getTime()) / 60_000;
      const fare = computeFare(distRef.current, durMin, waitRef.current);
      setState((s) => ({
        ...s,
        durationMin: durMin,
        distanceKm: distRef.current,
        waitingMin: waitRef.current,
        liveFareCents: fare,
      }));
    }, 1000);
  }, [computeFare]);

  const stopTick = useCallback(() => {
    if (tickInterval.current) {
      clearInterval(tickInterval.current);
      tickInterval.current = null;
    }
  }, []);

  // Geolocation tracking
  const startGeo = useCallback(() => {
    if (watchId.current !== null) return;
    if (!navigator.geolocation) {
      toast.error("Geolocation not available");
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const now = Date.now();

        if (lastPos.current) {
          const dt = (now - lastPos.current.time) / 60_000; // minutes
          const dd = haversineKm(lastPos.current.lat, lastPos.current.lng, latitude, longitude);

          // Filter out GPS noise (>150km/h or <2m)
          const speedKmh = dd / (dt / 60);
          if (dd > 0.002 && speedKmh < 150) {
            distRef.current += dd;
          }

          // Auto-detect waiting: speed < threshold
          const reportedSpeedKmh = speed !== null ? speed * 3.6 : speedKmh;
          if (reportedSpeedKmh < SPEED_THRESHOLD_KMH) {
            if (!isWaiting.current) isWaiting.current = true;
            waitRef.current += dt;
          } else {
            isWaiting.current = false;
          }
        }

        lastPos.current = { lat: latitude, lng: longitude, time: now };
      },
      (err) => {
        console.error("Geo error:", err);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, []);

  const stopGeo = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  // DB sync
  const syncToDb = useCallback(async () => {
    if (!rideId) return;
    await supabase
      .from("rides")
      .update({
        distance_km: Math.round(distRef.current * 1000) / 1000,
        duration_min: Math.round(((Date.now() - (startedAt.current?.getTime() ?? Date.now())) / 60_000) * 100) / 100,
        waiting_min: Math.round(waitRef.current * 100) / 100,
      })
      .eq("id", rideId);
  }, [rideId]);

  const startDbSync = useCallback(() => {
    if (syncInterval.current) return;
    syncInterval.current = setInterval(syncToDb, DB_SYNC_INTERVAL);
  }, [syncToDb]);

  const stopDbSync = useCallback(() => {
    if (syncInterval.current) {
      clearInterval(syncInterval.current);
      syncInterval.current = null;
    }
  }, []);

  // === Actions ===

  const startMeter = useCallback(async () => {
    if (!rideId) return;
    const now = new Date();
    startedAt.current = now;
    distRef.current = 0;
    waitRef.current = 0;
    lastPos.current = null;

    const { error } = await supabase
      .from("rides")
      .update({
        meter_status: "running",
        meter_started_at: now.toISOString(),
        status: "in_progress",
        started_at: now.toISOString(),
        distance_km: 0,
        duration_min: 0,
        waiting_min: 0,
      })
      .eq("id", rideId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setState((s) => ({ ...s, status: "running", distanceKm: 0, durationMin: 0, waitingMin: 0, liveFareCents: 0, receipt: null }));
    startGeo();
    startTick();
    startDbSync();
    queryClient.invalidateQueries({ queryKey: ["active-ride"] });
  }, [rideId, startGeo, startTick, startDbSync, queryClient]);

  const endMeter = useCallback(async () => {
    if (!rideId || !startedAt.current) return;

    stopGeo();
    stopTick();
    stopDbSync();

    const now = new Date();
    const durMin = (now.getTime() - startedAt.current.getTime()) / 60_000;
    const dist = distRef.current;
    const wait = waitRef.current;

    const receipt = computeReceipt(dist, durMin, wait);
    if (!receipt) {
      toast.error("Could not compute fare");
      return;
    }

    const { error } = await supabase
      .from("rides")
      .update({
        meter_status: "completed",
        meter_ended_at: now.toISOString(),
        status: "completed",
        completed_at: now.toISOString(),
        distance_km: Math.round(dist * 1000) / 1000,
        duration_min: Math.round(durMin * 100) / 100,
        waiting_min: Math.round(wait * 100) / 100,
        final_fare_cents: receipt.totalCents,
        final_price: receipt.totalCents / 100,
      })
      .eq("id", rideId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setState((s) => ({ ...s, status: "completed", receipt, durationMin: durMin, distanceKm: dist, waitingMin: wait, liveFareCents: receipt.totalCents }));
    queryClient.invalidateQueries({ queryKey: ["active-ride"] });
    toast.success("Meter stopped – ride complete!");
  }, [rideId, stopGeo, stopTick, stopDbSync, computeReceipt, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGeo();
      stopTick();
      stopDbSync();
    };
  }, [stopGeo, stopTick, stopDbSync]);

  return { state, rates, startMeter, endMeter };
}
