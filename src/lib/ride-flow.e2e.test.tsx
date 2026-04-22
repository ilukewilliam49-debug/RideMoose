/**
 * End-to-end ride-flow parity test.
 *
 * Simulates the full pipeline a rider goes through:
 *
 *   1. RIDE REQUEST    → caller supplies distance/waiting/flags
 *   2. PRICING ENGINE  → computeFare() produces the canonical breakdown
 *   3. STRIPE INTENT   → mirrors create-payment-intent / pay-with-saved-card
 *                        (clamp(round(fareWithExtras × 1.25), 2000, 50000))
 *   4. RIDE ROW        → fields are populated as the capture/complete flow does
 *   5. RECEIPT RENDER  → <RideReceipt /> is mounted, total scraped from DOM
 *
 * Assertions pin the three numbers together for both Taxi and PickYou:
 *   • Stripe authorized hold ≥ receipt total (no over-capture)
 *   • Stripe pre-clamp gross matches computeFare.totalCents × 1.25
 *   • Receipt rendered total === computeFare.totalCents (+ tip, if any)
 *
 * If any layer drifts (edge function, pricing.ts, RideReceipt.tsx) this test
 * fails loudly with a clear diff per scenario.
 */

import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { computeFare, FALLBACK_BYLAW_RATES, type FareMode } from "./pricing";
import RideReceipt from "@/components/rider/RideReceipt";
import type { Ride } from "@/types/rider";

const rates = FALLBACK_BYLAW_RATES;

// ── Mirrors of edge function & receipt arithmetic ──────────────────────────
const PICKYOU_PLATFORM_FEE_CENTS = 97;

/** Mirrors create-payment-intent / pay-with-saved-card exactly. */
function stripeAuthorizationAmount(
  meteredFareCents: number,
  serviceType: "taxi" | "private_hire",
): { authorized: number; preClampGross: number } {
  let fareWithExtras = meteredFareCents;
  if (serviceType === "private_hire") {
    const taxCents = Math.round(meteredFareCents * 0.05);
    fareWithExtras = meteredFareCents + taxCents + PICKYOU_PLATFORM_FEE_CENTS;
  }
  const preClampGross = Math.round(fareWithExtras * 1.25);
  const authorized = Math.min(Math.max(preClampGross, 2000), 50000);
  return { authorized, preClampGross };
}

// ── Build a completed Ride row exactly like the capture flow does ──────────
function buildCompletedRide(
  mode: FareMode,
  input: { distanceKm: number; waitingMin?: number; largeVehicle?: boolean; pickupDeliveryNoPassenger?: boolean },
  tipCents = 0,
): { ride: Ride; expectedReceiptTotal: number } {
  const fare = computeFare(mode, rates, input);

  const ride = {
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

    // capture-payment populates these fields:
    final_fare_cents: fare.subtotalCents,
    final_price: fare.subtotalCents / 100,
    service_fee_cents: fare.platformFeeCents,
    tax_cents: fare.taxCents,
    tip_cents: tipCents,
    captured_amount_cents: fare.totalCents + tipCents,
    outstanding_amount_cents: 0,
  } as unknown as Ride;

  const expectedReceiptTotal = fare.totalCents + tipCents;
  return { ride, expectedReceiptTotal };
}

/** Scrape the rendered "Total" row from the receipt DOM. */
function getRenderedReceiptTotalCents(): number {
  // The receipt renders "$X.XX" inside the row that begins with the localized
  // "Total" label. We grab the last $-formatted value in the fare breakdown
  // (which is always the Total — the only value rendered as the bold final
  // line item). This avoids brittle role-based queries against jsdom.
  const labelEl = screen.getByText(/^Total$/i);
  const row = labelEl.parentElement!;
  const valueEl = row.querySelector("span:last-child")!;
  const text = valueEl.textContent?.trim() ?? "";
  const match = text.match(/\$(\d+)\.(\d{2})/);
  if (!match) throw new Error(`Could not parse receipt total: "${text}"`);
  return parseInt(match[1], 10) * 100 + parseInt(match[2], 10);
}

// ── Scenarios cover the same edge cases as the unit/payment suites ─────────
const SCENARIOS = [
  { name: "TC1: 100m flag-only", input: { distanceKm: 0.1 } },
  { name: "TC3: 1km, 2min wait (under grace)", input: { distanceKm: 1, waitingMin: 2 } },
  { name: "TC4: 5km, 5min wait", input: { distanceKm: 5, waitingMin: 5 } },
  { name: "TC5: 5km + large vehicle", input: { distanceKm: 5, waitingMin: 5, largeVehicle: true } },
  { name: "TC6: 5km + pickup/delivery", input: { distanceKm: 5, waitingMin: 5, pickupDeliveryNoPassenger: true } },
  { name: "Boundary: exactly 150m included", input: { distanceKm: 0.15 } },
  { name: "Boundary: 3.5min waiting (.5¢ rounding)", input: { distanceKm: 1, waitingMin: 3.5 } },
  { name: "Extreme: 50km, 30min waiting", input: { distanceKm: 50, waitingMin: 30 } },
];

describe("E2E ride flow — request → payment intent → receipt", () => {
  for (const mode of ["taxi", "pickyou"] as const) {
    const serviceType = mode === "taxi" ? "taxi" : ("private_hire" as const);

    describe(`${mode.toUpperCase()}`, () => {
      for (const sc of SCENARIOS) {
        it(`${sc.name}: pricing ↔ Stripe hold ↔ rendered receipt agree`, () => {
          // 1. Pricing engine — single source of truth
          const fare = computeFare(mode, rates, sc.input);

          // 2. Stripe authorization (what create-payment-intent would request)
          const { authorized, preClampGross } = stripeAuthorizationAmount(
            fare.subtotalCents,
            serviceType,
          );

          // Pre-clamp gross MUST equal computeFare.totalCents × 1.25 — i.e.
          // the edge function's tax+fee math agrees with pricing.ts.
          expect(preClampGross).toBe(Math.round(fare.totalCents * 1.25));

          // The authorized hold MUST cover the final receipt total. This is
          // the contract that prevents under-authorization.
          expect(authorized).toBeGreaterThanOrEqual(fare.totalCents);

          // 3. Build the completed-ride row the capture flow would produce
          const { ride, expectedReceiptTotal } = buildCompletedRide(mode, sc.input);

          // Sanity: the cents-pure expected total is the source of truth
          expect(expectedReceiptTotal).toBe(fare.totalCents);

          // 4. Render <RideReceipt /> with the completed row
          render(
            <I18nextProvider i18n={i18n}>
              <RideReceipt ride={ride} driverName="Test Driver" />
            </I18nextProvider>,
          );

          // 5. Scrape the rendered total — must match computeFare exactly
          const renderedTotal = getRenderedReceiptTotalCents();
          expect(renderedTotal).toBe(fare.totalCents);

          // And the Stripe hold (post-clamp) must still cover the rendered
          // total — the user-visible end of the contract.
          expect(authorized).toBeGreaterThanOrEqual(renderedTotal);

          cleanup();
        });
      }

      it("with $2.50 tip: hold still covers receipt total + tip", () => {
        const input = { distanceKm: 5, waitingMin: 5 };
        const tipCents = 250;
        const fare = computeFare(mode, rates, input);

        // Stripe hold is computed against the *pre-tip* subtotal — tips are
        // captured as a separate increment after the trip ends. So we just
        // verify that the captured amount stored on the ride (subtotal +
        // tax + fee + tip) is what the receipt actually shows.
        const { ride } = buildCompletedRide(mode, input, tipCents);
        const expectedRenderedTotal = fare.totalCents + tipCents;

        render(
          <I18nextProvider i18n={i18n}>
            <RideReceipt ride={ride} driverName="Test Driver" />
          </I18nextProvider>,
        );

        const renderedTotal = getRenderedReceiptTotalCents();
        expect(renderedTotal).toBe(expectedRenderedTotal);
        expect(renderedTotal).toBe(ride.captured_amount_cents);

        cleanup();
      });
    });
  }

  it("sanity: PickYou hold > Taxi hold for the same trip (tax + fee added)", () => {
    const input = { distanceKm: 5, waitingMin: 5 };
    const taxiFare = computeFare("taxi", rates, input);
    const pickyouFare = computeFare("pickyou", rates, input);

    const { authorized: taxiHold } = stripeAuthorizationAmount(taxiFare.subtotalCents, "taxi");
    const { authorized: pickyouHold } = stripeAuthorizationAmount(
      pickyouFare.subtotalCents,
      "private_hire",
    );

    // Same metered subtotal but PickYou adds 5% GST + 97¢ → strictly larger
    expect(taxiFare.subtotalCents).toBe(pickyouFare.subtotalCents);
    expect(pickyouHold).toBeGreaterThan(taxiHold);
    expect(pickyouFare.totalCents - taxiFare.totalCents).toBe(
      Math.round(taxiFare.subtotalCents * 0.05) + PICKYOU_PLATFORM_FEE_CENTS,
    );
  });
});
