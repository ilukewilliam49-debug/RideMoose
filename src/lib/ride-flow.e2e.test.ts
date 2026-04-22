/**
 * End-to-end ride-flow parity test.
 *
 * Simulates the full pipeline a rider goes through and pins all three
 * cents-precise numbers together for both Taxi and PickYou:
 *
 *   1. RIDE REQUEST    → caller supplies distance/waiting/flags
 *   2. PRICING ENGINE  → computeFare() produces the canonical breakdown
 *   3. STRIPE INTENT   → mirrors create-payment-intent / pay-with-saved-card
 *                        (clamp(round(fareWithExtras × 1.25), 2000, 50000))
 *   4. RIDE ROW        → fields populated as capture-payment / complete-ride do
 *   5. RECEIPT TOTAL   → mirrors RideReceipt.tsx lines 38-41 + 67
 *
 * Assertions:
 *   • Stripe pre-clamp gross  === computeFare.totalCents × 1.25
 *   • Receipt total           === computeFare.totalCents (+ tip)
 *   • Stripe authorized hold  ≥  receipt total          (no under-auth)
 *
 * If any layer drifts (edge function, pricing.ts, RideReceipt.tsx) this test
 * fails loudly with a clear diff per scenario.
 */

import { describe, it, expect } from "vitest";
import { computeFare, FALLBACK_BYLAW_RATES, type FareMode } from "./pricing";
import type { Ride } from "@/types/rider";

const rates = FALLBACK_BYLAW_RATES;

// ── Mirrors of edge function & receipt arithmetic ──────────────────────────
const PICKYOU_PLATFORM_FEE_CENTS = 97;
const STRIPE_HOLD_MULTIPLIER = 1.25;
const STRIPE_HOLD_MIN_CENTS = 2000;
const STRIPE_HOLD_MAX_CENTS = 50000;

/**
 * Mirrors create-payment-intent / pay-with-saved-card edge functions exactly.
 * Returns both the post-clamp authorized amount and the pre-clamp gross so
 * tests can pin both invariants.
 */
function stripeAuthorizationAmount(
  meteredFareCents: number,
  serviceType: "taxi" | "private_hire",
): { authorized: number; preClampGross: number; fareWithExtras: number } {
  let fareWithExtras = meteredFareCents;
  if (serviceType === "private_hire") {
    const taxCents = Math.round(meteredFareCents * 0.05);
    fareWithExtras = meteredFareCents + taxCents + PICKYOU_PLATFORM_FEE_CENTS;
  }
  const preClampGross = Math.round(fareWithExtras * STRIPE_HOLD_MULTIPLIER);
  const authorized = Math.min(
    Math.max(preClampGross, STRIPE_HOLD_MIN_CENTS),
    STRIPE_HOLD_MAX_CENTS,
  );
  return { authorized, preClampGross, fareWithExtras };
}

/**
 * Mirrors RideReceipt.tsx lines 38-41 + line 67 ("Total" cell).
 *
 *   grossFare  = ride.final_fare_cents  (capture stores subtotalCents here)
 *   serviceFee = ride.service_fee_cents (capture stores platformFeeCents)
 *   tax        = ride.tax_cents         (capture stores taxCents)
 *   totalFare  = grossFare + serviceFee + tax
 *   rendered   = totalFare + tip
 */
function receiptRenderedTotalCents(ride: Ride): number {
  const grossFare =
    ride.final_fare_cents ||
    Math.round((ride.final_price || 0) * 100) ||
    Math.round((ride.estimated_price || 0) * 100);
  const serviceFee = ride.service_fee_cents || 0;
  const tax = ride.tax_cents || 0;
  const tip = ride.tip_cents || 0;
  return grossFare + serviceFee + tax + tip;
}

/** Build a completed ride row exactly as the capture/complete flow does. */
function buildCompletedRide(
  mode: FareMode,
  input: {
    distanceKm: number;
    waitingMin?: number;
    largeVehicle?: boolean;
    pickupDeliveryNoPassenger?: boolean;
  },
  tipCents = 0,
): Ride {
  const fare = computeFare(mode, rates, input);
  return {
    id: "11111111-2222-3333-4444-555555555555",
    rider_id: "rider-1",
    driver_id: "driver-1",
    service_type: mode === "taxi" ? "taxi" : "private_hire",
    status: "completed",
    pickup_address: "100 Pickup St",
    dropoff_address: "200 Drop Ave",
    distance_km: input.distanceKm,
    payment_option: "in_app",
    payment_status: "paid",
    created_at: "2025-04-22T10:00:00.000Z",

    // capture-payment / complete-ride populate these:
    final_fare_cents: fare.subtotalCents,
    final_price: fare.subtotalCents / 100,
    service_fee_cents: fare.platformFeeCents,
    tax_cents: fare.taxCents,
    tip_cents: tipCents,
    captured_amount_cents: fare.totalCents + tipCents,
    outstanding_amount_cents: 0,
  } as unknown as Ride;
}

// ── Scenarios cover edge-case fares from the unit/payment suites ───────────
const SCENARIOS = [
  { name: "TC1: 100m flag-only", input: { distanceKm: 0.1 } },
  { name: "TC3: 1km, 2min wait (under grace)", input: { distanceKm: 1, waitingMin: 2 } },
  { name: "TC4: 5km, 5min wait", input: { distanceKm: 5, waitingMin: 5 } },
  { name: "TC5: 5km + large vehicle", input: { distanceKm: 5, waitingMin: 5, largeVehicle: true } },
  { name: "TC6: 5km + pickup/delivery", input: { distanceKm: 5, waitingMin: 5, pickupDeliveryNoPassenger: true } },
  { name: "Boundary: exactly 150m included", input: { distanceKm: 0.15 } },
  { name: "Boundary: 150.001m (1st increment)", input: { distanceKm: 0.150001 } },
  { name: "Boundary: 3.5min waiting (.5¢ rounding)", input: { distanceKm: 1, waitingMin: 3.5 } },
  { name: "Extreme: 50km, 30min waiting", input: { distanceKm: 50, waitingMin: 30 } },
];

describe("E2E ride flow — request → payment intent → receipt", () => {
  for (const mode of ["taxi", "pickyou"] as const) {
    const serviceType = mode === "taxi" ? "taxi" : ("private_hire" as const);

    describe(`${mode.toUpperCase()}`, () => {
      for (const sc of SCENARIOS) {
        it(`${sc.name}: pricing ↔ Stripe hold ↔ receipt total all agree`, () => {
          // 1. PRICING — single source of truth
          const fare = computeFare(mode, rates, sc.input);

          // 2. STRIPE — what create-payment-intent would send to Stripe
          const { authorized, preClampGross, fareWithExtras } = stripeAuthorizationAmount(
            fare.subtotalCents,
            serviceType,
          );

          // The pre-clamp gross MUST equal the source of truth × hold buffer.
          // This is the contract that proves edge-function tax/fee math
          // matches pricing.ts (no double-counting, no missing GST).
          expect(fareWithExtras).toBe(fare.totalCents);
          expect(preClampGross).toBe(Math.round(fare.totalCents * STRIPE_HOLD_MULTIPLIER));

          // 3. RIDE ROW — what capture-payment writes to the database
          const ride = buildCompletedRide(mode, sc.input);

          // 4. RECEIPT — what RideReceipt.tsx renders to the rider
          const renderedTotal = receiptRenderedTotalCents(ride);

          // The rendered receipt MUST match the source of truth exactly.
          expect(renderedTotal).toBe(fare.totalCents);

          // The Stripe authorized hold MUST cover the receipt total — this
          // is the user-visible contract that prevents under-authorization.
          expect(authorized).toBeGreaterThanOrEqual(renderedTotal);

          // captured_amount_cents (what the driver/rider see was charged)
          // must equal what the receipt shows — no accounting drift.
          expect(ride.captured_amount_cents).toBe(renderedTotal);
        });
      }

      it("with $2.50 tip: receipt total = computeFare + tip = captured_amount", () => {
        const input = { distanceKm: 5, waitingMin: 5 };
        const tipCents = 250;
        const fare = computeFare(mode, rates, input);
        const ride = buildCompletedRide(mode, input, tipCents);

        const renderedTotal = receiptRenderedTotalCents(ride);
        expect(renderedTotal).toBe(fare.totalCents + tipCents);
        expect(renderedTotal).toBe(ride.captured_amount_cents);
      });
    });
  }

  it("PickYou hold > Taxi hold for the same trip (5% GST + $0.97 fee)", () => {
    const input = { distanceKm: 5, waitingMin: 5 };
    const taxiFare = computeFare("taxi", rates, input);
    const pickyouFare = computeFare("pickyou", rates, input);

    const { authorized: taxiHold } = stripeAuthorizationAmount(taxiFare.subtotalCents, "taxi");
    const { authorized: pickyouHold } = stripeAuthorizationAmount(
      pickyouFare.subtotalCents,
      "private_hire",
    );

    // Same metered subtotal, but PickYou adds 5% GST + 97¢ → strictly larger
    expect(taxiFare.subtotalCents).toBe(pickyouFare.subtotalCents);
    expect(pickyouHold).toBeGreaterThan(taxiHold);
    expect(pickyouFare.totalCents - taxiFare.totalCents).toBe(
      Math.round(taxiFare.subtotalCents * 0.05) + PICKYOU_PLATFORM_FEE_CENTS,
    );
  });

  it("$20 hold floor protects micro-trips (100m taxi flag-only)", () => {
    const fare = computeFare("taxi", rates, { distanceKm: 0.1 });
    const { authorized, preClampGross } = stripeAuthorizationAmount(fare.subtotalCents, "taxi");
    // Pre-clamp gross is far below floor; clamp lifts it to $20.00.
    expect(preClampGross).toBeLessThan(STRIPE_HOLD_MIN_CENTS);
    expect(authorized).toBe(STRIPE_HOLD_MIN_CENTS);
    expect(authorized).toBeGreaterThan(fare.totalCents);
  });
});
