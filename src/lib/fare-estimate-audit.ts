import { supabase } from "@/integrations/supabase/client";

export type FareEstimateEventType = "estimate_changed" | "submit_blocked_stale";

export interface FareEstimateAuditPayload {
  riderProfileId: string;
  eventType: FareEstimateEventType;
  serviceType?: string | null;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  stopCount?: number;
  distanceKm?: number | null;
  estimatedFareCents?: number | null;
  fareInputsKey: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records a fare-estimate audit row. Failures are logged but never thrown —
 * audit loss must never block a rider's booking flow.
 */
export async function logFareEstimateEvent(payload: FareEstimateAuditPayload): Promise<void> {
  try {
    const { error } = await supabase.from("fare_estimate_audit_log" as any).insert({
      rider_profile_id: payload.riderProfileId,
      event_type: payload.eventType,
      service_type: payload.serviceType ?? null,
      pickup_address: payload.pickupAddress ?? null,
      dropoff_address: payload.dropoffAddress ?? null,
      pickup_lat: payload.pickupLat ?? null,
      pickup_lng: payload.pickupLng ?? null,
      dropoff_lat: payload.dropoffLat ?? null,
      dropoff_lng: payload.dropoffLng ?? null,
      stop_count: payload.stopCount ?? 0,
      distance_km: payload.distanceKm ?? null,
      estimated_fare_cents: payload.estimatedFareCents ?? null,
      fare_inputs_key: payload.fareInputsKey,
      metadata: payload.metadata ?? {},
    } as any);
    if (error) console.warn("[fare-audit] insert failed:", error.message);
  } catch (err) {
    console.warn("[fare-audit] unexpected error:", err);
  }
}
