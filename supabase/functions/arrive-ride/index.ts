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
    const { ride_id } = parsed.data;

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

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("user_id", userData.user.id)
      .single();

    if (!profile) return jsonRes({ error: "Profile not found" }, 404);

    const { data: ride, error: rideErr } = await admin
      .from("rides")
      .select("id, status, driver_id")
      .eq("id", ride_id)
      .single();

    if (rideErr || !ride) return jsonRes({ error: "Ride not found" }, 404);

    if (ride.driver_id !== profile.id) {
      return jsonRes({ error: "Only the assigned driver can mark arrival" }, 403);
    }

    if (ride.status !== "accepted") {
      return jsonRes({ error: `Cannot mark arrived from '${ride.status}' status. Must be 'accepted'.` }, 400);
    }

    const { error: updateErr } = await admin
      .from("rides")
      .update({ status: "arrived", updated_at: new Date().toISOString() })
      .eq("id", ride_id)
      .eq("status", "accepted");

    if (updateErr) {
      console.error("arrive-ride update error:", updateErr.message);
      return jsonRes({ error: "Failed to update ride status" }, 500);
    }

    console.log(`[arrive-ride] ride=${ride_id} driver=${profile.id}`);

    return jsonRes({ success: true, ride_id });
  } catch (err: any) {
    console.error("arrive-ride error:", err.message);
    return jsonRes({ error: err.message }, 500);
  }
});
