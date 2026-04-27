import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeFare,
  FALLBACK_BYLAW_RATES as RATES,
  type FareInput,
} from "./pricing";

/**
 * Sanity check: selecting 5–6 passengers must apply the +$6.00 Van Price
 * surcharge to BOTH Taxi and PickYou estimates on:
 *
 *   1. The homepage / dashboard booking widget (RiderDashboard → useRideQueries
 *      → computeFare, gated by `largeVehicle: passengerCount >= 5`)
 *   2. The /ride info-page estimator (RideInfo.tsx, local +$6.00 math)
 *
 * Both surfaces must agree that 1–4 pax = no surcharge, 5–6 pax = +$6.00,
 * applied identically to Taxi and PickYou.
 */

const VAN_SURCHARGE_CENTS = 600;

const baseInput = (passengerCount: number): FareInput => ({
  distanceKm: 5,
  largeVehicle: passengerCount >= 5,
});

describe("Van Price surcharge — booking widget (computeFare)", () => {
  it.each([1, 2, 3, 4])(
    "does NOT apply +$6.00 for %i passengers (taxi + pickyou)",
    (pax) => {
      const taxi = computeFare("taxi", RATES, baseInput(pax));
      const pickyou = computeFare("pickyou", RATES, baseInput(pax));
      expect(taxi.largeVehicleSurchargeCents).toBe(0);
      expect(pickyou.largeVehicleSurchargeCents).toBe(0);
    },
  );

  it.each([5, 6])(
    "applies +$6.00 for %i passengers to BOTH taxi and pickyou",
    (pax) => {
      const taxiSmall = computeFare("taxi", RATES, baseInput(4));
      const pickyouSmall = computeFare("pickyou", RATES, baseInput(4));
      const taxiLarge = computeFare("taxi", RATES, baseInput(pax));
      const pickyouLarge = computeFare("pickyou", RATES, baseInput(pax));

      // Surcharge line item is exactly +$6.00 for both modes
      expect(taxiLarge.largeVehicleSurchargeCents).toBe(VAN_SURCHARGE_CENTS);
      expect(pickyouLarge.largeVehicleSurchargeCents).toBe(VAN_SURCHARGE_CENTS);

      // Subtotal jumps by exactly +$6.00 in both modes
      expect(taxiLarge.subtotalCents - taxiSmall.subtotalCents).toBe(VAN_SURCHARGE_CENTS);
      expect(pickyouLarge.subtotalCents - pickyouSmall.subtotalCents).toBe(VAN_SURCHARGE_CENTS);

      // Taxi total jumps by exactly +$6.00 (tax-exempt)
      expect(taxiLarge.totalCents - taxiSmall.totalCents).toBe(VAN_SURCHARGE_CENTS);

      // PickYou total jumps by +$6.00 plus 5% GST on the surcharge
      const expectedPickyouDelta =
        VAN_SURCHARGE_CENTS + Math.round(VAN_SURCHARGE_CENTS * RATES.pickyou_gst_rate);
      expect(pickyouLarge.totalCents - pickyouSmall.totalCents).toBe(expectedPickyouDelta);
    },
  );

  it("waives the surcharge when accessibility_required is set (5 pax)", () => {
    const taxi = computeFare("taxi", RATES, {
      distanceKm: 5,
      largeVehicle: true,
      accessibilityRequired: true,
    });
    expect(taxi.largeVehicleSurchargeCents).toBe(0);
  });
});

describe("Van Price surcharge — /ride info page estimator", () => {
  // The RideInfo page hard-codes the same +$6.00 surcharge for groups >= 5.
  // Static-source check guarantees the constant and the threshold can't drift
  // away from the booking-widget contract verified above.
  const rideInfoSrc = readFileSync(
    resolve(__dirname, "../pages/RideInfo.tsx"),
    "utf-8",
  );

  it("declares VAN_SURCHARGE = 6.00 dollars", () => {
    expect(rideInfoSrc).toMatch(/VAN_SURCHARGE\s*=\s*6\.00\b/);
  });

  it("gates the surcharge on passengers >= 5", () => {
    expect(rideInfoSrc).toMatch(/passengers\s*>=\s*5\s*\?\s*VAN_SURCHARGE\s*:\s*0/);
  });

  it("applies the surcharge to BOTH taxi and pickyou subtotals", () => {
    // Taxi line: subtotal + surcharge
    expect(rideInfoSrc).toMatch(/taxi\s*=\s*subtotal\s*\+\s*surcharge/);
    // PickYou line: (subtotal + surcharge) * (1 + GST)
    expect(rideInfoSrc).toMatch(/pickyouSubtotal\s*=\s*subtotal\s*\+\s*surcharge/);
    expect(rideInfoSrc).toMatch(/pickyouSubtotal\s*\*\s*\(1\s*\+\s*GST_RATE\)/);
  });
});
