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

    const { bid_id, ride_id } = await req.json();
    if (!bid_id || !ride_id) throw new Error("bid_id and ride_id required");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the rider owns this ride
    const { data: riderProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", userData.user.id)
      .single();
    if (!riderProfile) throw new Error("Profile not found");

    const { data: ride, error: rideErr } = await serviceClient
      .from("rides")
      .select("*")
      .eq("id", ride_id)
      .single();
    if (rideErr || !ride) throw new Error("Ride not found");
    if (ride.rider_id !== riderProfile.id) throw new Error("Not your ride");
    if (ride.service_type !== "large_delivery") throw new Error("Not a large delivery ride");

    // Fetch the bid
    const { data: bid, error: bidErr } = await serviceClient
      .from("delivery_bids")
      .select("*")
      .eq("id", bid_id)
      .eq("ride_id", ride_id)
      .eq("status", "pending")
      .single();
    if (bidErr || !bid) throw new Error("Bid not found or already processed");

    const amountCents = bid.offer_amount_cents;

    // Create Stripe PaymentIntent with manual capture
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({
      email: userData.user.email,
      limit: 1,
    });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const newCustomer = await stripe.customers.create({
        email: userData.user.email!,
      });
      customerId = newCustomer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      capture_method: "manual",
      automatic_payment_methods: { enabled: true },
      metadata: {
        ride_id,
        bid_id,
        type: "large_delivery",
      },
    });

    // Store payment intent on ride but don't assign driver yet
    // The client will confirm the payment, then call back to finalize
    await serviceClient
      .from("rides")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        authorized_amount_cents: amountCents,
        payment_status: "unpaid", // will become "authorized" after client confirms
      })
      .eq("id", ride_id);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        bid_id,
        amount_cents: amountCents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("authorize-bid error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
