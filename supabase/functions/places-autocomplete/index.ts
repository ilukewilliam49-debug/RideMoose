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
      throw new Error("GOOGLE_MAPS_API_KEY not configured");
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
      throw new Error(`Google Places API error: ${data.status}`);
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
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
