import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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

  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Unauthorized");

    const { ride_id } = await req.json();
    if (!ride_id) throw new Error("ride_id required");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: ride, error: rideErr } = await serviceClient
      .from("rides")
      .select("stripe_payment_intent_id, payment_status, service_type")
      .eq("id", ride_id)
      .single();
    if (rideErr || !ride) throw new Error("Ride not found");

    if (ride.service_type !== "large_delivery") {
      throw new Error("Not a large delivery ride");
    }

    // Cancel the PaymentIntent if it exists and is authorized
    if (ride.stripe_payment_intent_id && ride.payment_status === "authorized") {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      await stripe.paymentIntents.cancel(ride.stripe_payment_intent_id);

      await serviceClient
        .from("rides")
        .update({
          payment_status: "refunded",
          authorized_amount_cents: 0,
          captured_amount_cents: 0,
        })
        .eq("id", ride_id);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Payment hold released" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("cancel-bid-payment error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
