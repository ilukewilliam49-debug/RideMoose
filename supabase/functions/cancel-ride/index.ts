/**
 * cancel-ride
 *
 * Server-authoritative rider cancellation. The client (rider) is no longer
 * trusted to set `cancellation_fee_cents` — it's computed here based on the
 * ride's current status and (eventually) collected via Stripe.
 *
 * Fee policy (matches CancelRideDialog UI copy):
 *   • status = 'requested'  → $0 (no driver impacted)
 *   • status = 'accepted'   → $5.00 (driver dispatched)
 *
 * The function runs as service_role, which bypasses the locked-down
 * "Riders can cancel own rides" RLS WITH CHECK that blocks direct writes
 * to financial columns.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACCEPTED_CANCEL_FEE_CENTS = 500; // $5.00 driver-protection fee
const ALLOWED_REASONS = new Set([
  "changed_plans",
  "driver_too_far",
  "wrong_address",
  "found_other_ride",
  "too_long_wait",
  "other",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization header" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    // Parse + validate body
    let body: { ride_id?: unknown; reason?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const ride_id = typeof body.ride_id === "string" ? body.ride_id : null;
    const reason = typeof body.reason === "string" ? body.reason : null;
    if (!ride_id || !/^[0-9a-f-]{36}$/i.test(ride_id)) {
      return json({ error: "ride_id must be a valid UUID" }, 400);
    }
    if (!reason || !ALLOWED_REASONS.has(reason)) {
      return json({ error: "Invalid cancellation reason" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve caller profile id
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) return json({ error: "Profile not found" }, 404);

    // Fetch ride
    const { data: ride, error: rideErr } = await admin
      .from("rides")
      .select(
        "id, rider_id, status, stripe_payment_intent_id, authorized_amount_cents, payment_status",
      )
      .eq("id", ride_id)
      .maybeSingle();
    if (rideErr || !ride) return json({ error: "Ride not found" }, 404);

    if (ride.rider_id !== profile.id) {
      return json({ error: "Not your ride" }, 403);
    }
    if (!["requested", "accepted"].includes(ride.status)) {
      return json(
        {
          error: "Ride can no longer be cancelled by rider",
          code: "invalid_status",
          current_status: ride.status,
        },
        409,
      );
    }

    // Idempotency: if already cancelled, just return success
    // (covered by the status check above)

    // Server-authoritative fee computation
    const cancellationFeeCents =
      ride.status === "accepted" ? ACCEPTED_CANCEL_FEE_CENTS : 0;

    // 1) Update ride row (service_role bypasses RLS WITH CHECK)
    const { error: updErr } = await admin
      .from("rides")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        cancellation_fee_cents: cancellationFeeCents,
      })
      .eq("id", ride_id)
      .in("status", ["requested", "accepted"]); // optimistic concurrency
    if (updErr) {
      console.error("[cancel-ride] update failed:", updErr.message);
      return json({ error: "Failed to cancel ride" }, 500);
    }

    // 2) Stripe handling — the ride likely has a manual-capture authorization
    //    on file. We must always release the hold; if a fee applies we
    //    capture exactly that amount, otherwise we cancel the intent.
    let stripe_outcome: string = "no_payment_intent";
    if (ride.stripe_payment_intent_id) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        try {
          if (cancellationFeeCents > 0) {
            // Stripe minimum charge in CAD is $0.50; our fee is $5.00 so safe.
            await stripe.paymentIntents.capture(ride.stripe_payment_intent_id, {
              amount_to_capture: cancellationFeeCents,
            }, { idempotencyKey: `cancel-fee-${ride_id}` });
            await admin
              .from("rides")
              .update({
                captured_amount_cents: cancellationFeeCents,
                payment_status: "paid",
                paid_at: new Date().toISOString(),
              })
              .eq("id", ride_id);
            stripe_outcome = "fee_captured";
          } else {
            await stripe.paymentIntents.cancel(ride.stripe_payment_intent_id, {
              cancellation_reason: "requested_by_customer",
            }, { idempotencyKey: `cancel-${ride_id}` });
            await admin
              .from("rides")
              .update({ payment_status: "refunded" })
              .eq("id", ride_id);
            stripe_outcome = "authorization_released";
          }
        } catch (stripeErr) {
          // Don't fail the whole cancel — the ride row is already cancelled.
          // Log so an operator can reconcile.
          console.error(
            "[cancel-ride] stripe error (ride still cancelled):",
            stripeErr instanceof Error ? stripeErr.message : stripeErr,
          );
          stripe_outcome = "stripe_error";
        }
      }
    }

    // 3) Notify the driver (if one was assigned) so their UI clears
    const { data: rideAfter } = await admin
      .from("rides")
      .select("driver_id")
      .eq("id", ride_id)
      .maybeSingle();
    if (rideAfter?.driver_id) {
      await admin.from("notifications").insert({
        user_id: rideAfter.driver_id,
        title: "Ride cancelled by rider",
        body: cancellationFeeCents > 0
          ? "The rider cancelled. A $5.00 cancellation fee was charged."
          : "The rider cancelled before pickup.",
        type: "ride_cancelled",
        ride_id,
      });
    }

    return json({
      success: true,
      ride_id,
      cancellation_fee_cents: cancellationFeeCents,
      stripe_outcome,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[cancel-ride] error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
