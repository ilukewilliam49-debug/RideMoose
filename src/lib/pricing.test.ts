import { describe, it, expect } from "vitest";
import {
  computeFare,
  modeForServiceType,
  formatCents,
  FALLBACK_BYLAW_RATES,
} from "./pricing";

const rates = FALLBACK_BYLAW_RATES;

describe("computeFare — Taxi vs PickYou required scenarios", () => {
  // ── TC1: 100 m, 0 min waiting, no surcharges ──────────────────────────────
  it("TC1 (100m, 0 wait): taxi flag rate only", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 0.1 });
    expect(taxi.baseFareCents).toBe(470);
    expect(taxi.distanceChargeCents).toBe(0);
    expect(taxi.waitingChargeCents).toBe(0);
    expect(taxi.subtotalCents).toBe(470);
    expect(taxi.taxCents).toBe(0);
    expect(taxi.platformFeeCents).toBe(0);
    expect(taxi.totalCents).toBe(470);
  });

  it("TC1 (100m, 0 wait): pickyou adds GST + $0.97 fee", () => {
    const py = computeFare("pickyou", rates, { distanceKm: 0.1 });
    expect(py.subtotalCents).toBe(470);
    expect(py.taxCents).toBe(24); // round(470 * 0.05) = 23.5 → 24
    expect(py.platformFeeCents).toBe(97);
    expect(py.totalCents).toBe(591);
  });

  // ── TC2: 300 m, 0 min waiting ─────────────────────────────────────────────
  it("TC2 (300m, 0 wait): taxi bills 2 increments past flag", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 0.3 });
    // 300m - 150m included = 150m billable → ceil(150/100) = 2 × $0.24 = $0.48
    expect(taxi.distanceChargeCents).toBe(48);
    expect(taxi.subtotalCents).toBe(518);
    expect(taxi.totalCents).toBe(518);
  });

  it("TC2 (300m, 0 wait): pickyou", () => {
    const py = computeFare("pickyou", rates, { distanceKm: 0.3 });
    expect(py.subtotalCents).toBe(518);
    expect(py.taxCents).toBe(26); // round(518 * 0.05) = 25.9 → 26
    expect(py.totalCents).toBe(641);
  });

  // ── TC3: 1 km, 2 min waiting (under 3-min grace) ──────────────────────────
  it("TC3 (1km, 2 wait): taxi — waiting under grace is free", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 2 });
    // 1000m - 150m = 850m → ceil(8.5) = 9 × $0.24 = $2.16
    expect(taxi.distanceChargeCents).toBe(216);
    expect(taxi.billableWaitingMin).toBe(0);
    expect(taxi.waitingChargeCents).toBe(0);
    expect(taxi.subtotalCents).toBe(686);
    expect(taxi.totalCents).toBe(686);
  });

  it("TC3 (1km, 2 wait): pickyou", () => {
    const py = computeFare("pickyou", rates, { distanceKm: 1, waitingMin: 2 });
    expect(py.subtotalCents).toBe(686);
    expect(py.taxCents).toBe(34); // round(686 * 0.05) = 34.3 → 34
    expect(py.totalCents).toBe(817);
  });

  // ── TC4: 5 km, 5 min waiting ──────────────────────────────────────────────
  it("TC4 (5km, 5 wait): taxi", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 5, waitingMin: 5 });
    // 5000 - 150 = 4850m → ceil(48.5) = 49 × $0.24 = $11.76
    expect(taxi.distanceChargeCents).toBe(1176);
    // 5 - 3 = 2 billable min × $0.95 = $1.90
    expect(taxi.billableWaitingMin).toBe(2);
    expect(taxi.waitingChargeCents).toBe(190);
    expect(taxi.subtotalCents).toBe(1836); // 470 + 1176 + 190
    expect(taxi.totalCents).toBe(1836);
  });

  it("TC4 (5km, 5 wait): pickyou", () => {
    const py = computeFare("pickyou", rates, { distanceKm: 5, waitingMin: 5 });
    expect(py.subtotalCents).toBe(1836);
    expect(py.taxCents).toBe(92); // round(1836 * 0.05) = 91.8 → 92
    expect(py.totalCents).toBe(2025);
  });

  // ── TC5: 5 km, 5 min waiting, large vehicle ───────────────────────────────
  it("TC5 (large vehicle): taxi adds $6.00 surcharge", () => {
    const taxi = computeFare("taxi", rates, {
      distanceKm: 5,
      waitingMin: 5,
      largeVehicle: true,
    });
    expect(taxi.largeVehicleSurchargeCents).toBe(600);
    expect(taxi.subtotalCents).toBe(2436);
    expect(taxi.totalCents).toBe(2436);
  });

  it("TC5 (large vehicle): pickyou", () => {
    const py = computeFare("pickyou", rates, {
      distanceKm: 5,
      waitingMin: 5,
      largeVehicle: true,
    });
    expect(py.subtotalCents).toBe(2436);
    expect(py.taxCents).toBe(122); // round(2436 * 0.05) = 121.8 → 122
    expect(py.totalCents).toBe(2655);
  });

  // ── TC6: 5 km, 5 min waiting, pickup/delivery (no passenger) ──────────────
  it("TC6 (pickup/delivery): taxi adds $3.00", () => {
    const taxi = computeFare("taxi", rates, {
      distanceKm: 5,
      waitingMin: 5,
      pickupDeliveryNoPassenger: true,
    });
    expect(taxi.pickupDeliverySurchargeCents).toBe(300);
    expect(taxi.subtotalCents).toBe(2136);
    expect(taxi.totalCents).toBe(2136);
  });

  it("TC6 (pickup/delivery): pickyou", () => {
    const py = computeFare("pickyou", rates, {
      distanceKm: 5,
      waitingMin: 5,
      pickupDeliveryNoPassenger: true,
    });
    expect(py.subtotalCents).toBe(2136);
    expect(py.taxCents).toBe(107); // round(2136 * 0.05) = 106.8 → 107
    expect(py.totalCents).toBe(2340);
  });

  // ── TC7: 5 km, 5 min waiting, large + pickup/delivery ─────────────────────
  it("TC7 (large + pickup/delivery): taxi stacks both surcharges", () => {
    const taxi = computeFare("taxi", rates, {
      distanceKm: 5,
      waitingMin: 5,
      largeVehicle: true,
      pickupDeliveryNoPassenger: true,
    });
    expect(taxi.largeVehicleSurchargeCents).toBe(600);
    expect(taxi.pickupDeliverySurchargeCents).toBe(300);
    expect(taxi.subtotalCents).toBe(2736);
    expect(taxi.totalCents).toBe(2736);
  });

  it("TC7 (large + pickup/delivery): pickyou", () => {
    const py = computeFare("pickyou", rates, {
      distanceKm: 5,
      waitingMin: 5,
      largeVehicle: true,
      pickupDeliveryNoPassenger: true,
    });
    expect(py.subtotalCents).toBe(2736);
    expect(py.taxCents).toBe(137); // round(2736 * 0.05) = 136.8 → 137
    expect(py.totalCents).toBe(2970);
  });
});

describe("computeFare — accessibility waiver", () => {
  it("waives the $6 large-vehicle surcharge when accessibilityRequired", () => {
    const taxi = computeFare("taxi", rates, {
      distanceKm: 5,
      waitingMin: 5,
      largeVehicle: true,
      accessibilityRequired: true,
    });
    expect(taxi.largeVehicleSurchargeCents).toBe(0);
    expect(taxi.subtotalCents).toBe(1836);
  });

  it("does not waive the pickup/delivery surcharge", () => {
    const taxi = computeFare("taxi", rates, {
      distanceKm: 5,
      largeVehicle: true,
      accessibilityRequired: true,
      pickupDeliveryNoPassenger: true,
    });
    expect(taxi.largeVehicleSurchargeCents).toBe(0);
    expect(taxi.pickupDeliverySurchargeCents).toBe(300);
  });
});

describe("computeFare — distance threshold edge cases", () => {
  it("0 km → only the flag rate, no distance charge", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 0 });
    expect(taxi.distanceChargeCents).toBe(0);
    expect(taxi.totalCents).toBe(470);
  });

  it("exactly 150 m (edge of included distance) → 0 increments", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 0.15 });
    expect(taxi.distanceChargeCents).toBe(0);
    expect(taxi.subtotalCents).toBe(470);
  });

  it("150.001 m → ceils to 1 increment (rider never under-billed)", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 0.150001 });
    expect(taxi.distanceChargeCents).toBe(24);
  });

  it("exactly 250 m → 1 increment, not 2", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 0.25 });
    expect(taxi.distanceChargeCents).toBe(24);
  });

  it("250.001 m → ceils to 2 increments", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 0.250001 });
    expect(taxi.distanceChargeCents).toBe(48);
  });

  it("negative distance is clamped to 0", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: -5 });
    expect(taxi.distanceChargeCents).toBe(0);
    expect(taxi.totalCents).toBe(470);
  });
});

describe("computeFare — waiting threshold edge cases", () => {
  it("exactly 3 min waiting → still free", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 3 });
    expect(taxi.billableWaitingMin).toBe(0);
    expect(taxi.waitingChargeCents).toBe(0);
  });

  it("3.5 min → 0.5 billable min → 47.5 ¢ rounds to 48 ¢", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 3.5 });
    expect(taxi.billableWaitingMin).toBe(0.5);
    expect(taxi.waitingChargeCents).toBe(48); // Math.round(0.5 * 95) = 48
  });

  it("10 min → 7 billable min × $0.95 = $6.65", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: 10 });
    expect(taxi.billableWaitingMin).toBe(7);
    expect(taxi.waitingChargeCents).toBe(665);
  });

  it("negative waiting is clamped to 0", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 1, waitingMin: -5 });
    expect(taxi.billableWaitingMin).toBe(0);
    expect(taxi.waitingChargeCents).toBe(0);
  });
});

describe("computeFare — PickYou GST rounding", () => {
  it("rounds GST to the nearest cent (banker's-safe via Math.round)", () => {
    // subtotal 470 → 23.5 → rounds up to 24
    const py = computeFare("pickyou", rates, { distanceKm: 0.1 });
    expect(py.taxCents).toBe(24);
  });

  it("always applies the $0.97 platform fee exactly once", () => {
    const py = computeFare("pickyou", rates, { distanceKm: 50, waitingMin: 30 });
    expect(py.platformFeeCents).toBe(97);
  });

  it("never applies platform fee or GST in taxi mode", () => {
    const taxi = computeFare("taxi", rates, { distanceKm: 50, waitingMin: 30 });
    expect(taxi.taxCents).toBe(0);
    expect(taxi.platformFeeCents).toBe(0);
  });
});

describe("modeForServiceType", () => {
  it("maps 'taxi' → taxi", () => {
    expect(modeForServiceType("taxi")).toBe("taxi");
  });
  it("maps 'private_hire' → pickyou", () => {
    expect(modeForServiceType("private_hire")).toBe("pickyou");
  });
  it("returns null for unsupported services (courier, shuttle, etc.)", () => {
    expect(modeForServiceType("courier")).toBeNull();
    expect(modeForServiceType("shuttle")).toBeNull();
    expect(modeForServiceType("food_delivery")).toBeNull();
  });
});

describe("formatCents", () => {
  it("formats integer cents as $X.XX", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(470)).toBe("$4.70");
    expect(formatCents(2970)).toBe("$29.70");
  });
});
