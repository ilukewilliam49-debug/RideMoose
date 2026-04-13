import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const results: Record<string, number> = {};

    // 1. Cancel rides stuck in 'requested' for > 10 minutes
    const requestedCutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const { data: staleRequested } = await admin
      .from("rides")
      .update({
        status: "cancelled",
        cancellation_reason: "Auto-cancelled: no driver accepted within 10 minutes",
      })
      .eq("status", "requested")
      .lt("created_at", requestedCutoff)
      .is("dispatched_to_driver_id", null)
      .select("id");
    results.cancelled_requested = staleRequested?.length ?? 0;

    // 2. Cancel rides stuck in 'accepted' for > 15 minutes (driver never started)
    const acceptedCutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const { data: staleAccepted } = await admin
      .from("rides")
      .update({
        status: "cancelled",
        cancellation_reason: "Auto-cancelled: driver did not start ride within 15 minutes",
      })
      .eq("status", "accepted")
      .lt("updated_at", acceptedCutoff)
      .select("id");
    results.cancelled_accepted = staleAccepted?.length ?? 0;

    // 3. Reset rides stuck in 'dispatched' past their expiry
    const { data: staleDispatched } = await admin
      .from("rides")
      .update({
        status: "requested",
        dispatched_to_driver_id: null,
        dispatch_expires_at: null,
      })
      .eq("status", "dispatched")
      .lt("dispatch_expires_at", now.toISOString())
      .select("id");
    results.reset_dispatched = staleDispatched?.length ?? 0;

    // Notify affected riders
    const allCancelled = [
      ...(staleRequested || []),
      ...(staleAccepted || []),
    ];
    for (const ride of allCancelled) {
      const { data: rideData } = await admin
        .from("rides")
        .select("rider_id")
        .eq("id", ride.id)
        .single();
      if (rideData) {
        await admin.from("notifications").insert({
          user_id: rideData.rider_id,
          title: "Ride cancelled",
          body: "Your ride was automatically cancelled because no driver was available. Please try again.",
          type: "ride_cancelled",
          ride_id: ride.id,
        });
      }
    }

    console.log("[cleanup-stale-rides]", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[cleanup-stale-rides] error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
