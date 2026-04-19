// Public endpoint for guest passengers to view and submit a star rating for
// their completed trip. Authenticated only by the opaque guest_track_token.
// GET  -> returns minimal ride info (status, driver name, already_rated)
// POST -> submits { token, rating: 1..5, comment? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ----- GET: fetch trip summary -----
    if (req.method === "GET") {
      const token = (url.searchParams.get("token") || "").trim();
      if (!token || token.length < 6 || token.length > 64) {
        return json({ error: "Invalid token" }, 400);
      }

      const { data: ride, error } = await supabase
        .from("rides")
        .select(`
          id, status, completed_at, guest_name, driver_id, rider_id,
          driver:profiles!rides_driver_id_fkey ( full_name, avatar_url )
        `)
        .eq("guest_track_token", token)
        .maybeSingle();

      if (error) throw error;
      if (!ride) return json({ error: "Trip not found" }, 404);

      let alreadyRated = false;
      if (ride.driver_id && ride.rider_id) {
        const { data: existing } = await supabase
          .from("ride_ratings")
          .select("id")
          .eq("ride_id", ride.id)
          .eq("rated_user", ride.driver_id)
          .maybeSingle();
        alreadyRated = !!existing;
      }

      const driver: any = ride.driver;
      return json({
        status: ride.status,
        completed_at: ride.completed_at,
        guest_name: ride.guest_name,
        driver_name: driver?.full_name?.split(" ")[0] || "your driver",
        driver_avatar: driver?.avatar_url || null,
        already_rated: alreadyRated,
        can_rate: ride.status === "completed" && !!ride.driver_id && !alreadyRated,
      });
    }

    // ----- POST: submit rating -----
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === "string"
      ? body.comment.trim().slice(0, 500)
      : null;

    if (!token || token.length < 6 || token.length > 64) {
      return json({ error: "Invalid token" }, 400);
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ error: "Rating must be an integer between 1 and 5" }, 400);
    }

    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("id, status, driver_id, rider_id")
      .eq("guest_track_token", token)
      .maybeSingle();

    if (rideErr) throw rideErr;
    if (!ride) return json({ error: "Trip not found" }, 404);
    if (ride.status !== "completed") {
      return json({ error: "You can only rate completed trips." }, 409);
    }
    if (!ride.driver_id) return json({ error: "No driver assigned." }, 409);

    // Prevent duplicate guest ratings for the same ride+driver
    const { data: existing } = await supabase
      .from("ride_ratings")
      .select("id")
      .eq("ride_id", ride.id)
      .eq("rated_user", ride.driver_id)
      .maybeSingle();
    if (existing) return json({ error: "This trip has already been rated." }, 409);

    // Attribute the rating to the rider profile that booked the guest trip.
    const { error: insertErr } = await supabase.from("ride_ratings").insert({
      ride_id: ride.id,
      rated_by: ride.rider_id,
      rated_user: ride.driver_id,
      rating,
      comment,
    });

    if (insertErr) {
      console.error("[guest-rate] insert error:", insertErr.message);
      return json({ error: "Could not save your rating." }, 500);
    }

    return json({ success: true });
  } catch (e: any) {
    console.error("[guest-rate] error:", e?.message || e);
    return json({ error: "Server error" }, 500);
  }
});
