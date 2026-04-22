import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  computeFare as computeBylawFare,
  modeForServiceType,
  type BylawRates,
  type FareBreakdown,
  FALLBACK_BYLAW_RATES,
} from "@/lib/pricing";

interface MeterState {
  status: "idle" | "running" | "paused" | "completed";
  distanceKm: number;
  waitingMin: number;
  isWaiting: boolean;
  liveFareCents: number;
  receipt: FareReceipt | null;
}

/**
 * Receipt shape preserved for backwards compatibility with existing UI.
 * Fields map to the bylaw breakdown.
 */
export interface FareReceipt {
  baseFare: number;
  distanceCharge: number;
  waitingCharge: number;
  freeWaitingMin: number;
  billableWaitingMin: number;
  grossFareCents: number;       // = subtotalCents (flag + distance + wait + surcharges)
  serviceFeeCents: number;      // = PickYou platform fee ($0.97), 0 for Taxi
  surchargeCents: number;       // large vehicle + pickup/delivery
  taxCents: number;             // 5% GST on PickYou only
  totalCents: number;
  distanceKm: number;
  totalWaitingMin: number;
  breakdown: FareBreakdown;
}

const DB_SYNC_INTERVAL = 12_000;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface UseTaxiMeterOptions {
  largeVehicle?: boolean;
  accessibilityRequired?: boolean;
  pickupDeliveryNoPassenger?: boolean;
}

export function useTaxiMeter(
  rideId: string | undefined,
  meterStatusFromDb: string | undefined,
  serviceType?: string,
  options: UseTaxiMeterOptions = {}
) {
  const queryClient = useQueryClient();
  const [rates, setRates] = useState<BylawRates | null>(null);
  const [state, setState] = useState<MeterState>({
    status: "idle",
    distanceKm: 0,
    waitingMin: 0,
    isWaiting: false,
    liveFareCents: 0,
    receipt: null,
  });

  const lastPos = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const distRef = useRef(0);
  const waitRef = useRef(0);
  const waitingOn = useRef(false);
  const waitingStartedAt = useRef<number | null>(null);
  const watchId = useRef<number | null>(null);
  const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const fareMode = modeForServiceType(serviceType ?? "") ?? "taxi";
  const { largeVehicle, accessibilityRequired, pickupDeliveryNoPassenger } = options;

  // Load bylaw rates
  useEffect(() => {
    supabase
      .from("taxi_rates")
      .select("*")
      .eq("active", true)
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          setRates({
            base_fare_cents: data.base_fare_cents,
            included_meters: (data as any).included_meters ?? FALLBACK_BYLAW_RATES.included_meters,
            per_increment_cents: (data as any).per_increment_cents ?? FALLBACK_BYLAW_RATES.per_increment_cents,
            increment_meters: (data as any).increment_meters ?? FALLBACK_BYLAW_RATES.increment_meters,
            waiting_per_min_cents: data.waiting_per_min_cents,
            free_waiting_min: (data as any).free_waiting_min ?? FALLBACK_BYLAW_RATES.free_waiting_min,
            large_vehicle_surcharge_cents: (data as any).large_vehicle_surcharge_cents ?? FALLBACK_BYLAW_RATES.large_vehicle_surcharge_cents,
            pickup_delivery_surcharge_cents: (data as any).pickup_delivery_surcharge_cents ?? FALLBACK_BYLAW_RATES.pickup_delivery_surcharge_cents,
            pickyou_platform_fee_cents: (data as any).pickyou_platform_fee_cents ?? FALLBACK_BYLAW_RATES.pickyou_platform_fee_cents,
            pickyou_gst_rate: Number((data as any).pickyou_gst_rate ?? FALLBACK_BYLAW_RATES.pickyou_gst_rate),
          });
        } else {
          setRates(FALLBACK_BYLAW_RATES);
        }
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
    (dist: number, waitMin: number): number => {
      if (!rates) return 0;
      return computeBylawFare(fareMode, rates, {
        distanceKm: dist,
        waitingMin: waitMin,
        largeVehicle,
        accessibilityRequired,
        pickupDeliveryNoPassenger,
      }).totalCents;
    },
    [rates, fareMode, largeVehicle, accessibilityRequired, pickupDeliveryNoPassenger]
  );

  const computeReceipt = useCallback(
    (dist: number, waitMin: number): FareReceipt | null => {
      if (!rates) return null;
      const breakdown = computeBylawFare(fareMode, rates, {
        distanceKm: dist,
        waitingMin: waitMin,
        largeVehicle,
        accessibilityRequired,
        pickupDeliveryNoPassenger,
      });

      return {
        baseFare: breakdown.baseFareCents,
        distanceCharge: breakdown.distanceChargeCents,
        waitingCharge: breakdown.waitingChargeCents,
        freeWaitingMin: breakdown.freeWaitingMin,
        billableWaitingMin: breakdown.billableWaitingMin,
        grossFareCents: breakdown.subtotalCents,
        serviceFeeCents: breakdown.platformFeeCents,
        surchargeCents:
          breakdown.largeVehicleSurchargeCents +
          breakdown.pickupDeliverySurchargeCents,
        taxCents: breakdown.taxCents,
        totalCents: breakdown.totalCents,
        distanceKm: dist,
        totalWaitingMin: waitMin,
        breakdown,
      };
    },
    [rates, fareMode, largeVehicle, accessibilityRequired, pickupDeliveryNoPassenger]
  );

  // Live tick: update fare every second
  const startTick = useCallback(() => {
    if (tickInterval.current) return;
    tickInterval.current = setInterval(() => {
      const totalWait = waitRef.current + (waitingOn.current && waitingStartedAt.current
        ? (Date.now() - waitingStartedAt.current) / 60_000
        : 0);
      const fare = computeFare(distRef.current, totalWait);
      setState((s) => ({
        ...s,
        distanceKm: distRef.current,
        waitingMin: totalWait,
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

  // Toggle waiting
  const toggleWaiting = useCallback(() => {
    if (waitingOn.current) {
      if (waitingStartedAt.current) {
        waitRef.current += (Date.now() - waitingStartedAt.current) / 60_000;
      }
      waitingStartedAt.current = null;
      waitingOn.current = false;
      setState((s) => ({ ...s, isWaiting: false }));
    } else {
      waitingStartedAt.current = Date.now();
      waitingOn.current = true;
      setState((s) => ({ ...s, isWaiting: true }));
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
        const { latitude, longitude } = pos.coords;
        const now = Date.now();

        if (lastPos.current) {
          const dt = (now - lastPos.current.time) / 60_000;
          const dd = haversineKm(lastPos.current.lat, lastPos.current.lng, latitude, longitude);
          const speedKmh = dd / (dt / 60);
          if (dd > 0.002 && speedKmh < 150) {
            distRef.current += dd;
          }
        }

        lastPos.current = { lat: latitude, lng: longitude, time: now };
      },
      (err) => console.error("Geo error:", err),
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
    const totalWait = waitRef.current + (waitingOn.current && waitingStartedAt.current
      ? (Date.now() - waitingStartedAt.current) / 60_000
      : 0);
    await supabase
      .from("rides")
      .update({
        distance_km: Math.round(distRef.current * 1000) / 1000,
        waiting_min: Math.round(totalWait * 100) / 100,
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
    distRef.current = 0;
    waitRef.current = 0;
    waitingOn.current = false;
    waitingStartedAt.current = null;
    lastPos.current = null;

    const { error } = await supabase
      .from("rides")
      .update({
        meter_status: "running",
        meter_started_at: now.toISOString(),
        status: "in_progress",
        started_at: now.toISOString(),
        distance_km: 0,
        waiting_min: 0,
      })
      .eq("id", rideId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setState((s) => ({ ...s, status: "running", distanceKm: 0, waitingMin: 0, isWaiting: false, liveFareCents: 0, receipt: null }));
    startGeo();
    startTick();
    startDbSync();
    queryClient.invalidateQueries({ queryKey: ["active-ride"] });
  }, [rideId, startGeo, startTick, startDbSync, queryClient]);

  const endMeter = useCallback(async () => {
    if (!rideId) return;

    stopGeo();
    stopTick();
    stopDbSync();

    // Finalize waiting
    if (waitingOn.current && waitingStartedAt.current) {
      waitRef.current += (Date.now() - waitingStartedAt.current) / 60_000;
      waitingOn.current = false;
      waitingStartedAt.current = null;
    }

    const now = new Date();
    const dist = distRef.current;
    const wait = waitRef.current;

    const receipt = computeReceipt(dist, wait);
    if (!receipt) {
      toast.error("Could not compute fare");
      return;
    }

    // SECURITY: Drivers cannot write financial columns directly (RLS-locked).
    // Only operational meter fields are updated here; capture-payment will
    // recompute final_fare_cents, final_price, tax_cents, service_fee_cents
    // from authoritative taxi_rates × distance_km on the server.
    const { error } = await supabase
      .from("rides")
      .update({
        meter_status: "completed",
        meter_ended_at: now.toISOString(),
        status: "completed",
        completed_at: now.toISOString(),
        distance_km: Math.round(dist * 1000) / 1000,
        waiting_min: Math.round(wait * 100) / 100,
      })
      .eq("id", rideId);

    if (error) {
      toast.error(error.message);
      return;
    }

    setState((s) => ({ ...s, status: "completed", receipt, distanceKm: dist, waitingMin: wait, isWaiting: false, liveFareCents: receipt.totalCents }));
    queryClient.invalidateQueries({ queryKey: ["active-ride"] });

    // Attempt to capture payment
    try {
      const { error: captureError } = await supabase.functions.invoke(
        "capture-payment",
        { body: { ride_id: rideId } }
      );
      if (captureError) {
        console.error("Capture error:", captureError);
      }
      toast.success("Meter stopped – ride complete!");
    } catch (e) {
      console.error("Payment capture failed:", e);
      toast.success("Meter stopped – ride complete! Payment will be processed.");
    }
  }, [rideId, stopGeo, stopTick, stopDbSync, computeReceipt, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGeo();
      stopTick();
      stopDbSync();
    };
  }, [stopGeo, stopTick, stopDbSync]);

  return { state, rates, startMeter, endMeter, toggleWaiting };
}
