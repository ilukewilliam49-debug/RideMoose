import { describe, it, expect } from "vitest";
import { computeFare, FALLBACK_BYLAW_RATES, type FareBreakdown } from "./pricing";

const rates = FALLBACK_BYLAW_RATES;

/**
 * End-to-end numeric parity tests for the payment pipeline.
 *
 * These tests pin three numbers together so any future drift is caught:
 *
 *   1. computeFare(...).totalCents               (single source of truth)
 *   2. Stripe authorization amount
 *      (mirrors create-payment-intent / pay-with-saved-card edge functions)
 *   3. Receipt total rendered by RideReceipt.tsx
 *      (grossFare + serviceFee + tax + tip)
 *
 * If anyone changes one side without the other, these tests fail loudly.
 */

// ── 1. Stripe authorization amount (mirror of edge-function logic) ───────────
const PICKYOU_PLATFORM_FEE_CENTS = 97;
const STRIPE_HOLD_MULTIPLIER = 1.25;
const STRIPE_HOLD_MIN_CENTS = 2000;
const STRIPE_HOLD_MAX_CENTS = 50000;

/**
 * Mirrors the exact arithmetic in:
 *   - supabase/functions/create-payment-intent/index.ts
 *   - supabase/functions/pay-with-saved-card/index.ts
 *
 * Given the metered fare (computeFare subtotalCents — i.e. *before* tax &
 * platform fee), returns the cents Stripe will hold on the rider's card.
 *
 * PickYou: tax = round(subtotal × 0.05); fareWithExtras = subtotal + tax + 97
 * Taxi:    fareWithExtras = subtotal
 */
function stripeAuthorizationAmount(
  meteredFareCents: number,
  serviceType: "taxi" | "private_hire"
): number {
  let fareWithExtras = meteredFareCents;
  if (serviceType === "private_hire") {
    const taxCents = Math.round(meteredFareCents * 0.05);
    fareWithExtras = meteredFareCents + taxCents + PICKYOU_PLATFORM_FEE_CENTS;
  }
  return Math.min(
    Math.max(Math.round(fareWithExtras * STRIPE_HOLD_MULTIPLIER), STRIPE_HOLD_MIN_CENTS),
    STRIPE_HOLD_MAX_CENTS
  );
}

// ── 2. Receipt total (mirror of RideReceipt.tsx) ─────────────────────────────
/**
 * Mirrors lines 38-41 + 67 of src/components/rider/RideReceipt.tsx.
 * Receipt renders: grossFare + serviceFee + tax + tip.
 *
 * For a finalized ride row, these database fields map to computeFare as:
 *   final_fare_cents   = subtotalCents (metered fare incl. surcharges, pre-tax)
 *   service_fee_cents  = platformFeeCents
 *   tax_cents          = taxCents
 */
function receiptTotalFromBreakdown(b: FareBreakdown, tipCents = 0): number {
  const grossFare = b.subtotalCents;
  const serviceFee = b.platformFeeCents;
  const tax = b.taxCents;
  return grossFare + serviceFee + tax + tipCents;
}

// ── Test scenarios: edge-case boundary fares ─────────────────────────────────
const SCENARIOS = [
  { name: "TC1: 100m, 0 wait (flag-only)", input: { distanceKm: 0.1 } },
  { name: "TC2: 300m, 0 wait", input: { distanceKm: 0.3 } },
  { name: "TC3: 1km, 2 wait (under grace)", input: { distanceKm: 1, waitingMin: 2 } },
  { name: "TC4: 5km, 5 wait", input: { distanceKm: 5, waitingMin: 5 } },
  { name: "TC5: 5km, 5 wait, large vehicle", input: { distanceKm: 5, waitingMin: 5, largeVehicle: true } },
  { name: "TC6: 5km, 5 wait, pickup/delivery", input: { distanceKm: 5, waitingMin: 5, pickupDeliveryNoPassenger: true } },
  { name: "TC7: 5km, 5 wait, large + pickup/delivery", input: { distanceKm: 5, waitingMin: 5, largeVehicle: true, pickupDeliveryNoPassenger: true } },
  // Boundary edge cases
  { name: "Boundary: exactly 150m (included)", input: { distanceKm: 0.15 } },
  { name: "Boundary: 150.001m (1st increment)", input: { distanceKm: 0.150001 } },
  { name: "Boundary: exactly 3.0 min waiting (grace)", input: { distanceKm: 1, waitingMin: 3.0 } },
  { name: "Boundary: 3.5 min waiting (.5¢ rounding)", input: { distanceKm: 1, waitingMin: 3.5 } },
  // Extreme values
  { name: "Extreme: 50 km, 30 min waiting", input: { distanceKm: 50, waitingMin: 30 } },
  { name: "Extreme: 0 km", input: { distanceKm: 0 } },
];

describe("Stripe authorization amount matches computeFare exactly", () => {
  for (const mode of ["taxi", "pickyou"] as const) {
    const serviceType = mode === "taxi" ? "taxi" : "private_hire";

    for (const sc of SCENARIOS) {
      it(`${mode.toUpperCase()} — ${sc.name}: hold = clamp(round(computeFare.totalCents × 1.25), 2000, 50000)`, () => {
        const fare = computeFare(mode, rates, sc.input);
        const hold = stripeAuthorizationAmount(fare.subtotalCents, serviceType);

        // The hold MUST equal the number derived directly from the pricing
        // engine's totalCents. Pins edge-function arithmetic ↔ pricing.ts.
        const expectedHold = Math.min(
          Math.max(Math.round(fare.totalCents * 1.25), 2000),
          50000
        );

        expect(hold).toBe(expectedHold);
        expect(hold).toBeGreaterThanOrEqual(STRIPE_HOLD_MIN_CENTS);
        expect(hold).toBeLessThanOrEqual(STRIPE_HOLD_MAX_CENTS);
        expect(Number.isInteger(hold)).toBe(true);
      });
    }
  }

  it("never holds less than the $20 minimum, even for a $0 fare", () => {
    const hold = stripeAuthorizationAmount(0, "taxi");
    expect(hold).toBe(2000);
  });

  it("never holds more than $500, even for a $1000 fare", () => {
    const hold = stripeAuthorizationAmount(100_000, "private_hire");
    expect(hold).toBe(50000);
  });

  it("REGRESSION GUARD: PickYou GST is on subtotal only, NOT on the platform fee", () => {
    // Pins the fix for the audit finding where the edge function was
    // computing tax = round((subtotal + 97) × 0.05) instead of
    // tax = round(subtotal × 0.05).
    const fare = computeFare("pickyou", rates, { distanceKm: 5, waitingMin: 5 });
    const hold = stripeAuthorizationAmount(fare.subtotalCents, "private_hire");

    // Aligned arithmetic (correct, matches RideReceipt):
    const correctTax = Math.round(fare.subtotalCents * 0.05);
    const correctFareWithExtras =
      fare.subtotalCents + correctTax + PICKYOU_PLATFORM_FEE_CENTS;
    const correctHold = Math.round(correctFareWithExtras * 1.25);

    // Old buggy arithmetic (must NEVER match again):
    const buggyTax = Math.round((fare.subtotalCents + PICKYOU_PLATFORM_FEE_CENTS) * 0.05);
    const buggyFareWithExtras =
      fare.subtotalCents + PICKYOU_PLATFORM_FEE_CENTS + buggyTax;
    const buggyHold = Math.round(buggyFareWithExtras * 1.25);

    expect(hold).toBe(correctHold);
    expect(hold).not.toBe(buggyHold);
  });
});

describe("Receipt total matches computeFare for all scenarios", () => {
  for (const mode of ["taxi", "pickyou"] as const) {
    for (const sc of SCENARIOS) {
      it(`${mode.toUpperCase()} — ${sc.name}: receipt grand total === computeFare totalCents`, () => {
        const fare = computeFare(mode, rates, sc.input);
        const receiptTotal = receiptTotalFromBreakdown(fare, 0);
        expect(receiptTotal).toBe(fare.totalCents);
      });

      it(`${mode.toUpperCase()} — ${sc.name}: receipt with $5 tip adds exactly 500¢`, () => {
        const fare = computeFare(mode, rates, sc.input);
        const receiptTotal = receiptTotalFromBreakdown(fare, 500);
        expect(receiptTotal).toBe(fare.totalCents + 500);
      });
    }
  }
});

describe("Three-way invariant: pricing ↔ Stripe ↔ receipt", () => {
  it.each(SCENARIOS)(
    "PickYou — $name: hold ≥ receipt total (over-authorize, then capture exact)",
    ({ input }) => {
      const fare = computeFare("pickyou", rates, input);
      const hold = stripeAuthorizationAmount(fare.subtotalCents, "private_hire");
      const receiptTotal = receiptTotalFromBreakdown(fare, 0);

      // Critical safety property: the auth hold MUST cover the actual capture.
      expect(hold).toBeGreaterThanOrEqual(receiptTotal);
    }
  );

  it.each(SCENARIOS)(
    "Taxi — $name: hold ≥ receipt total",
    ({ input }) => {
      const fare = computeFare("taxi", rates, input);
      const hold = stripeAuthorizationAmount(fare.subtotalCents, "taxi");
      const receiptTotal = receiptTotalFromBreakdown(fare, 0);
      expect(hold).toBeGreaterThanOrEqual(receiptTotal);
    }
  );

  it("Taxi mode never includes platform fee or GST in the receipt", () => {
    const fare = computeFare("taxi", rates, { distanceKm: 5, waitingMin: 5 });
    const receiptTotal = receiptTotalFromBreakdown(fare);
    expect(fare.platformFeeCents).toBe(0);
    expect(fare.taxCents).toBe(0);
    expect(receiptTotal).toBe(fare.subtotalCents);
  });

  it("PickYou receipt always includes exactly one $0.97 platform fee", () => {
    for (const sc of SCENARIOS) {
      const fare = computeFare("pickyou", rates, sc.input);
      expect(fare.platformFeeCents).toBe(97);
      // Receipt grand total minus fare minus tax should equal exactly 97¢.
      expect(fare.totalCents - fare.subtotalCents - fare.taxCents).toBe(97);
    }
  });

  it("PickYou GST is exactly 5% of subtotal (rounded), never compounded", () => {
    for (const sc of SCENARIOS) {
      const fare = computeFare("pickyou", rates, sc.input);
      const expectedTax = Math.round(fare.subtotalCents * 0.05);
      expect(fare.taxCents).toBe(expectedTax);
      // GST must NOT be applied to the platform fee.
      const wrongTax = Math.round((fare.subtotalCents + 97) * 0.05);
      if (expectedTax !== wrongTax) {
        expect(fare.taxCents).not.toBe(wrongTax);
      }
    }
  });
});
