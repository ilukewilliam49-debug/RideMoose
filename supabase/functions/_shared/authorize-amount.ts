/**
 * SHARED AUTHORIZATION-AMOUNT GUARD.
 *
 * Both `create-payment-intent` and `pay-with-saved-card` accept
 * `estimated_fare_cents` from the client. The contract — enforced here —
 * is that this value is the **bylaw subtotal** (base + distance + waiting +
 * surcharges) BEFORE GST and BEFORE the $0.97 PickYou platform fee.
 *
 * Why this matters
 * ----------------
 * If the client accidentally sends the GST-inclusive total instead of the
 * pre-tax subtotal, our edge functions would then ADD 5% GST + $0.97 on top
 * again — double-charging the rider. Conversely, sending an obviously
 * tampered low value (e.g. 1¢) would let a malicious client pin the Stripe
 * authorization to the floor and stiff the driver on capture.
 *
 * This module:
 *   1. Validates `estimated_fare_cents` is a finite positive integer.
 *   2. Computes the authorization amount (125% of fare-with-extras, clamped
 *      to [$20, $500]) using one canonical formula.
 *   3. Returns a structured result so callers can return a clean 400 on
 *      bad input rather than silently mis-charging.
 */

import { FALLBACK_BYLAW_RATES } from "./pricing.ts";

export const AUTH_FLOOR_CENTS = 2000; // $20 minimum hold
export const AUTH_CEILING_CENTS = 50000; // $500 maximum hold
export const AUTH_BUFFER_MULTIPLIER = 1.25; // 125% of expected total

/**
 * Maximum plausible bylaw subtotal in cents. Anything above this for a single
 * Yellowknife metered ride is almost certainly the wrong field (e.g. someone
 * passed dollars instead of cents, or passed an account balance). The bylaw
 * itself caps at ~$200–$300 for the longest realistic in-territory trip;
 * we leave headroom to $1,000.
 */
export const MAX_REASONABLE_SUBTOTAL_CENTS = 100_000;

/**
 * The smallest plausible bylaw subtotal in cents. Below the flag rate
 * ($4.70 = 470¢) the value cannot be a real metered ride.
 */
export const MIN_REASONABLE_SUBTOTAL_CENTS = FALLBACK_BYLAW_RATES.base_fare_cents;

export type ValidationFailure = {
  ok: false;
  /** Stable machine-readable code; safe to surface to the client. */
  code:
    | "missing"
    | "not_integer"
    | "not_positive"
    | "below_min"
    | "above_max"
    | "looks_gst_inclusive";
  message: string;
};

export type ValidationSuccess = {
  ok: true;
  /** Subtotal echoed back, for callers that want to log it. */
  subtotalCents: number;
  /** Subtotal + (GST + $0.97 fee if Private Hire). */
  fareWithExtrasCents: number;
  /** Final clamped amount to send to Stripe. */
  authorizedAmountCents: number;
  /** True iff GST + platform fee were added. */
  isPrivateHire: boolean;
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validate `estimated_fare_cents` and compute the Stripe authorization amount.
 *
 * @param estimatedFareCents Raw client-provided value. Must be the pre-tax,
 *   pre-fee bylaw subtotal in integer cents.
 * @param serviceType "taxi", "private_hire", or any other service identifier.
 * @param previouslyAuthorizedSubtotal Optional. If supplied (e.g. when
 *   reusing a prior PI), used to detect drift.
 */
export function validateAndComputeAuthorization(
  estimatedFareCents: unknown,
  serviceType: string | null | undefined,
  previouslyAuthorizedSubtotal?: number,
): ValidationResult {
  if (estimatedFareCents === undefined || estimatedFareCents === null) {
    return {
      ok: false,
      code: "missing",
      message: "estimated_fare_cents is required",
    };
  }

  if (
    typeof estimatedFareCents !== "number" ||
    !Number.isFinite(estimatedFareCents) ||
    !Number.isInteger(estimatedFareCents)
  ) {
    return {
      ok: false,
      code: "not_integer",
      message: "estimated_fare_cents must be a finite integer (cents)",
    };
  }

  if (estimatedFareCents <= 0) {
    return {
      ok: false,
      code: "not_positive",
      message: "estimated_fare_cents must be greater than zero",
    };
  }

  if (estimatedFareCents < MIN_REASONABLE_SUBTOTAL_CENTS) {
    return {
      ok: false,
      code: "below_min",
      message:
        `estimated_fare_cents (${estimatedFareCents}) is below the bylaw flag rate ` +
        `(${MIN_REASONABLE_SUBTOTAL_CENTS}¢); refusing to authorize a payment hold.`,
    };
  }

  if (estimatedFareCents > MAX_REASONABLE_SUBTOTAL_CENTS) {
    return {
      ok: false,
      code: "above_max",
      message:
        `estimated_fare_cents (${estimatedFareCents}) exceeds the maximum plausible ` +
        `bylaw subtotal (${MAX_REASONABLE_SUBTOTAL_CENTS}¢); refusing to authorize.`,
    };
  }

  const isPrivateHire = serviceType === "private_hire";

  // Drift heuristic: if the caller provided the previously authorized
  // subtotal, and the new value is suspiciously close to (prev + 5% + 97¢),
  // the client almost certainly sent the total a second time. Refuse.
  if (
    isPrivateHire &&
    previouslyAuthorizedSubtotal &&
    previouslyAuthorizedSubtotal >= MIN_REASONABLE_SUBTOTAL_CENTS
  ) {
    const expectedTotalIfDoubled =
      previouslyAuthorizedSubtotal +
      Math.round(previouslyAuthorizedSubtotal * FALLBACK_BYLAW_RATES.pickyou_gst_rate) +
      FALLBACK_BYLAW_RATES.pickyou_platform_fee_cents;
    // 1¢ rounding tolerance.
    if (Math.abs(estimatedFareCents - expectedTotalIfDoubled) <= 1) {
      return {
        ok: false,
        code: "looks_gst_inclusive",
        message:
          "estimated_fare_cents matches the GST+fee-inclusive total of the previous " +
          "authorization. Send the bylaw subtotal (pre-tax, pre-fee), not the total.",
      };
    }
  }

  let fareWithExtrasCents = estimatedFareCents;
  if (isPrivateHire) {
    const taxCents = Math.round(
      estimatedFareCents * FALLBACK_BYLAW_RATES.pickyou_gst_rate,
    );
    fareWithExtrasCents =
      estimatedFareCents +
      taxCents +
      FALLBACK_BYLAW_RATES.pickyou_platform_fee_cents;
  }

  const authorizedAmountCents = Math.min(
    Math.max(
      Math.round(fareWithExtrasCents * AUTH_BUFFER_MULTIPLIER),
      AUTH_FLOOR_CENTS,
    ),
    AUTH_CEILING_CENTS,
  );

  return {
    ok: true,
    subtotalCents: estimatedFareCents,
    fareWithExtrasCents,
    authorizedAmountCents,
    isPrivateHire,
  };
}
