import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Input Schemas ──────────────────────────────────────────────────

const DirectSchema = z.object({
  mode: z.literal("direct"),
  player_id: z.string().min(1),
  message: z.string().min(1).max(500),
  heading: z.string().max(200).optional(),
  url: z.string().max(500).optional(),
});

const RideEventSchema = z.object({
  mode: z.literal("ride_event"),
  ride_id: z.string().uuid(),
  event: z.enum(["requested", "accepted", "arrived", "completed"]),
});

const TestSchema = z.object({ mode: z.literal("test") });

const RetrySchema = z.object({
  mode: z.literal("retry"),
  max_retries: z.number().int().min(1).max(5).optional(),
});

const BroadcastSchema = z.object({
  mode: z.literal("broadcast"),
  audience: z.enum(["drivers", "riders", "all"]),
  heading: z.string().min(1).max(200),
  message: z.string().min(1).max(500),
  url: z.string().max(500).optional(),
});

const RequestBody = z.discriminatedUnion("mode", [
  DirectSchema,
  RideEventSchema,
  TestSchema,
  RetrySchema,
  BroadcastSchema,
]);

// ── In-memory rate limiter (per-isolate) ──────────────────────────
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

function checkInMemoryRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// ── Helpers ────────────────────────────────────────────────────────

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface OneSignalPayload {
  app_id: string;
  include_player_ids: string[];
  headings: { en: string };
  contents: { en: string };
  url?: string;
}

// ── Logging helper ─────────────────────────────────────────────────

async function logNotification(
  supabase: any,
  params: {
    ride_id?: string;
    target_profile_id?: string;
    event: string;
    method: string;
    status: string;
    error_message?: string;
    onesignal_id?: string;
    recipients?: number;
    retry_count?: number;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from("notification_logs").insert({
      ride_id: params.ride_id || null,
      target_profile_id: params.target_profile_id || null,
      event: params.event,
      method: params.method,
      status: params.status,
      error_message: params.error_message || null,
      onesignal_id: params.onesignal_id || null,
      recipients: params.recipients || 0,
      retry_count: params.retry_count || 0,
      metadata: params.metadata || {},
      completed_at: ["delivered", "failed"].includes(params.status) ? new Date().toISOString() : null,
    });
  } catch (e: any) {
    console.error("Failed to write notification log:", e.message);
  }
}

// ── OneSignal batch push (up to 2000 player IDs per call) ──────────

async function sendOneSignalPushBatch(
  appId: string,
  apiKey: string,
  playerIds: string[],
  heading: string,
  message: string,
  url?: string
): Promise<{ success: boolean; recipients: number; onesignal_id?: string; error?: string }> {
  // OneSignal supports up to 2000 player IDs per request
  const BATCH_SIZE = 2000;
  let totalRecipients = 0;
  let lastId: string | undefined;
  let lastError: string | undefined;

  for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
    const batch = playerIds.slice(i, i + BATCH_SIZE);
    const payload: OneSignalPayload = {
      app_id: appId,
      include_player_ids: batch,
      headings: { en: heading },
      contents: { en: message },
    };
    if (url) payload.url = url;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Basic ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });
        const result = await resp.json();

        if (resp.ok) {
          totalRecipients += result.recipients || 0;
          lastId = result.id;
          break;
        }
        console.error(`OneSignal batch attempt ${attempt + 1} failed:`, JSON.stringify(result));
        if (attempt === 1) lastError = JSON.stringify(result);
      } catch (err: any) {
        console.error(`OneSignal batch attempt ${attempt + 1} exception:`, err.message);
        if (attempt === 1) lastError = err.message;
      }
    }
  }

  if (totalRecipients > 0 || !lastError) {
    return { success: true, recipients: totalRecipients, onesignal_id: lastId };
  }
  return { success: false, recipients: 0, error: lastError };
}

// ── SMS fallback via Twilio ────────────────────────────────────────

async function sendSmsFallback(phone: string, message: string): Promise<boolean> {
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!twilioSid || !twilioAuth || !twilioFrom || !phone) return false;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: phone, From: twilioFrom, Body: message }),
    });
    if (!resp.ok) {
      const data = await resp.json();
      console.error("Twilio SMS failed:", JSON.stringify(data));
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("Twilio SMS exception:", err.message);
    return false;
  }
}

// ── Notify a single user (push → SMS fallback) ────────────────────

async function notifyUser(
  supabase: any,
  appId: string,
  apiKey: string,
  profileId: string,
  heading: string,
  message: string,
  url?: string,
  event?: string,
  rideId?: string
): Promise<{ method: string; success: boolean }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("onesignal_player_id, phone, sms_notifications_enabled")
    .eq("id", profileId)
    .single();

  if (!profile) {
    await logNotification(supabase, {
      ride_id: rideId, target_profile_id: profileId,
      event: event || "unknown", method: "none", status: "failed",
      error_message: "Profile not found",
    });
    return { method: "none", success: false };
  }

  // Try push first
  if (profile.onesignal_player_id) {
    const pushResult = await sendOneSignalPushBatch(
      appId, apiKey, [profile.onesignal_player_id], heading, message, url
    );
    if (pushResult.success && pushResult.recipients > 0) {
      await logNotification(supabase, {
        ride_id: rideId, target_profile_id: profileId,
        event: event || "direct", method: "push", status: "delivered",
        onesignal_id: pushResult.onesignal_id, recipients: pushResult.recipients,
      });
      return { method: "push", success: true };
    }
    await logNotification(supabase, {
      ride_id: rideId, target_profile_id: profileId,
      event: event || "direct", method: "push", status: "failed",
      error_message: pushResult.error || "No recipients",
    });
  }

  // SMS fallback
  if (profile.phone && profile.sms_notifications_enabled) {
    const smsSent = await sendSmsFallback(profile.phone, `${heading}: ${message}`);
    await logNotification(supabase, {
      ride_id: rideId, target_profile_id: profileId,
      event: event || "direct", method: "sms",
      status: smsSent ? "delivered" : "failed",
      error_message: smsSent ? undefined : "SMS delivery failed",
    });
    return { method: "sms", success: smsSent };
  }

  await logNotification(supabase, {
    ride_id: rideId, target_profile_id: profileId,
    event: event || "direct", method: "none", status: "failed",
    error_message: "No delivery method available",
  });
  return { method: "none", success: false };
}

// ── In-app notification writer (with deduplication) ────────────────

async function writeNotification(
  supabase: any, userId: string, title: string, body: string, type: string, rideId?: string
) {
  // Deduplicate: check if this exact notification was already sent in the last 60s
  if (rideId) {
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", type)
      .eq("ride_id", rideId)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .limit(1);
    if (existing?.length) return; // Already sent
  }
  await supabase.from("notifications").insert({
    user_id: userId, title, body, type, ride_id: rideId || null,
  });
}

// ── Retry queue processor ──────────────────────────────────────────

async function processRetryQueue(
  supabase: any, appId: string, apiKey: string, maxRetries = 3
): Promise<{ processed: number; succeeded: number }> {
  const { data: failedLogs } = await supabase
    .from("notification_logs")
    .select("*")
    .eq("status", "failed")
    .lt("retry_count", maxRetries)
    .order("created_at", { ascending: true })
    .limit(50);

  if (!failedLogs?.length) return { processed: 0, succeeded: 0 };

  let succeeded = 0;

  for (const log of failedLogs) {
    const newRetryCount = log.retry_count + 1;

    if (log.method === "push" && log.target_profile_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onesignal_player_id")
        .eq("id", log.target_profile_id)
        .single();

      if (profile?.onesignal_player_id) {
        const result = await sendOneSignalPushBatch(
          appId, apiKey, [profile.onesignal_player_id],
          "PickYou", log.metadata?.message || "You have an update"
        );
        if (result.success && result.recipients > 0) {
          await supabase.from("notification_logs")
            .update({ status: "delivered", retry_count: newRetryCount, completed_at: new Date().toISOString(), onesignal_id: result.onesignal_id })
            .eq("id", log.id);
          succeeded++;
          continue;
        }
      }
    }

    // Mark as retried but still failed
    const finalStatus = newRetryCount >= maxRetries ? "permanently_failed" : "failed";
    await supabase.from("notification_logs")
      .update({ status: finalStatus, retry_count: newRetryCount })
      .eq("id", log.id);
  }

  return { processed: failedLogs.length, succeeded };
}

// ── Main Handler ───────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonRes({ error: "Invalid JSON body" }, 400);
    }

    const parsed = RequestBody.safeParse(rawBody);
    if (!parsed.success) {
      return jsonRes({ error: parsed.error.flatten().fieldErrors }, 400);
    }

    const onesignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const onesignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
    if (!onesignalAppId || !onesignalApiKey) {
      return jsonRes({ error: "OneSignal not configured" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const input = parsed.data;

    // ── Rate limiting ─────────────────────────────────────────────
    const rateLimitKey = `notif:${input.mode}`;
    if (!checkInMemoryRateLimit(rateLimitKey)) {
      return jsonRes({ error: "Rate limit exceeded. Try again shortly." }, 429);
    }

    // ── MODE: retry ───────────────────────────────────────────────
    if (input.mode === "retry") {
      const result = await processRetryQueue(supabase, onesignalAppId, onesignalApiKey, input.max_retries);
      return jsonRes(result);
    }

    // ── MODE: broadcast ───────────────────────────────────────────
    if (input.mode === "broadcast") {
      // Require admin auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonRes({ error: "Unauthorized" }, 401);
      }
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) return jsonRes({ error: "Unauthorized" }, 401);

      // Check admin role
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();
      if (adminProfile?.role !== "admin") {
        return jsonRes({ error: "Admin access required" }, 403);
      }

      // Build audience query
      let audienceQuery = supabase
        .from("profiles")
        .select("id, onesignal_player_id, phone, sms_notifications_enabled");

      if (input.audience === "drivers") {
        audienceQuery = audienceQuery.eq("role", "driver");
      } else if (input.audience === "riders") {
        audienceQuery = audienceQuery.eq("role", "rider");
      } else {
        audienceQuery = audienceQuery.in("role", ["driver", "rider"]);
      }

      const { data: profiles } = await audienceQuery;
      if (!profiles?.length) {
        return jsonRes({ sent: 0, reason: "no_users_found" });
      }

      // Collect push IDs
      const pushIds = profiles
        .filter((p: any) => p.onesignal_player_id)
        .map((p: any) => p.onesignal_player_id as string);

      let pushResult = { success: false, recipients: 0, onesignal_id: undefined as string | undefined, error: undefined as string | undefined };

      if (pushIds.length > 0) {
        pushResult = await sendOneSignalPushBatch(
          onesignalAppId, onesignalApiKey,
          pushIds, input.heading, input.message, input.url
        );
      }

      await logNotification(supabase, {
        event: "broadcast",
        method: "push_batch",
        status: pushResult.success ? "delivered" : (pushIds.length === 0 ? "skipped" : "failed"),
        onesignal_id: pushResult.onesignal_id,
        recipients: pushResult.recipients,
        error_message: pushResult.error,
        metadata: {
          audience: input.audience,
          total_profiles: profiles.length,
          push_eligible: pushIds.length,
          heading: input.heading,
          message: input.message,
        },
      });

      // Write in-app notifications for all targets
      const notifRows = profiles.map((p: any) => ({
        user_id: p.id,
        title: input.heading,
        body: input.message,
        type: "broadcast",
      }));

      // Insert in batches of 500
      for (let i = 0; i < notifRows.length; i += 500) {
        await supabase.from("notifications").insert(notifRows.slice(i, i + 500));
      }

      return jsonRes({
        sent: pushResult.recipients,
        total_profiles: profiles.length,
        push_eligible: pushIds.length,
        success: true,
      });
    }

    // ── MODE: direct ──────────────────────────────────────────────
    if (input.mode === "direct") {
      const result = await sendOneSignalPushBatch(
        onesignalAppId, onesignalApiKey,
        [input.player_id],
        input.heading || "PickYou",
        input.message,
        input.url
      );
      await logNotification(supabase, {
        event: "direct", method: "push",
        status: result.success ? "delivered" : "failed",
        error_message: result.error,
        onesignal_id: result.onesignal_id,
        recipients: result.recipients,
        metadata: { heading: input.heading, message: input.message },
      });
      return jsonRes(result);
    }

    // ── MODE: test ────────────────────────────────────────────────
    if (input.mode === "test") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonRes({ error: "Unauthorized" }, 401);
      }
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) return jsonRes({ error: "Unauthorized" }, 401);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, onesignal_player_id, phone, sms_notifications_enabled")
        .eq("user_id", userData.user.id)
        .single();

      if (!profile) return jsonRes({ error: "Profile not found" }, 404);

      const r = await notifyUser(
        supabase, onesignalAppId, onesignalApiKey,
        profile.id, "PickYou Test", "Test notification working ✅",
        undefined, "test"
      );
      await writeNotification(supabase, profile.id, "PickYou Test", "Test notification working ✅", "test");
      return jsonRes({ ...r, profile_id: profile.id });
    }

    // ── MODE: ride_event ──────────────────────────────────────────
    const { ride_id, event } = input;
    const startTime = Date.now();

    const { data: ride } = await supabase
      .from("rides")
      .select("id, rider_id, driver_id, service_type, pickup_address, dropoff_address, booking_for, guest_name, guest_phone, guest_track_token")
      .eq("id", ride_id)
      .single();

    if (!ride) return jsonRes({ error: "Ride not found" }, 404);

    const results: Array<{ target: string; method: string; success: boolean }> = [];

    switch (event) {
      // ── A. Ride Requested → Batch notify nearby drivers ────────
      case "requested": {
        // Only target drivers with a recent heartbeat (last 3 minutes) — avoids
        // pinging zombie sessions whose tab/PWA is closed.
        const freshCutoff = new Date(Date.now() - 3 * 60_000).toISOString();
        let driverQuery = supabase
          .from("profiles")
          .select("id, onesignal_player_id, phone, sms_notifications_enabled, latitude, longitude, last_seen_at")
          .eq("role", "driver")
          .eq("is_available", true)
          .gte("last_seen_at", freshCutoff);

        if (ride.service_type === "large_delivery") {
          driverQuery = driverQuery.in("vehicle_type", ["SUV", "truck", "van"]);
        } else if (["courier", "retail_delivery", "personal_shopper"].includes(ride.service_type)) {
          driverQuery = driverQuery.eq("can_courier", true);
        } else if (ride.service_type === "private_hire") {
          driverQuery = driverQuery.eq("can_private_hire", true);
        } else if (ride.service_type === "shuttle") {
          driverQuery = driverQuery.eq("can_shuttle", true);
        } else {
          driverQuery = driverQuery.eq("can_taxi", true);
        }

        const { data: drivers } = await driverQuery;
        if (!drivers?.length) {
          await logNotification(supabase, {
            ride_id, event: "requested", method: "none", status: "skipped",
            error_message: "No eligible drivers found",
            metadata: { service_type: ride.service_type },
          });
          return jsonRes({ sent: 0, reason: "no_eligible_drivers", results });
        }

        const heading = "New ride request nearby 🚗";
        const body = `Pickup at ${ride.pickup_address}`;

        // Collect player IDs for batch push
        const pushIds: string[] = [];
        const fallbackDrivers: typeof drivers = [];

        for (const d of drivers) {
          if (d.onesignal_player_id) {
            pushIds.push(d.onesignal_player_id);
          } else {
            fallbackDrivers.push(d);
          }
        }

        // Single batched push to all drivers with player IDs
        if (pushIds.length > 0) {
          const pushResult = await sendOneSignalPushBatch(
            onesignalAppId, onesignalApiKey,
            pushIds, heading, body, "/driver/dispatch"
          );

          await logNotification(supabase, {
            ride_id, event: "requested", method: "push_batch",
            status: pushResult.success ? "delivered" : "failed",
            onesignal_id: pushResult.onesignal_id,
            recipients: pushResult.recipients,
            error_message: pushResult.error,
            metadata: { driver_count: pushIds.length, service_type: ride.service_type, message: body },
          });

          results.push({
            target: `${pushIds.length} drivers (batch push)`,
            method: "push",
            success: pushResult.success,
          });

          if (!pushResult.success) {
            for (const d of drivers) {
              if (d.onesignal_player_id) fallbackDrivers.push(d);
            }
          }
        }

        // SMS fallback — process in parallel for speed
        const smsFallbacks = fallbackDrivers
          .filter(d => d.phone && d.sms_notifications_enabled)
          .map(async (d) => {
            const ok = await sendSmsFallback(d.phone!, `${heading}: ${body}`);
            await logNotification(supabase, {
              ride_id, target_profile_id: d.id, event: "requested",
              method: "sms", status: ok ? "delivered" : "failed",
              metadata: { message: body },
            });
            results.push({ target: d.id, method: "sms", success: ok });
          });
        await Promise.all(smsFallbacks);

        // In-app notifications for all drivers (batch insert)
        const notifRows = drivers.map((d: any) => ({
          user_id: d.id, title: heading, body, type: "dispatch", ride_id,
        }));
        await supabase.from("notifications").insert(notifRows);

        const elapsed = Date.now() - startTime;
        console.log(`[ride_event:requested] ride=${ride_id} drivers=${drivers.length} elapsed=${elapsed}ms`);

        return jsonRes({
          sent: results.filter(r => r.success).length,
          total: drivers.length,
          elapsed_ms: elapsed,
          results,
        });
      }

      // ── B–D. Driver Accepted / Arrived / Completed → Notify rider
      case "accepted":
      case "arrived":
      case "completed": {
        if (!ride.rider_id) return jsonRes({ error: "No rider on this ride" }, 400);

        const eventConfig: Record<string, { heading: string; body: string; url: string; type: string }> = {
          accepted: {
            heading: "Your driver is on the way 🚗",
            body: "Your driver has accepted your ride and is heading to pick you up.",
            url: "/rider",
            type: "ride_accepted",
          },
          arrived: {
            heading: "Your driver has arrived 📍",
            body: "Your driver is waiting at the pickup location.",
            url: "/rider",
            type: "driver_arrived",
          },
          completed: {
            heading: "Trip completed 🎉",
            body: "Thank you for riding with PickYou!",
            url: "/rider/activity",
            type: "ride_completed",
          },
        };

        const cfg = eventConfig[event];
        const r = await notifyUser(
          supabase, onesignalAppId, onesignalApiKey,
          ride.rider_id, cfg.heading, cfg.body, cfg.url,
          event, ride_id
        );
        await writeNotification(supabase, ride.rider_id, cfg.heading, cfg.body, cfg.type, ride_id);
        results.push({ target: ride.rider_id, ...r });

        // ── Guest SMS: notify the actual passenger if booking_for='guest' ──
        if (ride.booking_for === "guest" && ride.guest_phone) {
          const guestName = ride.guest_name?.split(" ")[0] || "there";

          // Lazily generate a tracking token on the first guest event
          let token = (ride as any).guest_track_token as string | null;
          if (!token) {
            token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
            const { error: tokErr } = await supabase
              .from("rides")
              .update({ guest_track_token: token })
              .eq("id", ride_id);
            if (tokErr) {
              console.warn("[guest-track] could not store token:", tokErr.message);
              token = null;
            }
          }

          // Build short, public tracking URL. PUBLIC_APP_URL falls back to the
          // Lovable preview URL so links work even before a custom domain is set.
          const baseUrl = Deno.env.get("PUBLIC_APP_URL") || "https://pickyou.lovable.app";
          const trackUrl = token ? `${baseUrl.replace(/\/$/, "")}/t/${token}` : null;
          const linkSuffix = trackUrl ? ` Track: ${trackUrl}` : "";

          const guestMessages: Record<string, string> = {
            accepted: `Hi ${guestName}, your PickYou driver is on the way to ${ride.pickup_address}.${linkSuffix}`,
            arrived: `Hi ${guestName}, your PickYou driver has arrived at ${ride.pickup_address}.${linkSuffix}`,
            completed: `Hi ${guestName}, your PickYou trip is complete. Thanks for riding!`,
          };
          const guestMsg = guestMessages[event];
          const smsOk = await sendSmsFallback(ride.guest_phone, guestMsg);
          await logNotification(supabase, {
            ride_id, event, method: "sms_guest",
            status: smsOk ? "delivered" : "failed",
            error_message: smsOk ? undefined : "Guest SMS delivery failed",
            metadata: { guest_phone: ride.guest_phone, guest_name: ride.guest_name, message: guestMsg, track_url: trackUrl },
          });
          results.push({ target: `guest:${ride.guest_phone}`, method: "sms", success: smsOk });
        }

        const elapsed = Date.now() - startTime;
        console.log(`[ride_event:${event}] ride=${ride_id} rider=${ride.rider_id} guest=${ride.booking_for === "guest"} elapsed=${elapsed}ms`);

        return jsonRes({ results, elapsed_ms: elapsed });
      }

      default:
        return jsonRes({ error: "Unknown event" }, 400);
    }
  } catch (err: any) {
    console.error("send-push-notification error:", err);
    return jsonRes({ error: err.message }, 500);
  }
});
