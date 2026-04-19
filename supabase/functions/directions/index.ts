import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Waypoint {
  lat: number;
  lng: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { origin_lat, origin_lng, dest_lat, dest_lng, waypoints } = body;
    if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
      throw new Error("Missing origin/destination coordinates");
    }

    // Validate waypoints (max 3 intermediate stops)
    let safeWaypoints: Waypoint[] = [];
    if (Array.isArray(waypoints)) {
      if (waypoints.length > 3) {
        throw new Error("Maximum 3 waypoints supported");
      }
      safeWaypoints = waypoints
        .filter((w: any) =>
          w &&
          typeof w.lat === "number" &&
          typeof w.lng === "number" &&
          w.lat >= -90 && w.lat <= 90 &&
          w.lng >= -180 && w.lng <= 180
        )
        .map((w: any) => ({ lat: w.lat, lng: w.lng }));
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY not configured");
    }

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `${origin_lat},${origin_lng}`);
    url.searchParams.set("destination", `${dest_lat},${dest_lng}`);
    if (safeWaypoints.length > 0) {
      // Preserve the order of waypoints exactly as the rider entered them.
      const wpStr = safeWaypoints.map((w) => `${w.lat},${w.lng}`).join("|");
      url.searchParams.set("waypoints", wpStr);
    }
    url.searchParams.set("departure_time", "now");
    url.searchParams.set("traffic_model", "best_guess");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK") {
      console.error("Google Directions API error:", data.status, data.error_message);
      throw new Error(`Google Directions API error: ${data.status}`);
    }

    const route = data.routes?.[0];
    const legs = route?.legs || [];
    if (legs.length === 0) {
      throw new Error("No route found");
    }

    // Aggregate across all legs (origin → wp1 → wp2 ... → dest)
    let totalDistanceM = 0;
    let totalDurationSec = 0;
    let totalDurationInTrafficSec = 0;
    const allSteps: any[] = [];
    const legSummaries: Array<{
      distance_km: number;
      duration_sec: number;
      duration_text: string;
      duration_in_traffic_sec: number;
      duration_in_traffic_text: string;
    }> = [];

    for (const leg of legs) {
      totalDistanceM += leg.distance?.value || 0;
      totalDurationSec += leg.duration?.value || 0;
      totalDurationInTrafficSec += leg.duration_in_traffic?.value || leg.duration?.value || 0;

      legSummaries.push({
        distance_km: (leg.distance?.value || 0) / 1000,
        duration_sec: leg.duration?.value || 0,
        duration_text: leg.duration?.text || "",
        duration_in_traffic_sec: leg.duration_in_traffic?.value || leg.duration?.value || 0,
        duration_in_traffic_text: leg.duration_in_traffic?.text || leg.duration?.text || "",
      });

      for (const step of leg.steps || []) {
        allSteps.push({
          instruction: step.html_instructions || "",
          distance_text: step.distance?.text || "",
          distance_m: step.distance?.value || 0,
          duration_text: step.duration?.text || "",
          duration_sec: step.duration?.value || 0,
          maneuver: step.maneuver || null,
          start_lat: step.start_location?.lat,
          start_lng: step.start_location?.lng,
          end_lat: step.end_location?.lat,
          end_lng: step.end_location?.lng,
        });
      }
    }

    const fmtDuration = (sec: number) => {
      const m = Math.round(sec / 60);
      if (m < 60) return `${m} mins`;
      const h = Math.floor(m / 60);
      const rem = m % 60;
      return rem ? `${h} hr ${rem} mins` : `${h} hr`;
    };

    const result = {
      distance_km: totalDistanceM / 1000,
      duration_sec: totalDurationSec,
      duration_text: fmtDuration(totalDurationSec),
      duration_in_traffic_sec: totalDurationInTrafficSec,
      duration_in_traffic_text: fmtDuration(totalDurationInTrafficSec),
      polyline: route?.overview_polyline?.points || null,
      steps: allSteps,
      legs: legSummaries,
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
