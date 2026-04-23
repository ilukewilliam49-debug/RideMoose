/**
 * update-meter
 *
 * Single server-authoritative endpoint for a driver's taxi meter to push
 * distance/waiting telemetry. Locked-down RLS prevents drivers from
 * writing `distance_km` and `waiting_min` directly (audit C2).
 *
 * Actions:
 *   • action: "start"   – set meter_status='running', meter_started_at, status='in_progress',
 *                         distance_km=0, waiting_min=0
 *   • action: "tick"    – update distance_km / waiting_min (clamped, monotonic)
 *   • action: "stop"    – set meter_status='completed', meter_ended_at, final telemetry
 *
 * The server enforces:
 *   - Caller is the assigned driver (or admin)
 *   - distance_km is monotonically non-decreasing (drivers can't reduce it
 *     to lower the fare, and can't jump it by an absurd amount per call)
 *   - waiting_min is monotonically non-decreasing
 *   - hard ceilings catch obvious tampering
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Sanity ceilings — Yellowknife is a small city; a single ride should
// never exceed these. They prevent runaway meter tampering.
const MAX_DISTANCE_KM = 500;
const MAX_WAITING_MIN = 600; // 10 hours
// Per-call delta caps. The client is supposed to push every ~12s, so
// a 50 km jump in one call is implausible and gets rejected.
const MAX_DELTA_DISTANCE_KM = 50;
const MAX_DELTA_WAITING_MIN = 30;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    let body: {
      ride_id?: unknown;
      action?: unknown;
      distance_km?: unknown;
      waiting_min?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const ride_id = typeof body.ride_id === "string" ? body.ride_id : null;
    const action = typeof body.action === "string" ? body.action : null;
    if (!ride_id || !/^[0-9a-f-]{36}$/i.test(ride_id)) {
      return json({ error: "ride_id must be a valid UUID" }, 400);
    }
    if (!action || !["start", "tick", "stop"].includes(action)) {
      return json({ error: "action must be start|tick|stop" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return json({ error: "Profile not found" }, 404);

    const { data: ride, error: rideErr } = await admin
      .from("rides")
      .select("id, driver_id, status, distance_km, waiting_min, meter_status")
      .eq("id", ride_id)
      .maybeSingle();
    if (rideErr || !ride) return json({ error: "Ride not found" }, 404);

    if (ride.driver_id !== profile.id) {
      return json({ error: "Not your ride" }, 403);
    }

    const now = new Date().toISOString();

    if (action === "start") {
      if (!["accepted", "arrived"].includes(ride.status)) {
        return json({ error: "Ride is not ready to start" }, 409);
      }
      const { error } = await admin
        .from("rides")
        .update({
          status: "in_progress",
          started_at: now,
          meter_status: "running",
          meter_started_at: now,
          distance_km: 0,
          waiting_min: 0,
        })
        .eq("id", ride_id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, ride_id });
    }

    if (action === "tick" || action === "stop") {
      if (ride.status !== "in_progress") {
        return json({ error: "Meter is not running" }, 409);
      }

      const newDistance = numberOrNull(body.distance_km);
      const newWaiting = numberOrNull(body.waiting_min);
      if (newDistance == null || newWaiting == null) {
        return json({ error: "distance_km and waiting_min required" }, 400);
      }
      if (newDistance < 0 || newWaiting < 0) {
        return json({ error: "Telemetry must be non-negative" }, 400);
      }
      if (newDistance > MAX_DISTANCE_KM || newWaiting > MAX_WAITING_MIN) {
        return json({ error: "Telemetry exceeds sanity ceiling" }, 400);
      }

      const prevDistance = Number(ride.distance_km ?? 0);
      const prevWaiting = Number(ride.waiting_min ?? 0);
      // Monotonic check (allow small clock-jitter rollback up to 0.05 km / 0.1 min)
      if (newDistance + 0.05 < prevDistance) {
        return json({ error: "distance_km cannot decrease" }, 400);
      }
      if (newWaiting + 0.1 < prevWaiting) {
        return json({ error: "waiting_min cannot decrease" }, 400);
      }
      // Per-call delta cap
      if (newDistance - prevDistance > MAX_DELTA_DISTANCE_KM) {
        return json({ error: "distance_km delta too large" }, 400);
      }
      if (newWaiting - prevWaiting > MAX_DELTA_WAITING_MIN) {
        return json({ error: "waiting_min delta too large" }, 400);
      }

      const update: Record<string, unknown> = {
        distance_km: Math.round(newDistance * 1000) / 1000,
        waiting_min: Math.round(newWaiting * 100) / 100,
      };
      if (action === "stop") {
        update.meter_status = "completed";
        update.meter_ended_at = now;
        // Note: we do NOT set status='completed' here — that's complete-ride's job,
        // which also runs the geofence/payment capture flow.
      }

      const { error } = await admin.from("rides").update(update).eq("id", ride_id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, ride_id });
    }

    return json({ error: "Unhandled action" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[update-meter] error:", msg);
    return json({ error: msg }, 500);
  }
});

function numberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
