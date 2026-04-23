import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Stripe PI statuses that still hold funds and can be cancelled
const CANCELLABLE_PI_STATUSES = new Set([
  "requires_payment_method",
  "requires_capture",
  "requires_confirmation",
  "requires_action",
  "processing",
]);

async function releaseStripeHold(
  stripe: Stripe | null,
  admin: ReturnType<typeof createClient>,
  rideId: string,
  reason: "abandoned" | "requested_by_customer" | "fraudulent" | "duplicate" = "abandoned",
): Promise<{ released: boolean; status?: string; error?: string }> {
  if (!stripe) return { released: false, error: "stripe_not_configured" };

  // Re-read the ride to get the PI id (avoids stale closure data)
  const { data: ride } = await admin
    .from("rides")
    .select("id, stripe_payment_intent_id, authorized_amount_cents, captured_amount_cents, payment_status")
    .eq("id", rideId)
    .single();

  if (!ride?.stripe_payment_intent_id) {
    return { released: false, error: "no_payment_intent" };
  }

  // Don't touch already-captured / already-paid intents
  if (ride.payment_status === "paid" || (ride.captured_amount_cents ?? 0) > 0) {
    return { released: false, error: "already_captured" };
  }

  try {
    const pi = await stripe.paymentIntents.retrieve(ride.stripe_payment_intent_id);

    if (pi.status === "canceled") {
      return { released: true, status: "already_canceled" };
    }

    if (!CANCELLABLE_PI_STATUSES.has(pi.status)) {
      // succeeded / requires_capture already captured / etc.
      return { released: false, status: pi.status, error: "non_cancellable_status" };
    }

    const cancelled = await stripe.paymentIntents.cancel(
      ride.stripe_payment_intent_id,
      { cancellation_reason: reason },
      { idempotencyKey: `cleanup-cancel-${ride.id}` },
    );

    await admin
      .from("rides")
      .update({
        payment_status: "refunded",
        authorized_amount_cents: 0,
      })
      .eq("id", ride.id);

    return { released: true, status: cancelled.status };
  } catch (err: any) {
    console.error(`[cleanup-stale-rides] stripe cancel failed for ride ${ride.id}:`, err.message);
    return { released: false, error: err.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const admin = createClient(supabaseUrl, serviceKey);
    const stripe = stripeKey
      ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" })
      : null;

    if (!stripe) {
      console.warn("[cleanup-stale-rides] STRIPE_SECRET_KEY missing — Stripe holds will NOT be released");
    }

    const now = new Date();
    const results: Record<string, number> = {
      cancelled_requested: 0,
      cancelled_accepted: 0,
      reset_dispatched: 0,
      stripe_holds_released: 0,
      stripe_holds_failed: 0,
      stripe_holds_skipped: 0,
    };

    // 1. Cancel rides stuck in 'requested' for > 10 minutes
    const requestedCutoff = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const { data: staleRequested } = await admin
      .from("rides")
      .update({
        status: "cancelled",
        cancellation_reason: "Auto-cancelled: no driver accepted within 10 minutes",
      })
      .eq("status", "requested")
      .lt("created_at", requestedCutoff)
      .is("dispatched_to_driver_id", null)
      .select("id, stripe_payment_intent_id");
    results.cancelled_requested = staleRequested?.length ?? 0;

    // 2. Cancel rides stuck in 'accepted' for > 15 minutes (driver never started)
    const acceptedCutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const { data: staleAccepted } = await admin
      .from("rides")
      .update({
        status: "cancelled",
        cancellation_reason: "Auto-cancelled: driver did not start ride within 15 minutes",
      })
      .eq("status", "accepted")
      .lt("updated_at", acceptedCutoff)
      .select("id, stripe_payment_intent_id");
    results.cancelled_accepted = staleAccepted?.length ?? 0;

    // 3. Reset rides stuck in 'dispatched' past their expiry
    //    (these stay 'requested' so the PI is still wanted — no hold release)
    const { data: staleDispatched } = await admin
      .from("rides")
      .update({
        status: "requested",
        dispatched_to_driver_id: null,
        dispatch_expires_at: null,
      })
      .eq("status", "dispatched")
      .lt("dispatch_expires_at", now.toISOString())
      .select("id");
    results.reset_dispatched = staleDispatched?.length ?? 0;

    // 4. Release Stripe holds for newly cancelled rides
    const allCancelled = [
      ...(staleRequested || []),
      ...(staleAccepted || []),
    ];

    for (const ride of allCancelled) {
      if (!ride.stripe_payment_intent_id) continue;
      const result = await releaseStripeHold(stripe, admin, ride.id, "abandoned");
      if (result.released) {
        results.stripe_holds_released++;
      } else if (result.error === "already_captured" || result.error === "non_cancellable_status") {
        results.stripe_holds_skipped++;
      } else {
        results.stripe_holds_failed++;
      }
    }

    // 4b. Safety net — release holds on ANY already-cancelled ride from the
    //     last 24h whose authorization is still outstanding. Catches anything
    //     missed by previous runs (e.g. before this fix shipped, or rides
    //     cancelled by other code paths that forgot to release the hold).
    const safetyCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: orphanedHolds } = await admin
      .from("rides")
      .select("id, stripe_payment_intent_id")
      .eq("status", "cancelled")
      .gt("updated_at", safetyCutoff)
      .not("stripe_payment_intent_id", "is", null)
      .neq("payment_status", "paid")
      .neq("payment_status", "refunded")
      .gt("authorized_amount_cents", 0)
      .limit(50);

    for (const ride of orphanedHolds || []) {
      const result = await releaseStripeHold(stripe, admin, ride.id, "abandoned");
      if (result.released) {
        results.stripe_holds_released++;
      } else if (result.error === "already_captured" || result.error === "non_cancellable_status") {
        results.stripe_holds_skipped++;
      } else if (result.error !== "no_payment_intent") {
        results.stripe_holds_failed++;
      }
    }

    // 5. Notify affected riders (best-effort)
    for (const ride of allCancelled) {
      const { data: rideData } = await admin
        .from("rides")
        .select("rider_id")
        .eq("id", ride.id)
        .single();
      if (rideData) {
        await admin.from("notifications").insert({
          user_id: rideData.rider_id,
          title: "Ride cancelled",
          body: "Your ride was automatically cancelled because no driver was available. Any card hold has been released. Please try again.",
          type: "ride_cancelled",
          ride_id: ride.id,
        });
      }
    }

    console.log("[cleanup-stale-rides]", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[cleanup-stale-rides] error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
