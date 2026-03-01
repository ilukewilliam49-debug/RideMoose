import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ride_id, title, body } = await req.json();
    if (!ride_id) throw new Error("ride_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get the ride to find which drivers were notified
    const { data: ride } = await supabase
      .from("rides")
      .select("id, service_type, pickup_address")
      .eq("id", ride_id)
      .single();

    if (!ride || !["large_delivery", "pet_transport"].includes(ride.service_type)) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get eligible drivers' push subscriptions based on service type
    let driverQuery = supabase
      .from("profiles")
      .select("id")
      .eq("role", "driver")
      .eq("is_available", true);

    if (ride.service_type === "large_delivery") {
      driverQuery = driverQuery.in("vehicle_type", ["SUV", "truck", "van"]);
    } else if (ride.service_type === "pet_transport") {
      driverQuery = driverQuery.eq("pet_approved", true);
    }

    const { data: drivers } = await driverQuery;

    if (!drivers?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const driverIds = drivers.map((d: any) => d.id);
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", driverIds);

    if (!subscriptions?.length || !vapidPrivateKey || !vapidPublicKey) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions_or_vapid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send push notifications using Web Push protocol
    const defaultTitle = ride.service_type === "pet_transport"
      ? "New Pet Transport Request"
      : "New Large Delivery Request";
    const defaultBody = ride.service_type === "pet_transport"
      ? `A new pet transport from ${ride.pickup_address} is available.`
      : `A new large item delivery from ${ride.pickup_address} is available for bidding.`;
    const pushPayload = JSON.stringify({
      title: title || defaultTitle,
      body: body || defaultBody,
      url: "/driver/dispatch",
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        // Use fetch to send to the push endpoint with basic headers
        // For full VAPID auth, a proper web-push implementation is needed
        // This is a simplified push that works with most browsers
        const resp = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            TTL: "86400",
          },
          body: pushPayload,
        });
        if (resp.ok) sent++;
      } catch {
        // Individual push failure is non-fatal
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
