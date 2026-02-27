import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Auth check — must be admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Unauthorized");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify admin role
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();
    if (!profile || profile.role !== "admin") throw new Error("Admin access required");

    const { organization_id } = await req.json();
    if (!organization_id) throw new Error("organization_id required");

    // Fetch org
    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .select("*")
      .eq("id", organization_id)
      .single();
    if (orgError || !org) throw new Error("Organization not found");

    // Fetch uninvoiced rides for this org
    const { data: rides, error: ridesError } = await serviceClient
      .from("rides")
      .select("id, pickup_address, dropoff_address, final_fare_cents, final_price, completed_at, rider_id, service_type")
      .eq("organization_id", organization_id)
      .eq("billed_to", "organization")
      .eq("invoiced", false)
      .eq("status", "completed")
      .order("completed_at", { ascending: true });

    if (ridesError) throw new Error(ridesError.message);
    if (!rides || rides.length === 0) {
      return new Response(
        JSON.stringify({ error: "No uninvoiced rides for this organization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const totalCents = rides.reduce((sum, r) => sum + (r.final_fare_cents || Math.round((r.final_price || 0) * 100)), 0);

    // Mark all rides as invoiced
    const rideIds = rides.map((r) => r.id);
    await serviceClient
      .from("rides")
      .update({ invoiced: true })
      .in("id", rideIds);

    // Return invoice summary
    const invoice = {
      organization_id: org.id,
      organization_name: org.name,
      billing_email: org.billing_email,
      generated_at: new Date().toISOString(),
      payment_terms_days: org.payment_terms_days,
      total_cents: totalCents,
      ride_count: rides.length,
      rides: rides.map((r) => ({
        id: r.id,
        pickup: r.pickup_address,
        dropoff: r.dropoff_address,
        fare_cents: r.final_fare_cents || Math.round((r.final_price || 0) * 100),
        completed_at: r.completed_at,
        service_type: r.service_type,
      })),
    };

    return new Response(JSON.stringify(invoice), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-invoice error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
