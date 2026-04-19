// Public endpoint to fetch sanitized ride tracking info for guest passengers
// Authenticated via opaque token in URL (no JWT required).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim();
    if (!token || token.length < 6 || token.length > 64) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ride, error } = await supabase
      .from("rides")
      .select(`
        id, status, service_type, pickup_address, dropoff_address,
        pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
        guest_name, scheduled_at, started_at, completed_at,
        driver_id,
        driver:profiles!rides_driver_id_fkey (
          full_name, latitude, longitude, vehicle_make, vehicle_model,
          vehicle_color, license_plate, average_rating
        )
      `)
      .eq("guest_track_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!ride) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let etaMin: number | null = null;
    const driver: any = ride.driver;
    const isEnRoute = ride.status === "accepted";
    const isOnTrip = ride.status === "in_progress";

    return new Response(JSON.stringify({
      status: ride.status,
      service_type: ride.service_type,
      pickup_address: ride.pickup_address,
      pickup_lat: ride.pickup_lat,
      pickup_lng: ride.pickup_lng,
      dropoff_address: ride.dropoff_address,
      dropoff_lat: ride.dropoff_lat,
      dropoff_lng: ride.dropoff_lng,
      guest_name: ride.guest_name,
      scheduled_at: ride.scheduled_at,
      started_at: ride.started_at,
      completed_at: ride.completed_at,
      driver: driver ? {
        name: driver.full_name?.split(" ")[0] || "Driver",
        vehicle: [driver.vehicle_color, driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(" ") || null,
        license_plate: driver.license_plate || null,
        rating: driver.average_rating,
        lat: isEnRoute || isOnTrip ? driver.latitude : null,
        lng: isEnRoute || isOnTrip ? driver.longitude : null,
      } : null,
      eta_min: etaMin,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[guest-track] error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
