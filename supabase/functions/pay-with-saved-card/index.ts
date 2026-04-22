import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PICKYOU_PLATFORM_FEE_CENTS = 97; // $0.97 bylaw-aligned platform fee

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
    if (!ride_id || !payment_method_id || !estimated_fare_cents) {
      throw new Error("ride_id, payment_method_id, and estimated_fare_cents required");
    }

    // Taxi: no GST, no platform fee (city-regulated meter only).
    // Private Hire: 5% GST on the metered subtotal, then add the $0.97
    // platform fee POST-TAX. Mirrors src/lib/pricing.ts (single source of
    // truth) and src/components/rider/RideReceipt.tsx exactly.
    const isPrivateHire = service_type === "private_hire";
    let fareWithExtras = estimated_fare_cents;
    if (isPrivateHire) {
      const taxCents = Math.round(estimated_fare_cents * 0.05);
      fareWithExtras = estimated_fare_cents + taxCents + PICKYOU_PLATFORM_FEE_CENTS;
    }

    const authorized_amount_cents = Math.min(Math.max(Math.round(fareWithExtras * 1.25), 2000), 50000);

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
