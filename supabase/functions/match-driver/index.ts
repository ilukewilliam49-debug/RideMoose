import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISPATCH_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 3_000;
const MAX_CANDIDATES = 3;
const CITY_SPEED_KMH = 30;

// Rate-limit: max 3 calls per user per 60 seconds
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count++;
  return { allowed: true };
}

// Periodically clean up expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now >= val.resetAt) rateLimitMap.delete(key);
  }
}, 60_000);

// Input validation schema
const RequestBody = z.object({
  ride_id: z.string().uuid("ride_id must be a valid UUID"),
});

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Map service_type → profile capability filter */
function serviceFilter(serviceType: string): Record<string, any> {
  switch (serviceType) {
    case "taxi": return { can_taxi: true };
    case "private_hire": return { can_private_hire: true };
    case "shuttle": return { can_shuttle: true };
    case "courier":
    case "retail_delivery":
    case "personal_shopper": return { can_courier: true };
    case "large_delivery": return { vehicle_type_in: ["SUV", "truck", "van"] };
    default: return { can_taxi: true };
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Validate input ---
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const parsed = RequestBody.safeParse(body);
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { ride_id } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    // --- Authenticate caller ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const callerUserId = userData.user.id;

    // --- Rate-limit ---
    const rl = checkRateLimit(callerUserId);
    if (!rl.allowed) {
      return jsonResponse(
        { error: "Too many requests. Try again later.", retry_after_ms: rl.retryAfterMs },
        429
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch ride
    const { data: ride, error: rideErr } = await admin
      .from("rides")
      .select("*")
      .eq("id", ride_id)
      .single();

    if (rideErr || !ride) {
      return jsonResponse({ error: "Ride not found" }, 404);
    }

    // Verify ownership
    const { data: riderProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", callerUserId)
      .single();
    if (!riderProfile || riderProfile.id !== ride.rider_id) {
      return jsonResponse({ error: "Unauthorized" }, 403);
    }

    if (!ride.pickup_lat || !ride.pickup_lng) {
      return jsonResponse({ error: "Ride has no pickup coordinates" }, 400);
    }

    // Find eligible drivers
    const filters = serviceFilter(ride.service_type);
    let query = admin
      .from("profiles")
      .select("id, latitude, longitude, full_name")
      .eq("role", "driver")
      .eq("is_available", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (filters.vehicle_type_in) {
      query = query.in("vehicle_type", filters.vehicle_type_in);
    } else {
      for (const [key, val] of Object.entries(filters)) {
        query = query.eq(key, val);
      }
    }

    const { data: drivers } = await query;
    if (!drivers || drivers.length === 0) {
      return jsonResponse({ matched: false, reason: "no_drivers_available" });
    }

    // Calculate distances and sort
    const ranked = drivers
      .map((d) => ({
        ...d,
        distance_km: haversineKm(
          ride.pickup_lat!,
          ride.pickup_lng!,
          d.latitude!,
          d.longitude!
        ),
      }))
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, MAX_CANDIDATES);

    // Sequential dispatch
    for (let hopIndex = 0; hopIndex < ranked.length; hopIndex++) {
      const candidate = ranked[hopIndex];
      const dispatchedAt = new Date();
      const deadlineDate = new Date(dispatchedAt.getTime() + DISPATCH_TIMEOUT_MS);

      await admin.from("rides").update({
        status: "dispatched",
        dispatched_to_driver_id: candidate.id,
        dispatch_expires_at: deadlineDate.toISOString(),
      }).eq("id", ride_id);

      // ── Audit row #1: the dispatch attempt itself (target driver + hop). ──
      const { data: attemptRow } = await admin
        .from("notification_logs")
        .insert({
          event: "dispatch.attempt",
          method: "push",
          status: "pending",
          ride_id,
          target_profile_id: candidate.id,
          recipients: 1,
          metadata: {
            hop: hopIndex + 1,
            total_candidates: ranked.length,
            distance_km: Math.round(candidate.distance_km * 100) / 100,
            driver_name: candidate.full_name ?? null,
            dispatched_at: dispatchedAt.toISOString(),
            dispatch_expires_at: deadlineDate.toISOString(),
            service_type: ride.service_type,
          },
        })
        .select("id")
        .single();

      const attemptLogId = attemptRow?.id ?? null;

      // Fire urgent push + in-app notification to this specific driver via the
      // notifications service (handles push → SMS fallback + dedup + logging).
      let pushFailed = false;
      let pushErrorMessage: string | null = null;
      try {
        await admin.functions.invoke("send-push-notification", {
          body: {
            mode: "ride_event",
            event: "dispatched",
            ride_id,
            driver_profile_id: candidate.id,
          },
        });
      } catch (pushErr) {
        pushFailed = true;
        pushErrorMessage = (pushErr as Error)?.message ?? String(pushErr);
        console.warn(`[match-driver] dispatch push failed for ${candidate.id}:`, pushErr);
      }

      // Mark the attempt as delivered (push succeeded) before polling.
      if (attemptLogId) {
        await admin
          .from("notification_logs")
          .update({
            status: pushFailed ? "failed" : "delivered",
            error_message: pushErrorMessage,
          })
          .eq("id", attemptLogId);
      }

      let accepted = false;
      const deadline = Date.now() + DISPATCH_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const { data: updated } = await admin
          .from("rides")
          .select("status, driver_id")
          .eq("id", ride_id)
          .single();

        if (updated?.status === "accepted" && updated?.driver_id === candidate.id) {
          accepted = true;
          break;
        }
        if (updated?.status === "cancelled") {
          // Audit row #2: outcome = ride_cancelled mid-fan-out
          await admin.from("notification_logs").insert({
            event: "dispatch.outcome",
            method: "none",
            status: "skipped",
            ride_id,
            target_profile_id: candidate.id,
            recipients: 0,
            metadata: {
              hop: hopIndex + 1,
              outcome: "ride_cancelled",
              attempt_log_id: attemptLogId,
            },
          });
          return jsonResponse({ matched: false, reason: "ride_cancelled" });
        }
      }

      // ── Audit row #2: outcome of this hop (accepted vs timeout/decline). ──
      const respondedAt = new Date();
      const responseLatencyMs = respondedAt.getTime() - dispatchedAt.getTime();
      await admin.from("notification_logs").insert({
        event: "dispatch.outcome",
        method: "none",
        status: accepted ? "delivered" : "skipped",
        ride_id,
        target_profile_id: candidate.id,
        recipients: 0,
        completed_at: respondedAt.toISOString(),
        metadata: {
          hop: hopIndex + 1,
          outcome: accepted ? "accepted" : "timeout_or_decline",
          attempt_log_id: attemptLogId,
          response_latency_ms: responseLatencyMs,
        },
      });

      if (accepted) {
        await admin.from("rides").update({
          dispatched_to_driver_id: null,
          dispatch_expires_at: null,
        }).eq("id", ride_id);

        let etaSeconds = Math.round((candidate.distance_km / CITY_SPEED_KMH) * 3600);
        let etaText = `${Math.round(etaSeconds / 60)} min`;
        let distanceKm = candidate.distance_km;

        if (googleKey && candidate.latitude && candidate.longitude) {
          try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${candidate.latitude},${candidate.longitude}&destination=${ride.pickup_lat},${ride.pickup_lng}&departure_time=now&key=${googleKey}`;
            const resp = await fetch(url);
            const json = await resp.json();
            if (json.routes?.[0]?.legs?.[0]) {
              const leg = json.routes[0].legs[0];
              etaSeconds = leg.duration_in_traffic?.value || leg.duration.value;
              etaText = leg.duration_in_traffic?.text || leg.duration.text;
              distanceKm = leg.distance.value / 1000;
            }
          } catch {
            // fallback to Haversine estimate
          }
        }

        return jsonResponse({
          matched: true,
          driver_id: candidate.id,
          driver_name: candidate.full_name,
          eta_seconds: etaSeconds,
          eta_text: etaText,
          distance_km: Math.round(distanceKm * 10) / 10,
        });
      }

      await admin.from("rides").update({
        dispatched_to_driver_id: null,
        dispatch_expires_at: null,
      }).eq("id", ride_id);
    }

    // No driver matched — reset ride
    await admin.from("rides").update({
      status: "requested",
      dispatched_to_driver_id: null,
      dispatch_expires_at: null,
    }).eq("id", ride_id);

    return jsonResponse({ matched: false, reason: "no_driver_accepted" });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});
