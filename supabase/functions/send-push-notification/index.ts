import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RequestBody = z.object({
  ride_id: z.string().uuid(),
  title: z.string().max(200).optional(),
  body: z.string().max(500).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const parsed = RequestBody.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { ride_id, title, body } = parsed.data;

    const onesignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
    const onesignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
    if (!onesignalAppId || !onesignalApiKey) {
      return json({ sent: 0, reason: "onesignal_not_configured" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get ride
    const { data: ride } = await supabase
      .from("rides")
      .select("id, service_type, pickup_address")
      .eq("id", ride_id)
      .single();

    if (!ride) return json({ sent: 0, reason: "ride_not_found" });

    // Find eligible drivers with OneSignal player IDs
    let driverQuery = supabase
      .from("profiles")
      .select("id, onesignal_player_id")
      .eq("role", "driver")
      .eq("is_available", true)
      .not("onesignal_player_id", "is", null);

    if (ride.service_type === "large_delivery") {
      driverQuery = driverQuery.in("vehicle_type", ["SUV", "truck", "van"]);
    } else if (ride.service_type === "pet_transport") {
      driverQuery = driverQuery.eq("pet_approved", true);
    }

    const { data: drivers } = await driverQuery;
    if (!drivers?.length) return json({ sent: 0, reason: "no_subscribed_drivers" });

    const playerIds = drivers
      .map((d: any) => d.onesignal_player_id)
      .filter(Boolean);

    if (!playerIds.length) return json({ sent: 0, reason: "no_player_ids" });

    const defaultTitle =
      ride.service_type === "pet_transport"
        ? "New Pet Transport Request"
        : ride.service_type === "large_delivery"
        ? "New Large Delivery Request"
        : "New Ride Request";
    const defaultBody = `Pickup at ${ride.pickup_address}`;

    // Send via OneSignal REST API
    const resp = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${onesignalApiKey}`,
      },
      body: JSON.stringify({
        app_id: onesignalAppId,
        include_player_ids: playerIds,
        headings: { en: title || defaultTitle },
        contents: { en: body || defaultBody },
        url: "/driver/dispatch",
      }),
    });

    const result = await resp.json();
    return json({
      sent: result.recipients || 0,
      onesignal_id: result.id,
    });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
