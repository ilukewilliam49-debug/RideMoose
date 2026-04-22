import { supabase } from "@/integrations/supabase/client";

export type ShiftEventType = "online" | "offline" | "auto_capped";
export type ShiftEventSource = "driver_app" | "system_reaper" | "client_cap";

/**
 * Records a driver shift transition for the regulatory audit log.
 *
 * Writes are best-effort: any failure is logged to the console but never
 * blocks the driver-facing UI flow that triggered it.
 */
export async function logDriverShiftEvent(params: {
  driverId: string;
  eventType: ShiftEventType;
  shiftSessionId?: string | null;
  shiftStartedAt?: string | null;
  source?: ShiftEventSource;
  metadata?: Record<string, unknown>;
}) {
  try {
    const startedAt = params.shiftStartedAt
      ? new Date(params.shiftStartedAt)
      : null;
    const durationMinutes = startedAt
      ? Math.max(
          0,
          Math.round((Date.now() - startedAt.getTime()) / 60_000)
        )
      : null;

    await supabase.from("driver_shift_events" as any).insert({
      driver_id: params.driverId,
      event_type: params.eventType,
      shift_session_id: params.shiftSessionId ?? null,
      shift_started_at: params.shiftStartedAt ?? null,
      shift_duration_minutes: durationMinutes,
      source: params.source ?? "driver_app",
      metadata: params.metadata ?? {},
    } as any);
  } catch (err) {
    console.error("[shift-events] failed to log", params.eventType, err);
  }
}
