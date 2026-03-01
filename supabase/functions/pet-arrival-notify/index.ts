import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ride_id, arrival_type } = await req.json();
    if (!ride_id || !arrival_type) throw new Error("ride_id and arrival_type required");
    if (!["pickup", "dropoff"].includes(arrival_type)) throw new Error("arrival_type must be pickup or dropoff");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch ride details
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("id, rider_id, service_type, pickup_address, dropoff_address, driver_id")
      .eq("id", ride_id)
      .single();

    if (rideErr || !ride) {
      return new Response(JSON.stringify({ error: "Ride not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ride.service_type !== "pet_transport") {
      return new Response(JSON.stringify({ sent: 0, reason: "not_pet_transport" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get driver name
    let driverName = "Your driver";
    if (ride.driver_id) {
      const { data: driver } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", ride.driver_id)
        .single();
      if (driver?.full_name) driverName = driver.full_name;
    }

    const title = arrival_type === "pickup"
      ? "🐾 Driver Arriving at Pickup"
      : "🐾 Arriving at Destination";

    const body = arrival_type === "pickup"
      ? `${driverName} has arrived at ${ride.pickup_address} to pick up your pet.`
      : `${driverName} is arriving at ${ride.dropoff_address} with your pet.`;

    // Insert in-app notification for the rider
    await supabase.from("notifications").insert({
      user_id: ride.rider_id,
      title,
      body,
      type: `pet_arrival_${arrival_type}`,
      ride_id: ride.id,
    });

    // Send push notification to rider
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", ride.rider_id);

    let pushSent = 0;
    if (subscriptions?.length && vapidPrivateKey && vapidPublicKey) {
      const pushPayload = JSON.stringify({
        title,
        body,
        url: "/rider",
      });

      for (const sub of subscriptions) {
        try {
          const resp = await fetch(sub.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", TTL: "86400" },
            body: pushPayload,
          });
          if (resp.ok) pushSent++;
        } catch {
          // Individual push failure is non-fatal
        }
      }
    }

    // SMS fallback: send via Twilio if no push was delivered and rider opted in
    let smsSent = false;
    if (pushSent === 0) {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (twilioSid && twilioAuth && twilioFrom) {
        // Get rider's phone number and SMS preference
        const { data: riderProfile } = await supabase
          .from("profiles")
          .select("phone, sms_notifications_enabled")
          .eq("id", ride.rider_id)
          .single();

        const riderPhone = riderProfile?.phone;
        const smsEnabled = riderProfile?.sms_notifications_enabled !== false;
        if (smsEnabled && riderPhone && riderPhone.length >= 7) {
          try {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
            const smsBody = `${title}\n${body}`;
            const params = new URLSearchParams({
              To: riderPhone,
              From: twilioFrom,
              Body: smsBody,
            });

            const resp = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
              },
              body: params.toString(),
            });
            if (resp.ok) smsSent = true;
            else await resp.text(); // consume body
          } catch (err) {
            console.error("Twilio SMS failed:", err);
          }
        }
      }
    }

    return new Response(JSON.stringify({ push_sent: pushSent, sms_sent: smsSent, notification: "created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
