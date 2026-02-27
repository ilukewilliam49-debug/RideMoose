import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "";
  
  return new Response(
    JSON.stringify({ publishableKey }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
});
