/**
 * REGULATORY COMPLIANCE FUZZ TESTS — Taxi vs PickYou separation.
 *
 * These tests are written to satisfy a municipal-grade audit requirement:
 *   1. Taxi (City-Regulated) mode MUST NEVER apply GST.
 *   2. Taxi mode MUST NEVER apply the $0.97 platform / service fee.
 *   3. Taxi total MUST equal the bylaw subtotal — no extra cents anywhere.
 *   4. PickYou Independent mode MUST always add 5% GST on the subtotal.
 *   5. PickYou mode MUST always add the flat $0.97 platform fee, exactly once.
 *   6. The platform fee is layered AFTER GST and is itself NOT taxed.
 *
 * Each property runs against thousands of randomly generated trips covering
 * the full realistic input space (distance, waiting, surcharges, edge flags).
 * If any single random input violates an invariant, fast-check shrinks the
 * counterexample to the smallest failing case for instant diagnosis.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeFare, FALLBACK_BYLAW_RATES, type FareInput } from "./pricing";

const rates = FALLBACK_BYLAW_RATES;

// Run each property against this many random inputs. Higher = stronger audit.
const RUNS = 2000;
const opts = { numRuns: RUNS };

// ── Random trip generators ────────────────────────────────────────────────────
const distanceKm = fc.double({ min: 0, max: 250, noNaN: true });
const waitingMin = fc.double({ min: 0, max: 240, noNaN: true });

const fareInput: fc.Arbitrary<FareInput> = fc.record({
  distanceKm,
  waitingMin,
  largeVehicle: fc.boolean(),
  accessibilityRequired: fc.boolean(),
  pickupDeliveryNoPassenger: fc.boolean(),
});

// ─────────────────────────────────────────────────────────────────────────────
//  TAXI MODE — STRICT ZERO-FEE INVARIANTS
// ─────────────────────────────────────────────────────────────────────────────
describe("COMPLIANCE: Taxi (City-Regulated) — zero GST, zero fees", () => {
  it("Taxi mode: taxCents is ALWAYS exactly 0 (no GST under any input)", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("taxi", rates, input);
        expect(f.taxCents).toBe(0);
      }),
      opts,
    );
  });

  it("Taxi mode: platformFeeCents is ALWAYS exactly 0 (no $0.97 fee)", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("taxi", rates, input);
        expect(f.platformFeeCents).toBe(0);
      }),
      opts,
    );
  });

  it("Taxi mode: totalCents === subtotalCents (no hidden charges layered on)", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("taxi", rates, input);
        expect(f.totalCents).toBe(f.subtotalCents);
      }),
      opts,
    );
  });

  it("Taxi mode: total never exceeds the bylaw-defined components combined", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("taxi", rates, input);
        const bylawMax =
          f.baseFareCents +
          f.distanceChargeCents +
          f.waitingChargeCents +
          f.largeVehicleSurchargeCents +
          f.pickupDeliverySurchargeCents;
        // Taxi total must equal the regulated components — never more, never less.
        expect(f.totalCents).toBe(bylawMax);
      }),
      opts,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PICKYOU MODE — REQUIRED FEES PRESENT
// ─────────────────────────────────────────────────────────────────────────────
describe("COMPLIANCE: PickYou Independent — 5% GST + $0.97 fee always present", () => {
  it("PickYou mode: GST is exactly round(subtotal × 5%) — applied to bylaw subtotal only", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("pickyou", rates, input);
        const expected = Math.round(f.subtotalCents * rates.pickyou_gst_rate);
        expect(f.taxCents).toBe(expected);
      }),
      opts,
    );
  });

  it("PickYou mode: platform fee is exactly $0.97, applied once, never doubled or omitted", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("pickyou", rates, input);
        expect(f.platformFeeCents).toBe(97);
        expect(f.platformFeeCents).toBe(rates.pickyou_platform_fee_cents);
      }),
      opts,
    );
  });

  it("PickYou mode: total = subtotal + GST + $0.97 (calculation order: tax then fee)", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("pickyou", rates, input);
        expect(f.totalCents).toBe(f.subtotalCents + f.taxCents + f.platformFeeCents);
      }),
      opts,
    );
  });

  it("PickYou mode: $0.97 platform fee is NOT itself taxed (GST rate applies to subtotal only)", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const f = computeFare("pickyou", rates, input);
        // If the fee were taxed, GST would equal round((subtotal + 97) × 5%).
        const ifFeeWereTaxed = Math.round(
          (f.subtotalCents + rates.pickyou_platform_fee_cents) * rates.pickyou_gst_rate,
        );
        // Allow equality only when subtotal already produces the same rounded GST
        // (which would only happen by coincidence). The safe assertion:
        // GST must equal the subtotal-only formula.
        const subtotalOnlyGst = Math.round(f.subtotalCents * rates.pickyou_gst_rate);
        expect(f.taxCents).toBe(subtotalOnlyGst);
        // And it must NOT exceed the subtotal-only calculation by the fee's GST share.
        expect(f.taxCents).toBeLessThanOrEqual(ifFeeWereTaxed);
      }),
      opts,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  CROSS-MODE SEPARATION — NO LEAKAGE BETWEEN MODES
// ─────────────────────────────────────────────────────────────────────────────
describe("COMPLIANCE: Cross-mode separation — Taxi and PickYou never converge", () => {
  it("For identical trip inputs, Taxi and PickYou share the SAME bylaw subtotal", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const taxi = computeFare("taxi", rates, input);
        const py = computeFare("pickyou", rates, input);
        expect(taxi.subtotalCents).toBe(py.subtotalCents);
        expect(taxi.baseFareCents).toBe(py.baseFareCents);
        expect(taxi.distanceChargeCents).toBe(py.distanceChargeCents);
        expect(taxi.waitingChargeCents).toBe(py.waitingChargeCents);
        expect(taxi.largeVehicleSurchargeCents).toBe(py.largeVehicleSurchargeCents);
        expect(taxi.pickupDeliverySurchargeCents).toBe(py.pickupDeliverySurchargeCents);
      }),
      opts,
    );
  });

  it("PickYou total ALWAYS exceeds Taxi total by exactly (GST + $0.97)", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const taxi = computeFare("taxi", rates, input);
        const py = computeFare("pickyou", rates, input);
        const diff = py.totalCents - taxi.totalCents;
        expect(diff).toBe(py.taxCents + py.platformFeeCents);
        // And that difference is always at least the flat fee.
        expect(diff).toBeGreaterThanOrEqual(rates.pickyou_platform_fee_cents);
      }),
      opts,
    );
  });

  it("Taxi total NEVER equals or exceeds PickYou total for the same trip", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        const taxi = computeFare("taxi", rates, input);
        const py = computeFare("pickyou", rates, input);
        expect(taxi.totalCents).toBeLessThan(py.totalCents);
      }),
      opts,
    );
  });

  it("Mode field on the breakdown is non-spoofable and matches the requested mode", () => {
    fc.assert(
      fc.property(fareInput, (input) => {
        expect(computeFare("taxi", rates, input).mode).toBe("taxi");
        expect(computeFare("pickyou", rates, input).mode).toBe("pickyou");
      }),
      opts,
    );
  });
});
