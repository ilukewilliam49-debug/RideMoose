/**
 * Client-side guard that mirrors `supabase/functions/_shared/authorize-amount.ts`.
 *
 * The contract: `estimated_fare_cents` sent to `create-payment-intent` and
 * `pay-with-saved-card` MUST be the **bylaw subtotal** (base + distance +
 * waiting + surcharges) BEFORE GST and BEFORE the $0.97 PickYou platform fee.
 *
 * If the client mistakenly sends a GST-inclusive total, the edge function
 * would add 5% GST + $0.97 again — double-charging the rider. Validating
 * here lets us surface a clear toast instead of leaking a bad value to the
 * server, where it would be rejected as a generic 400.
 */
import { FALLBACK_BYLAW_RATES } from "./pricing";

export const SUBTOTAL_MIN_CENTS = FALLBACK_BYLAW_RATES.base_fare_cents; // $4.70 flag
export const SUBTOTAL_MAX_CENTS = 100_000; // $1,000 sanity ceiling

export type SubtotalIssueCode =
  | "missing"
  | "not_integer"
  | "not_positive"
  | "below_min"
  | "above_max"
  | "looks_gst_inclusive";

export type SubtotalValidation =
  | { ok: true; subtotalCents: number }
  | { ok: false; code: SubtotalIssueCode; message: string };

/**
 * Validate a candidate `estimated_fare_cents` value before sending it.
 *
 * @param value Raw value (any type — we coerce/validate defensively).
 * @param opts.serviceType Used only for the GST-inclusive heuristic.
 * @param opts.previousSubtotalCents If supplied, we detect drift suggesting
 *   the caller passed `prev + 5% + 97¢` (i.e. the GST-inclusive total).
 */
export function validateFareSubtotalCents(
  value: unknown,
  opts: {
    serviceType?: string | null;
    previousSubtotalCents?: number;
  } = {},
): SubtotalValidation {
  if (value === undefined || value === null) {
    return {
      ok: false,
      code: "missing",
      message: "Fare amount is missing. Please re-enter your trip details.",
    };
  }

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return {
      ok: false,
      code: "not_integer",
      message: "Fare amount is invalid. Please refresh and try again.",
    };
  }

  if (value <= 0) {
    return {
      ok: false,
      code: "not_positive",
      message: "Fare amount must be greater than zero.",
    };
  }

  if (value < SUBTOTAL_MIN_CENTS) {
    return {
      ok: false,
      code: "below_min",
      message:
        `Fare amount ($${(value / 100).toFixed(2)}) is below the minimum ` +
        `flag rate ($${(SUBTOTAL_MIN_CENTS / 100).toFixed(2)}). ` +
        "Please refresh your estimate.",
    };
  }

  if (value > SUBTOTAL_MAX_CENTS) {
    return {
      ok: false,
      code: "above_max",
      message:
        `Fare amount ($${(value / 100).toFixed(2)}) exceeds the maximum ` +
        "for a single ride. Please review your trip details.",
    };
  }

  // Heuristic: detect when caller passed the GST+fee-inclusive total instead
  // of the pre-tax subtotal. Only meaningful for private_hire (taxi has no
  // GST, so there's nothing to double-count).
  if (
    opts.serviceType === "private_hire" &&
    opts.previousSubtotalCents &&
    opts.previousSubtotalCents >= SUBTOTAL_MIN_CENTS
  ) {
    const prev = opts.previousSubtotalCents;
    const expectedTotalIfDoubled =
      prev +
      Math.round(prev * FALLBACK_BYLAW_RATES.pickyou_gst_rate) +
      FALLBACK_BYLAW_RATES.pickyou_platform_fee_cents;
    if (Math.abs(value - expectedTotalIfDoubled) <= 1) {
      return {
        ok: false,
        code: "looks_gst_inclusive",
        message:
          "Fare appears to already include GST and the service fee. " +
          "Please refresh — only the pre-tax subtotal should be sent.",
      };
    }
  }

  return { ok: true, subtotalCents: value };
}
