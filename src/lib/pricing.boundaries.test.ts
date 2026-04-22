import { describe, it, expect } from "vitest";
import { computeFare, FALLBACK_BYLAW_RATES } from "./pricing";

const rates = FALLBACK_BYLAW_RATES;

/**
 * Targeted boundary tests for the City of Yellowknife fare calculator.
 *
 * Focus areas:
 *   1. Exact 0.5¢ rounding cases (GST + waiting fractions)
 *   2. Grace-period transitions at exactly 3.0 minutes
 *   3. Min/max clamping for distance and waiting (negative + extreme values)
 *
 * JS `Math.round` semantics: half-away-from-zero for positives
 *   Math.round(0.5)  === 1
 *   Math.round(1.5)  === 2
 *   Math.round(-0.5) === 0  (toward +∞)
 */

describe("Rounding boundaries — exact 0.5¢ GST cases", () => {
  // GST = subtotal * 0.05. For exact .5¢ we need subtotal where
  // (subtotal * 0.05) % 1 === 0.5  ⇒ subtotal ends in 10, 30, 50, 70, 90.
  // Construct subtotals exactly on the boundary.

  it("subtotal of 10¢ → 0.5¢ GST rounds UP to 1¢", () => {
    // Force subtotal = base(470) + 0 distance + 0 wait = 470 → 23.5 → 24.
    // Verified separately. Here we confirm Math.round(0.5) = 1 invariant
    // via a direct subtotal=10 simulation using a synthetic rate table.
    const synthetic = { ...rates, base_fare_cents: 10 };
    const py = computeFare("pickyou", synthetic, { distanceKm: 0 });
    expect(py.subtotalCents).toBe(10);
    expect(py.taxCents).toBe(1); // round(0.5) = 1
  });

  it("subtotal of 30¢ → 1.5¢ GST rounds UP to 2¢", () => {
    const synthetic = { ...rates, base_fare_cents: 30 };
    const py = computeFare("pickyou", synthetic, { distanceKm: 0 });
    expect(py.subtotalCents).toBe(30);
    expect(py.taxCents).toBe(2); // round(1.5) = 2
  });

  it("subtotal of 50¢ → 2.5¢ GST rounds UP to 3¢", () => {
    const synthetic = { ...rates, base_fare_cents: 50 };
    const py = computeFare("pickyou", synthetic, { distanceKm: 0 });
    expect(py.taxCents).toBe(3);
  });

  it("subtotal of 470¢ (real flag rate) → 23.5¢ GST rounds to 24¢", () => {
    const py = computeFare("pickyou", rates, { distanceKm: 0 });
    expect(py.subtotalCents).toBe(470);
    expect(py.taxCents).toBe(24);
  });

  it("subtotal that yields .49¢ rounds DOWN", () => {
    // subtotal = 9 → 0.45 → 0
    const synthetic = { ...rates, base_fare_cents: 9 };
    const py = computeFare("pickyou", synthetic, { distanceKm: 0 });
    expect(py.taxCents).toBe(0); // round(0.45) = 0
  });

  it("subtotal that yields .51¢ rounds UP", () => {
    // subtotal = 11 → 0.55 → 1
    const synthetic = { ...rates, base_fare_cents: 11 };
    const py = computeFare("pickyou", synthetic, { distanceKm: 0 });
    expect(py.taxCents).toBe(1);
  });

  it("never produces fractional cents in the final total", () => {
    for (let base = 1; base <= 1000; base++) {
      const synthetic = { ...rates, base_fare_cents: base };
      const py = computeFare("pickyou", synthetic, { distanceKm: 0 });
      expect(Number.isInteger(py.totalCents)).toBe(true);
      expect(Number.isInteger(py.taxCents)).toBe(true);
    }
  });
});

describe("Rounding boundaries — exact 0.5¢ waiting-charge cases", () => {
  // Waiting cents = round(billableMin * 95).
  // For .5¢ result we need billableMin * 95 to end in .5.
  // billableMin = 0.1 → 9.5 → 10
  // billableMin = 0.3 → 28.5 → 29
  // billableMin = 0.5 → 47.5 → 48
  // billableMin = 1.5 → 142.5 → 143

  it("3.1 min waiting (0.1 billable) → 9.5¢ rounds UP to 10¢", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 3.1 });
    expect(taxi.billableWaitingMin).toBeCloseTo(0.1, 10);
    expect(taxi.waitingChargeCents).toBe(10);
  });

  it("3.3 min waiting (0.3 billable) → 28.5¢ rounds UP to 29¢", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 3.3 });
    expect(taxi.waitingChargeCents).toBe(29);
  });

  it("3.5 min waiting (0.5 billable) → 47.5¢ rounds UP to 48¢", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 3.5 });
    expect(taxi.waitingChargeCents).toBe(48);
  });

  it("4.5 min waiting (1.5 billable) → 142.5¢ rounds UP to 143¢", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 4.5 });
    expect(taxi.waitingChargeCents).toBe(143);
  });
});

describe("Grace-period transitions at exactly 3.0 minutes", () => {
  it("2.999 min → 0 billable, $0 waiting charge", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 2.999 });
    expect(taxi.billableWaitingMin).toBe(0);
    expect(taxi.waitingChargeCents).toBe(0);
  });

  it("exactly 3.000 min → 0 billable (grace fully consumed, no charge)", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 3.0 });
    expect(taxi.billableWaitingMin).toBe(0);
    expect(taxi.waitingChargeCents).toBe(0);
  });

  it("3.001 min → ~0.001 billable, rounds to 0¢ (sub-cent disappears)", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 3.001 });
    expect(taxi.billableWaitingMin).toBeCloseTo(0.001, 10);
    // 0.001 * 95 = 0.095 → round → 0
    expect(taxi.waitingChargeCents).toBe(0);
  });

  it("3.01 min → 0.01 billable → ~1¢ (round(0.95) = 1)", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 3.01 });
    expect(taxi.waitingChargeCents).toBe(1);
  });

  it("transition is strictly monotonic across the 3.0-min boundary", () => {
    const samples = [2.5, 2.99, 3.0, 3.01, 3.5, 4.0, 5.0];
    let prev = -1;
    for (const w of samples) {
      const t = computeFare("taxi", rates, { distanceKm: 1, waitingMin: w });
      expect(t.waitingChargeCents).toBeGreaterThanOrEqual(prev);
      prev = t.waitingChargeCents;
    }
  });

  it("grace period applies identically in PickYou mode", () => {
    const py = computeFare("pickyou", rates, { distanceKm: 1, waitingMin: 3.0 });
    expect(py.billableWaitingMin).toBe(0);
    expect(py.waitingChargeCents).toBe(0);
  });
});

describe("Min/max clamping — distance", () => {
  it("negative distance is clamped to 0", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: -1 });
    expect(taxi.distanceChargeCents).toBe(0);
    expect(taxi.totalCents).toBe(470);
  });

  it("very large negative distance is clamped to 0", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: -999_999 });
    expect(taxi.distanceChargeCents).toBe(0);
    expect(taxi.totalCents).toBe(470);
  });

  it("NaN distance is treated as 0", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: NaN });
    expect(taxi.distanceChargeCents).toBe(0);
    expect(taxi.totalCents).toBe(470);
  });

  it("undefined distance (falsy) is treated as 0", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: undefined as unknown as number });
    expect(taxi.distanceChargeCents).toBe(0);
    expect(taxi.totalCents).toBe(470);
  });

  it("100 km extreme distance produces a finite, integer total", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 100 });
    // (100_000 - 150) / 100 = 998.5 → ceil = 999 → 999 * 24 = 23976
    expect(taxi.distanceChargeCents).toBe(23976);
    expect(taxi.totalCents).toBe(470 + 23976);
    expect(Number.isInteger(taxi.totalCents)).toBe(true);
    expect(Number.isFinite(taxi.totalCents)).toBe(true);
  });

  it("1000 km hyper-long ride still computes cleanly", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1000 });
    expect(Number.isInteger(taxi.totalCents)).toBe(true);
    expect(taxi.totalCents).toBeGreaterThan(0);
  });
});

describe("Min/max clamping — waiting", () => {
  it("negative waiting is clamped to 0", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: -10 });
    expect(taxi.billableWaitingMin).toBe(0);
    expect(taxi.waitingChargeCents).toBe(0);
  });

  it("NaN waiting is treated as 0", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: NaN });
    expect(taxi.billableWaitingMin).toBe(0);
    expect(taxi.waitingChargeCents).toBe(0);
  });

  it("undefined waiting (falsy) is treated as 0", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1 });
    expect(taxi.billableWaitingMin).toBe(0);
    expect(taxi.waitingChargeCents).toBe(0);
  });

  it("60 min waiting → 57 billable × $0.95 = $54.15", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 60 });
    expect(taxi.billableWaitingMin).toBe(57);
    expect(taxi.waitingChargeCents).toBe(5415);
  });

  it("1440 min (24 h) extreme waiting still produces finite integer cents", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 1440 });
    expect(Number.isInteger(taxi.waitingChargeCents)).toBe(true);
    expect(Number.isFinite(taxi.totalCents)).toBe(true);
    // 1437 * 95 = 136515
    expect(taxi.waitingChargeCents).toBe(1437 * 95);
  });

  it("simultaneous negative distance + negative waiting → just the flag rate", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: -50, waitingMin: -50 });
    expect(taxi.subtotalCents).toBe(470);
    expect(taxi.totalCents).toBe(470);
  });
});
