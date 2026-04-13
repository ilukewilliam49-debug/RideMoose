import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PICKYOU_SURCHARGE_CENTS = 120; // $1.20

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Unauthorized");
    const user = userData.user;

    const { ride_id, estimated_fare_cents, service_type } = await req.json();
    if (!ride_id || !estimated_fare_cents) throw new Error("ride_id and estimated_fare_cents required");

    const isPrivateHire = service_type === "private_hire";

    // Taxi: no GST, no surcharge
    // Private Hire: $1.20 surcharge + 5% GST on (fare + surcharge)
    let fareWithExtras = estimated_fare_cents;
    if (isPrivateHire) {
      const subtotal = estimated_fare_cents + PICKYOU_SURCHARGE_CENTS;
      const taxCents = Math.round(subtotal * 0.05);
      fareWithExtras = subtotal + taxCents;
    }

    // Calculate authorized amount: 125% of estimate (including tax if applicable), minimum $20
    const authorized_amount_cents = Math.min(Math.max(Math.round(fareWithExtras * 1.25), 2000), 50000);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create Stripe customer
    let customerId: string | undefined;
    if (user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({ email: user.email });
        customerId = customer.id;
      }
    }

    // Create PaymentIntent with manual capture
    const paymentIntent = await stripe.paymentIntents.create({
      amount: authorized_amount_cents,
      currency: "cad",
      customer: customerId,
      capture_method: "manual",
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
        clientSecret: paymentIntent.client_secret,
        authorized_amount_cents,
        payment_intent_id: paymentIntent.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("create-payment-intent error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
