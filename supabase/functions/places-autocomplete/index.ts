import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input } = await req.json();
    if (!input || input.length < 2) {
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GOOGLE_MAPS_API_KEY not configured",
          code: "MISSING_API_KEY",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Bias results to Northwest Territories (centered on Yellowknife)
    // Append "Yellowknife" context for short/generic queries to overcome Google's population bias
    const needsContext = input.trim().split(/\s+/).length <= 2 && !/yellowknife|nt\b/i.test(input);
    const searchInput = needsContext ? `${input} Yellowknife NT` : input;

    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", searchInput);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("components", "country:ca");
    url.searchParams.set("location", "62.454,-114.372");
    url.searchParams.set("radius", "500000");

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Google Places API error:", data.status, data.error_message);
      // Map Google's auth/billing failure modes to a stable client-facing code
      const authStatuses = new Set([
        "REQUEST_DENIED",
        "INVALID_REQUEST",
        "OVER_QUERY_LIMIT",
        "OVER_DAILY_LIMIT",
      ]);
      const code = authStatuses.has(data.status) ? "INVALID_API_KEY" : "UPSTREAM_ERROR";
      return new Response(
        JSON.stringify({
          error: `Google Places API error: ${data.status}`,
          details: data.error_message ?? null,
          code,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter to only NT results
    const ntPattern = /\bnt\b/i;
    const predictions = (data.predictions || [])
      .filter((p: any) => {
        const desc = p.description;
        return ntPattern.test(desc) || /northwest territories/i.test(desc) || /yellowknife/i.test(desc);
      })
      .map((p: any) => ({
        description: p.description,
        place_id: p.place_id,
      }));

    return new Response(JSON.stringify({ predictions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message, code: "UNKNOWN" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
