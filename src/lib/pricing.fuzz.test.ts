/**
 * Property-based fuzz tests for computeFare.
 *
 * These tests don't pin specific dollar amounts — they verify *invariants*
 * that must hold for ANY valid input. If fast-check finds a counterexample,
 * it shrinks it down to the smallest failing case automatically.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  computeFare,
  FALLBACK_BYLAW_RATES,
  type FareInput,
  type FareMode,
} from "./pricing";

const rates = FALLBACK_BYLAW_RATES;

// ── Arbitraries ──────────────────────────────────────────────────────────────
// Realistic ride bounds: up to ~200 km, up to ~3 h waiting.
const distanceKm = fc.double({ min: 0, max: 200, noNaN: true });
const waitingMin = fc.double({ min: 0, max: 180, noNaN: true });

const fareInput = fc.record({
  distanceKm,
  waitingMin,
  largeVehicle: fc.boolean(),
  accessibilityRequired: fc.boolean(),
  pickupDeliveryNoPassenger: fc.boolean(),
}) as fc.Arbitrary<FareInput>;

const mode: fc.Arbitrary<FareMode> = fc.constantFrom("taxi", "pickyou");

describe("computeFare — property-based invariants", () => {
  it("returns finite, non-negative integer cents for every component", () => {
    fc.assert(
      fc.property(mode, fareInput, (m, input) => {
        const f = computeFare(m, rates, input);
        for (const v of [
          f.baseFareCents,
          f.distanceChargeCents,
          f.waitingChargeCents,
          f.largeVehicleSurchargeCents,
          f.pickupDeliverySurchargeCents,
          f.subtotalCents,
          f.taxCents,
          f.platformFeeCents,
          f.totalCents,
        ]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  it("total is always at least the flag rate", () => {
    fc.assert(
      fc.property(mode, fareInput, (m, input) => {
        const f = computeFare(m, rates, input);
        expect(f.totalCents).toBeGreaterThanOrEqual(rates.base_fare_cents);
      }),
    );
  });

  it("subtotal = base + distance + waiting + surcharges (no hidden fees)", () => {
    fc.assert(
      fc.property(mode, fareInput, (m, input) => {
        const f = computeFare(m, rates, input);
        expect(f.subtotalCents).toBe(
          f.baseFareCents +
            f.distanceChargeCents +
            f.waitingChargeCents +
            f.largeVehicleSurchargeCents +
            f.pickupDeliverySurchargeCents,
        );
      }),
    );
  });

  it("total = subtotal + tax + platform fee (exactly once)", () => {
    fc.assert(
      fc.property(mode, fareInput, (m, input) => {
        const f = computeFare(m, rates, input);
        expect(f.totalCents).toBe(
          f.subtotalCents + f.taxCents + f.platformFeeCents,
        );
      }),
    );
  });

  it("Taxi mode never charges GST or platform fee", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("taxi", rates, input);
        expect(f.taxCents).toBe(0);
        expect(f.platformFeeCents).toBe(0);
        expect(f.totalCents).toBe(f.subtotalCents);
      }),
    );
  });

  it("PickYou platform fee is exactly $0.97 (applied once, never doubled)", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("pickyou", rates, input);
        expect(f.platformFeeCents).toBe(rates.pickyou_platform_fee_cents);
      }),
    );
  });

  it("PickYou GST = round(subtotal × 5%) — within ½¢ of exact", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("pickyou", rates, input);
        const exact = f.subtotalCents * rates.pickyou_gst_rate;
        // Math.round may differ from exact by < 0.5
        expect(Math.abs(f.taxCents - exact)).toBeLessThan(0.5);
      }),
    );
  });

  it("PickYou total is always strictly higher than Taxi total for the same trip", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const taxi = computeFare("taxi", rates, input);
        const py = computeFare("pickyou", rates, input);
        // PickYou adds a $0.97 fee minimum, so it must exceed taxi.
        expect(py.totalCents).toBeGreaterThan(taxi.totalCents);
      }),
    );
  });

  it("Distance is monotonic: longer trip ⇒ total ≥ shorter trip (same other inputs)", () => {
    fc.assert(
      fc.property(
        mode,
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        waitingMin,
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (m, dA, dB, w, large, accessible, pickupDelivery) => {
          const shorter = Math.min(dA, dB);
          const longer = Math.max(dA, dB);
          const baseInput = {
            waitingMin: w,
            largeVehicle: large,
            accessibilityRequired: accessible,
            pickupDeliveryNoPassenger: pickupDelivery,
          };
          const a = computeFare(m, rates, { ...baseInput, distanceKm: shorter });
          const b = computeFare(m, rates, { ...baseInput, distanceKm: longer });
          expect(b.totalCents).toBeGreaterThanOrEqual(a.totalCents);
          expect(b.distanceChargeCents).toBeGreaterThanOrEqual(
            a.distanceChargeCents,
          );
        },
      ),
    );
  });

  it("Waiting time is monotonic: longer wait ⇒ total ≥ shorter wait", () => {
    fc.assert(
      fc.property(
        mode,
        distanceKm,
        fc.double({ min: 0, max: 60, noNaN: true }),
        fc.double({ min: 0, max: 60, noNaN: true }),
        (m, d, wA, wB) => {
          const shorter = Math.min(wA, wB);
          const longer = Math.max(wA, wB);
          const a = computeFare(m, rates, { distanceKm: d, waitingMin: shorter });
          const b = computeFare(m, rates, { distanceKm: d, waitingMin: longer });
          expect(b.waitingChargeCents).toBeGreaterThanOrEqual(
            a.waitingChargeCents,
          );
          expect(b.totalCents).toBeGreaterThanOrEqual(a.totalCents);
        },
      ),
    );
  });

  it("Waiting under the free grace (≤3 min) is never billed", () => {
    fc.assert(
      fc.property(
        mode,
        distanceKm,
        fc.double({ min: 0, max: rates.free_waiting_min, noNaN: true }),
        (m, d, w) => {
          const f = computeFare(m, rates, { distanceKm: d, waitingMin: w });
          expect(f.billableWaitingMin).toBe(0);
          expect(f.waitingChargeCents).toBe(0);
        },
      ),
    );
  });

  it("Accessibility flag always waives the large-vehicle surcharge", () => {
    fc.assert(
      fc.property(mode, distanceKm, waitingMin, (m, d, w) => {
        const f = computeFare(m, rates, {
          distanceKm: d,
          waitingMin: w,
          largeVehicle: true,
          accessibilityRequired: true,
        });
        expect(f.largeVehicleSurchargeCents).toBe(0);
      }),
    );
  });

  it("Accessibility flag does NOT waive the pickup/delivery surcharge", () => {
    fc.assert(
      fc.property(mode, distanceKm, waitingMin, (m, d, w) => {
        const f = computeFare(m, rates, {
          distanceKm: d,
          waitingMin: w,
          accessibilityRequired: true,
          pickupDeliveryNoPassenger: true,
        });
        expect(f.pickupDeliverySurchargeCents).toBe(
          rates.pickup_delivery_surcharge_cents,
        );
      }),
    );
  });

  it("Toggling a single surcharge changes the total by exactly that surcharge (Taxi mode)", () => {
    fc.assert(
      fc.property(distanceKm, waitingMin, (d, w) => {
        const without = computeFare("taxi", rates, {
          distanceKm: d,
          waitingMin: w,
        });
        const withLarge = computeFare("taxi", rates, {
          distanceKm: d,
          waitingMin: w,
          largeVehicle: true,
        });
        const withPickup = computeFare("taxi", rates, {
          distanceKm: d,
          waitingMin: w,
          pickupDeliveryNoPassenger: true,
        });
        expect(withLarge.totalCents - without.totalCents).toBe(
          rates.large_vehicle_surcharge_cents,
        );
        expect(withPickup.totalCents - without.totalCents).toBe(
          rates.pickup_delivery_surcharge_cents,
        );
      }),
    );
  });

  it("Negative inputs are clamped (no negative charges, no NaN)", () => {
    fc.assert(
      fc.property(
        mode,
        fc.double({ min: -1000, max: 0, noNaN: true }),
        fc.double({ min: -1000, max: 0, noNaN: true }),
        (m, d, w) => {
          const f = computeFare(m, rates, { distanceKm: d, waitingMin: w });
          expect(f.distanceChargeCents).toBe(0);
          expect(f.waitingChargeCents).toBe(0);
          expect(f.totalCents).toBeGreaterThanOrEqual(rates.base_fare_cents);
        },
      ),
    );
  });

  it("Mode field on the breakdown matches the requested mode", () => {
    fc.assert(
      fc.property(mode, fareInput, (m, input) => {
        const f = computeFare(m, rates, input);
        expect(f.mode).toBe(m);
      }),
    );
  });
});
