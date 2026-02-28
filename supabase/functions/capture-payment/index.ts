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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Unauthorized");

    const { ride_id } = await req.json();
    if (!ride_id) throw new Error("ride_id required");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch platform config
    const { data: configRows } = await serviceClient
      .from("platform_config")
      .select("key, value");
    const cfg: Record<string, number> = {};
    (configRows || []).forEach((r: { key: string; value: number }) => {
      cfg[r.key] = Number(r.value);
    });

    const STRIPE_RATE = (cfg.stripe_rate_percent ?? 2.9) / 100;
    const STRIPE_FIXED_CENTS = cfg.stripe_fixed_cents ?? 30;

    // Fetch ride
    const { data: ride, error: rideError } = await serviceClient
      .from("rides")
      .select("*")
      .eq("id", ride_id)
      .single();
    if (rideError || !ride) throw new Error("Ride not found");

    // Fetch driver profile for per-driver commission & promo
    let effectiveCommissionRate = cfg.commission_rate ? cfg.commission_rate / 100 : 0;
    let inPromo = false;

    if (ride.driver_id) {
      const { data: driverProfile } = await serviceClient
        .from("profiles")
        .select("commission_rate, promo_commission_rate, promo_end_date, driver_balance_cents")
        .eq("id", ride.driver_id)
        .single();

      if (driverProfile) {
        const now = new Date();
        if (driverProfile.promo_end_date && now <= new Date(driverProfile.promo_end_date)) {
          effectiveCommissionRate = Number(driverProfile.promo_commission_rate ?? 0);
          inPromo = true;
        } else {
          effectiveCommissionRate = Number(driverProfile.commission_rate ?? 0.049);
        }
      }
    }

    const grossFareCents = ride.final_fare_cents || 0;
    const commissionCents = Math.round(grossFareCents * effectiveCommissionRate);
    // During promo: no service fee. After promo: use config value.
    const SERVICE_FEE_CENTS = inPromo ? 0 : (cfg.service_fee_cents ?? 99);
    const riderTotalCents = grossFareCents + SERVICE_FEE_CENTS;

    // Organization billing — skip Stripe
    if (ride.billed_to === "organization" && ride.organization_id) {
      const driverEarnings = grossFareCents - commissionCents;

      const { data: org } = await serviceClient
        .from("organizations")
        .select("current_balance_cents")
        .eq("id", ride.organization_id)
        .single();

      if (org) {
        await serviceClient
          .from("organizations")
          .update({ current_balance_cents: (org.current_balance_cents || 0) + riderTotalCents })
          .eq("id", ride.organization_id);
      }

      await serviceClient
        .from("rides")
        .update({
          captured_amount_cents: 0,
          outstanding_amount_cents: 0,
          payment_status: "invoiced_pending",
          service_fee_cents: SERVICE_FEE_CENTS,
          commission_cents: commissionCents,
          stripe_fee_cents: 0,
          driver_earnings_cents: driverEarnings,
        })
        .eq("id", ride_id);

      return new Response(
        JSON.stringify({ status: "invoiced_pending", amount_cents: riderTotalCents }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // pay_driver: no Stripe, but track commission owed
    if (ride.payment_option === "pay_driver") {
      const driverEarnings = grossFareCents - commissionCents;

      if (ride.driver_id) {
        const { data: driverProfile } = await serviceClient
          .from("profiles")
          .select("driver_balance_cents")
          .eq("id", ride.driver_id)
          .single();

        if (driverProfile) {
          await serviceClient
            .from("profiles")
            .update({
              driver_balance_cents: (driverProfile.driver_balance_cents || 0) + commissionCents,
            })
            .eq("id", ride.driver_id);
        }
      }

      await serviceClient
        .from("rides")
        .update({
          captured_amount_cents: 0,
          outstanding_amount_cents: 0,
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          service_fee_cents: SERVICE_FEE_CENTS,
          commission_cents: commissionCents,
          stripe_fee_cents: 0,
          driver_earnings_cents: driverEarnings,
        })
        .eq("id", ride_id);

      return new Response(
        JSON.stringify({ status: "paid_driver", driver_earnings_cents: driverEarnings, commission_cents: commissionCents }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // in_app Stripe flow
    if (!ride.stripe_payment_intent_id) throw new Error("No payment intent for this ride");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const stripeFeeCents = Math.round(riderTotalCents * STRIPE_RATE + STRIPE_FIXED_CENTS);
    const driverEarnings = grossFareCents - commissionCents - stripeFeeCents;
    const authorizedAmount = ride.authorized_amount_cents || 0;

    const earningsUpdate = {
      service_fee_cents: SERVICE_FEE_CENTS,
      commission_cents: commissionCents,
      stripe_fee_cents: stripeFeeCents,
      driver_earnings_cents: driverEarnings,
    };

    if (riderTotalCents <= authorizedAmount) {
      await stripe.paymentIntents.capture(ride.stripe_payment_intent_id, {
        amount_to_capture: riderTotalCents,
      });

      await serviceClient
        .from("rides")
        .update({
          captured_amount_cents: riderTotalCents,
          outstanding_amount_cents: 0,
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          ...earningsUpdate,
        })
        .eq("id", ride_id);

      return new Response(
        JSON.stringify({ status: "captured", amount_cents: riderTotalCents }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    } else {
      await stripe.paymentIntents.capture(ride.stripe_payment_intent_id);

      const overage = riderTotalCents - authorizedAmount;

      await serviceClient
        .from("rides")
        .update({
          captured_amount_cents: authorizedAmount,
          outstanding_amount_cents: overage,
          outstanding_reason: "fare_exceeded_authorization",
          payment_status: "partial",
          ...earningsUpdate,
        })
        .eq("id", ride_id);

      return new Response(
        JSON.stringify({
          status: "partial",
          captured_cents: authorizedAmount,
          outstanding_cents: overage,
          outstanding_reason: "fare_exceeded_authorization",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("capture-payment error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
