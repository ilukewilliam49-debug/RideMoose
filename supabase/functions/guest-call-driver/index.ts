// Public endpoint: connect a guest passenger to their driver via a Twilio
// masked-number call. Authenticated only by the opaque guest_track_token.
// Flow: Twilio calls the guest from our number; on answer, TwiML <Dial>s the
// driver. Neither party sees the other's real number.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const CONNECTABLE_STATUSES = new Set(["accepted", "arrived", "in_progress"]);

// Simple in-memory rate limit: max 3 calls per token per 5 min
const callAttempts = new Map<string, number[]>();
function rateLimited(token: string): boolean {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const arr = (callAttempts.get(token) || []).filter((t) => now - t < windowMs);
  if (arr.length >= 3) return true;
  arr.push(now);
  callAttempts.set(token, arr);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);

    // Twilio fetches this same endpoint for TwiML when ?twiml=1&driver=...
    if (url.searchParams.get("twiml") === "1") {
      const driverPhone = url.searchParams.get("driver") || "";
      const callerId = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
      const safeDriver = driverPhone.replace(/[^+0-9]/g, "");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to your driver. Please hold.</Say>
  <Dial callerId="${callerId}" timeout="25" answerOnBridge="true">
    <Number>${safeDriver}</Number>
  </Dial>
</Response>`;
      return new Response(xml, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    if (!token || token.length < 6 || token.length > 64) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rateLimited(token)) {
      return new Response(JSON.stringify({ error: "Too many call attempts. Please wait a few minutes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ride, error } = await supabase
      .from("rides")
      .select(`
        id, status, guest_phone, driver_id,
        driver:profiles!rides_driver_id_fkey (phone, full_name)
      `)
      .eq("guest_track_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!ride) {
      return new Response(JSON.stringify({ error: "Trip not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!CONNECTABLE_STATUSES.has(ride.status)) {
      return new Response(JSON.stringify({ error: "Driver isn't available to call right now." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guestPhone = (ride.guest_phone || "").trim();
    const driverPhone = ((ride.driver as any)?.phone || "").trim();
    if (!guestPhone || !driverPhone) {
      return new Response(JSON.stringify({ error: "Phone number unavailable for this trip." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!accountSid || !authToken || !fromNumber) {
      console.error("[guest-call-driver] missing Twilio config");
      return new Response(JSON.stringify({ error: "Calling is not configured." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Twilio fetches TwiML from our same function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const twimlUrl = `${supabaseUrl}/functions/v1/guest-call-driver?twiml=1&driver=${encodeURIComponent(driverPhone)}`;

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: guestPhone,
          From: fromNumber,
          Url: twimlUrl,
          Method: "GET",
          Timeout: "25",
        }),
      },
    );

    const twilioData = await twilioRes.json();
    if (!twilioRes.ok) {
      console.error("[guest-call-driver] Twilio error:", twilioRes.status, twilioData);
      return new Response(JSON.stringify({ error: twilioData?.message || "Could not place call." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, sid: twilioData.sid }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[guest-call-driver] error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
