import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RequestBody = z.object({
  ride_id: z.string().uuid("ride_id must be a valid UUID"),
  final_fare_cents: z.number().int().min(0).optional(),
  distance_km: z.number().min(0).optional(),
  duration_min: z.number().min(0).optional(),
});

function jsonRes(body: unknown, status = 200) {
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
    // Parse & validate input
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
    const { ride_id, final_fare_cents, distance_km, duration_min } = parsed.data;

    // Authenticate caller
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Get caller's profile
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("user_id", userData.user.id)
      .single();

    if (!profile) return jsonRes({ error: "Profile not found" }, 404);

    // Fetch ride
    const { data: ride, error: rideErr } = await admin
      .from("rides")
      .select("id, status, driver_id, rider_id, service_type, payment_option, meter_started_at, final_fare_cents, stripe_payment_intent_id, booking_for, guest_phone, guest_name, guest_track_token")
      .eq("id", ride_id)
      .single();

    if (rideErr || !ride) return jsonRes({ error: "Ride not found" }, 404);

    // Only the assigned driver (or admin) can complete
    const isAdmin = profile.role === "admin";
    if (ride.driver_id !== profile.id && !isAdmin) {
      return jsonRes({ error: "Only the assigned driver can complete this ride" }, 403);
    }

    // Ride must be in_progress
    if (ride.status !== "in_progress") {
      return jsonRes({ error: `Cannot complete ride in '${ride.status}' status. Must be 'in_progress'.` }, 400);
    }

    const now = new Date().toISOString();

    // Calculate duration from meter if not provided
    let computedDuration = duration_min;
    if (!computedDuration && ride.meter_started_at) {
      const startMs = new Date(ride.meter_started_at).getTime();
      computedDuration = Math.round((Date.now() - startMs) / 60000 * 10) / 10;
    }

    // Build update payload — note: financial columns are NOT trusted from
    // the client. capture-payment recomputes final_fare_cents server-side
    // from authoritative taxi_rates × distance_km. We accept distance_km
    // and duration_min for routing/analytics only.
    const updatePayload: Record<string, unknown> = {
      status: "completed",
      completed_at: now,
      meter_status: "stopped",
      meter_ended_at: now,
    };

    if (distance_km !== undefined) updatePayload.distance_km = distance_km;
    if (computedDuration !== undefined) updatePayload.duration_min = computedDuration;
    // final_fare_cents intentionally ignored — capture-payment is authoritative.

    // Atomic update with optimistic lock on status
    const { error: updateErr } = await admin
      .from("rides")
      .update(updatePayload)
      .eq("id", ride_id)
      .eq("status", "in_progress");

    if (updateErr) {
      console.error("complete-ride update error:", updateErr.message);
      return jsonRes({ error: "Failed to complete ride" }, 500);
    }

    // Trigger payment capture for in-app payments
    let paymentResult: Record<string, unknown> | null = null;
    if (ride.payment_option === "in_app" && ride.stripe_payment_intent_id) {
      try {
        const captureResp = await fetch(`${supabaseUrl}/functions/v1/capture-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ ride_id }),
        });
        paymentResult = await captureResp.json();
        console.log(`[complete-ride] payment captured:`, JSON.stringify(paymentResult));
      } catch (payErr: any) {
        console.error(`[complete-ride] payment capture failed:`, payErr.message);
        paymentResult = { error: payErr.message };
      }
    }

    // Send earnings notification to driver
    try {
      const fareDisplay = final_fare_cents
        ? `$${(final_fare_cents / 100).toFixed(2)}`
        : "calculated";
      
      await admin.from("notifications").insert({
        user_id: ride.driver_id,
        title: "Trip completed!",
        body: `You earned on this trip. Fare: ${fareDisplay}. Check your earnings for details.`,
        type: "trip_completed",
        ride_id,
      });
    } catch (notifErr: any) {
      console.error("[complete-ride] driver notification failed:", notifErr.message);
    }

    // Send guest a "Rate your trip" SMS via Twilio when applicable.
    try {
      if (
        ride.booking_for === "guest" &&
        ride.guest_phone &&
        ride.guest_track_token
      ) {
        const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
        const publicBase = Deno.env.get("PUBLIC_APP_URL") || "https://pickyou.lovable.app";
        if (accountSid && authToken && fromNumber) {
          const rateUrl = `${publicBase}/t/${ride.guest_track_token}/rate`;
          const firstName = (ride.guest_name || "").trim().split(/\s+/)[0];
          const greeting = firstName ? `Hi ${firstName}, ` : "";
          const smsBody = `${greeting}thanks for riding with PickYou! How was your trip? Rate your driver: ${rateUrl}`;
          const smsRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: ride.guest_phone,
                From: fromNumber,
                Body: smsBody,
              }),
            },
          );
          if (!smsRes.ok) {
            const errBody = await smsRes.text();
            console.error(`[complete-ride] guest rating SMS failed: ${smsRes.status} ${errBody}`);
          } else {
            console.log(`[complete-ride] guest rating SMS sent to ${ride.guest_phone}`);
          }
        } else {
          console.log("[complete-ride] Twilio not configured, skipping guest rating SMS");
        }
      }
    } catch (smsErr: any) {
      console.error("[complete-ride] guest rating SMS error:", smsErr.message);
    }

    console.log(`[complete-ride] ride=${ride_id} driver=${profile.id} completed_at=${now} duration=${computedDuration}min`);

    return jsonRes({
      success: true,
      ride_id,
      completed_at: now,
      duration_min: computedDuration,
      payment: paymentResult,
    });
  } catch (err: any) {
    console.error("complete-ride error:", err.message);
    return jsonRes({ error: err.message }, 500);
  }
});
