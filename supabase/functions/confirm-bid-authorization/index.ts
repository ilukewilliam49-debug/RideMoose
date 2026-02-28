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

    const { ride_id, bid_id, payment_intent_id } = await req.json();
    if (!ride_id || !bid_id || !payment_intent_id) {
      throw new Error("ride_id, bid_id, and payment_intent_id required");
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify payment intent status
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (pi.status !== "requires_capture") {
      throw new Error(`Payment not authorized. Status: ${pi.status}`);
    }

    // Fetch bid
    const { data: bid, error: bidErr } = await serviceClient
      .from("delivery_bids")
      .select("*")
      .eq("id", bid_id)
      .eq("ride_id", ride_id)
      .eq("status", "pending")
      .single();
    if (bidErr || !bid) throw new Error("Bid not found or already processed");

    const offerCents = bid.offer_amount_cents;
    const commissionCents = Math.round(offerCents * 0.08);
    const stripeFeeCents = Math.round(offerCents * 0.029 + 30);
    const driverEarnings = offerCents - commissionCents - stripeFeeCents;

    // Accept the winning bid
    await serviceClient
      .from("delivery_bids")
      .update({ status: "accepted" })
      .eq("id", bid_id);

    // Reject other pending bids
    await serviceClient
      .from("delivery_bids")
      .update({ status: "rejected" })
      .eq("ride_id", ride_id)
      .neq("id", bid_id)
      .eq("status", "pending");

    // Assign driver and update ride
    await serviceClient
      .from("rides")
      .update({
        driver_id: bid.driver_id,
        status: "accepted",
        estimated_price: offerCents / 100,
        final_fare_cents: offerCents,
        authorized_amount_cents: offerCents,
        payment_status: "authorized",
        payment_option: "in_app",
        commission_cents: commissionCents,
        stripe_fee_cents: stripeFeeCents,
        driver_earnings_cents: driverEarnings,
        service_fee_cents: 0, // no service fee on large delivery bids
      })
      .eq("id", ride_id);

    // Notify the driver
    await serviceClient.from("notifications").insert({
      user_id: bid.driver_id,
      title: "Your Bid Was Accepted!",
      body: `Your bid of $${(offerCents / 100).toFixed(2)} has been accepted. Head to the pickup location.`,
      type: "bid_accepted",
      ride_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        driver_id: bid.driver_id,
        amount_cents: offerCents,
        commission_cents: commissionCents,
        driver_earnings_cents: driverEarnings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("confirm-bid-authorization error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
