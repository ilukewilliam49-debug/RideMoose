import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin_lat, origin_lng, dest_lat, dest_lng } = await req.json();
    if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
      throw new Error("Missing origin/destination coordinates");
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY not configured");
    }

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `${origin_lat},${origin_lng}`);
    url.searchParams.set("destination", `${dest_lat},${dest_lng}`);
    url.searchParams.set("departure_time", "now");
    url.searchParams.set("traffic_model", "best_guess");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK") {
      console.error("Google Directions API error:", data.status, data.error_message);
      throw new Error(`Google Directions API error: ${data.status}`);
    }

    const leg = data.routes?.[0]?.legs?.[0];
    if (!leg) {
      throw new Error("No route found");
    }

    const result = {
      distance_km: (leg.distance?.value || 0) / 1000,
      duration_sec: leg.duration?.value || 0,
      duration_text: leg.duration?.text || "",
      duration_in_traffic_sec: leg.duration_in_traffic?.value || leg.duration?.value || 0,
      duration_in_traffic_text: leg.duration_in_traffic?.text || leg.duration?.text || "",
      polyline: data.routes?.[0]?.overview_polyline?.points || null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
