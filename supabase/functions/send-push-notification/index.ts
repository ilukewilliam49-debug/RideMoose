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

const TestSchema = z.object({
  mode: z.literal("test"),
});

const RequestBody = z.discriminatedUnion("mode", [
  DirectSchema,
  RideEventSchema,
  TestSchema,
]);

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

/**
 * Sends a OneSignal push notification with 1 automatic retry.
 * Returns { success, recipients, onesignal_id, error? }
 */
async function sendOneSignalPush(
  appId: string,
  apiKey: string,
  playerIds: string[],
  heading: string,
  message: string,
  url?: string
): Promise<{ success: boolean; recipients: number; onesignal_id?: string; error?: string }> {
  const payload: OneSignalPayload = {
    app_id: appId,
    include_player_ids: playerIds,
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
        return {
          success: true,
          recipients: result.recipients || 0,
          onesignal_id: result.id,
        };
      }
      // Log and retry once
      console.error(`OneSignal attempt ${attempt + 1} failed:`, JSON.stringify(result));
      if (attempt === 0) continue;
      return { success: false, recipients: 0, error: JSON.stringify(result) };
    } catch (err: any) {
      console.error(`OneSignal attempt ${attempt + 1} exception:`, err.message);
      if (attempt === 0) continue;
      return { success: false, recipients: 0, error: err.message };
    }
  }
  return { success: false, recipients: 0, error: "max_retries_exceeded" };
}

/**
 * SMS fallback via Twilio when push fails or no player_id.
 */
async function sendSmsFallback(
  phone: string,
  message: string
): Promise<boolean> {
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
      body: new URLSearchParams({
        To: phone,
        From: twilioFrom,
        Body: message,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error("Twilio SMS failed:", JSON.stringify(data));
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("Twilio SMS exception:", err.message);
    return false;
  }
}

/**
 * Sends push to a single user. Falls back to SMS if push fails or no player_id.
 */
async function notifyUser(
  supabase: any,
  appId: string,
  apiKey: string,
  profileId: string,
  heading: string,
  message: string,
  url?: string
): Promise<{ method: string; success: boolean }> {
  // Fetch the user's player_id and phone
  const { data: profile } = await supabase
    .from("profiles")
    .select("onesignal_player_id, phone, sms_notifications_enabled")
    .eq("id", profileId)
    .single();

  if (!profile) return { method: "none", success: false };

  // Try push first
  if (profile.onesignal_player_id) {
    const pushResult = await sendOneSignalPush(
      appId, apiKey,
      [profile.onesignal_player_id],
      heading, message, url
    );
    if (pushResult.success && pushResult.recipients > 0) {
      return { method: "push", success: true };
    }
    console.warn(`Push failed for profile ${profileId}, trying SMS fallback`);
  }

  // SMS fallback
  if (profile.phone && profile.sms_notifications_enabled) {
    const smsSent = await sendSmsFallback(profile.phone, `${heading}: ${message}`);
    return { method: "sms", success: smsSent };
  }

  console.warn(`No delivery method available for profile ${profileId}`);
  return { method: "none", success: false };
}

// Also write in-app notification
async function writeNotification(
  supabase: any,
  userId: string,
  title: string,
  body: string,
  type: string,
  rideId?: string
) {
  await supabase.from("notifications").insert({
    user_id: userId,
    title,
    body,
    type,
    ride_id: rideId || null,
  });
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

    // ── MODE: direct ──────────────────────────────────────────────
    if (input.mode === "direct") {
      const result = await sendOneSignalPush(
        onesignalAppId,
        onesignalApiKey,
        [input.player_id],
        input.heading || "PickYou",
        input.message,
        input.url
      );
      if (!result.success) {
        console.error("Direct push failed:", result.error);
      }
      return jsonRes(result);
    }

    // ── MODE: test ────────────────────────────────────────────────
    if (input.mode === "test") {
      // Authenticate the caller
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

      const result = await notifyUser(
        supabase, onesignalAppId, onesignalApiKey,
        profile.id,
        "PickYou Test",
        "Test notification working ✅"
      );

      await writeNotification(
        supabase, profile.id,
        "PickYou Test",
        "Test notification working ✅",
        "test"
      );

      return jsonRes({ ...result, profile_id: profile.id });
    }

    // ── MODE: ride_event ──────────────────────────────────────────
    const { ride_id, event } = input;

    const { data: ride } = await supabase
      .from("rides")
      .select("id, rider_id, driver_id, service_type, pickup_address, dropoff_address")
      .eq("id", ride_id)
      .single();

    if (!ride) return jsonRes({ error: "Ride not found" }, 404);

    const results: Array<{ target: string; method: string; success: boolean }> = [];

    switch (event) {
      // ── A. Ride Requested → Notify nearby drivers ─────────────
      case "requested": {
        let driverQuery = supabase
          .from("profiles")
          .select("id, onesignal_player_id, phone, sms_notifications_enabled, latitude, longitude")
          .eq("role", "driver")
          .eq("is_available", true);

        // Service-specific filters
        if (ride.service_type === "large_delivery") {
          driverQuery = driverQuery.in("vehicle_type", ["SUV", "truck", "van"]);
        } else if (ride.service_type === "pet_transport") {
          driverQuery = driverQuery.eq("pet_approved", true);
        } else if (ride.service_type === "courier" || ride.service_type === "retail_delivery" || ride.service_type === "personal_shopper") {
          driverQuery = driverQuery.eq("can_courier", true);
        } else if (ride.service_type === "food_delivery") {
          driverQuery = driverQuery.eq("can_food_delivery", true);
        } else if (ride.service_type === "private_hire") {
          driverQuery = driverQuery.eq("can_private_hire", true);
        } else if (ride.service_type === "shuttle") {
          driverQuery = driverQuery.eq("can_shuttle", true);
        } else {
          driverQuery = driverQuery.eq("can_taxi", true);
        }

        const { data: drivers } = await driverQuery;
        if (!drivers?.length) {
          return jsonRes({ sent: 0, reason: "no_eligible_drivers", results });
        }

        const heading = "New ride request nearby 🚗";
        const body = `Pickup at ${ride.pickup_address}`;

        // Batch: collect player IDs for push, track fallbacks
        const pushIds: string[] = [];
        const fallbackDrivers: typeof drivers = [];

        for (const d of drivers) {
          if (d.onesignal_player_id) {
            pushIds.push(d.onesignal_player_id);
          } else {
            fallbackDrivers.push(d);
          }
        }

        // Batch push to all drivers with player IDs
        if (pushIds.length > 0) {
          const pushResult = await sendOneSignalPush(
            onesignalAppId, onesignalApiKey,
            pushIds, heading, body, "/driver/dispatch"
          );
          results.push({
            target: `${pushIds.length} drivers (push)`,
            method: "push",
            success: pushResult.success,
          });

          // If batch push failed, move all to fallback
          if (!pushResult.success) {
            for (const d of drivers) {
              if (d.onesignal_player_id) fallbackDrivers.push(d);
            }
          }
        }

        // SMS fallback for drivers without player IDs or failed push
        for (const d of fallbackDrivers) {
          if (d.phone && d.sms_notifications_enabled) {
            const ok = await sendSmsFallback(d.phone, `${heading}: ${body}`);
            results.push({ target: d.id, method: "sms", success: ok });
          } else {
            results.push({ target: d.id, method: "none", success: false });
          }
        }

        // Write in-app notifications for all eligible drivers
        const notifRows = drivers.map((d: any) => ({
          user_id: d.id,
          title: heading,
          body,
          type: "dispatch",
          ride_id,
        }));
        await supabase.from("notifications").insert(notifRows);

        return jsonRes({ sent: results.filter((r) => r.success).length, total: drivers.length, results });
      }

      // ── B. Driver Accepted → Notify rider ─────────────────────
      case "accepted": {
        if (!ride.rider_id) return jsonRes({ error: "No rider on this ride" }, 400);
        const r = await notifyUser(
          supabase, onesignalAppId, onesignalApiKey,
          ride.rider_id,
          "Your driver is on the way 🚗",
          "Your driver has accepted your ride and is heading to pick you up.",
          "/rider"
        );
        await writeNotification(supabase, ride.rider_id, "Your driver is on the way", "Your driver has accepted your ride.", "ride_accepted", ride_id);
        results.push({ target: ride.rider_id, ...r });
        return jsonRes({ results });
      }

      // ── C. Driver Arrived → Notify rider ──────────────────────
      case "arrived": {
        if (!ride.rider_id) return jsonRes({ error: "No rider on this ride" }, 400);
        const r = await notifyUser(
          supabase, onesignalAppId, onesignalApiKey,
          ride.rider_id,
          "Your driver has arrived 📍",
          "Your driver is waiting at the pickup location.",
          "/rider"
        );
        await writeNotification(supabase, ride.rider_id, "Your driver has arrived", "Your driver is waiting at the pickup location.", "driver_arrived", ride_id);
        results.push({ target: ride.rider_id, ...r });
        return jsonRes({ results });
      }

      // ── D. Ride Completed → Notify rider ──────────────────────
      case "completed": {
        if (!ride.rider_id) return jsonRes({ error: "No rider on this ride" }, 400);
        const r = await notifyUser(
          supabase, onesignalAppId, onesignalApiKey,
          ride.rider_id,
          "Trip completed 🎉",
          "Thank you for riding with PickYou!",
          "/rider/activity"
        );
        await writeNotification(supabase, ride.rider_id, "Trip completed", "Thank you for riding with PickYou!", "ride_completed", ride_id);
        results.push({ target: ride.rider_id, ...r });
        return jsonRes({ results });
      }

      default:
        return jsonRes({ error: "Unknown event" }, 400);
    }
  } catch (err: any) {
    console.error("send-push-notification error:", err);
    return jsonRes({ error: err.message }, 500);
  }
});
