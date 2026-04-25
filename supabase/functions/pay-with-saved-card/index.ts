import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { validateAndComputeAuthorization } from "../_shared/authorize-amount.ts";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Unauthorized");
    const user = userData.user;

    const { ride_id, payment_method_id, estimated_fare_cents, service_type } = await req.json();
    if (!ride_id || !payment_method_id) {
      throw new Error("ride_id and payment_method_id required");
    }

    // Server-side authorization-amount validation. `estimated_fare_cents` MUST
    // be the bylaw subtotal (pre-tax, pre-fee). The shared validator is the
    // ONLY place that adds GST + the $0.97 fee, so neither field can be
    // double-counted no matter what the client sends.
    const validation = validateAndComputeAuthorization(
      estimated_fare_cents,
      service_type,
    );
    if (!validation.ok) {
      console.warn("pay-with-saved-card rejected input:", validation);
      return new Response(
        JSON.stringify({ error: validation.message, code: validation.code }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }
    const authorized_amount_cents = validation.authorizedAmountCents;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find Stripe customer
    let customerId: string | undefined;
    if (user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }
    if (!customerId) throw new Error("No Stripe customer found. Please use a new card first.");

    // Create and confirm PaymentIntent with saved card
    const paymentIntent = await stripe.paymentIntents.create({
      amount: authorized_amount_cents,
      currency: "cad",
      customer: customerId,
      payment_method: payment_method_id,
      capture_method: "manual",
      confirm: true,
      off_session: true,
      metadata: { ride_id, service_type: service_type || "taxi" },
    });

    // Update ride with payment info
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    await serviceClient
      .from("rides")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        authorized_amount_cents,
        payment_status: "authorized",
      })
      .eq("id", ride_id);

    return new Response(
      JSON.stringify({
        success: true,
        authorized_amount_cents,
        payment_intent_id: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("pay-with-saved-card error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
