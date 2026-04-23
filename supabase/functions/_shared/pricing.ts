/**
 * SHARED PRICING — server-side source of truth.
 *
 * This file MIRRORS `src/lib/pricing.ts` byte-for-byte in algorithm and
 * constants. It exists separately because Deno edge functions cannot
 * import from the Vite/`src` tree. Any change to fare math MUST be made
 * in BOTH files (or, ideally, this file is generated from the client one).
 *
 * If you find yourself editing only one of the two, STOP — the audit
 * specifically called out pricing drift between client estimate, driver
 * meter, and server capture as a regulatory risk.
 *
 * City of Yellowknife taxi bylaw fare calculator + PickYou Independent.
 *
 * MODE 1 — TAXI (City-Regulated)
 *   Flag rate              $4.70 (includes first 150 m)
 *   Distance               $0.24 per 100 m after the first 150 m
 *   Waiting (after 3 min)  $0.95 / minute
 *   Pickup/Delivery (no passenger)  +$3.00
 *   Large vehicle (5–6 pax)         +$6.00 (waived if accessibility_required)
 *   Tax:        none
 *   Service fee: none
 *
 * MODE 2 — PICKYOU INDEPENDENT
 *   Same metered base + surcharges as Taxi, then:
 *     +5% GST on the bylaw subtotal
 *     +$0.97 PickYou platform fee (NOT itself subject to GST)
 */

export interface BylawRates {
  base_fare_cents: number;
  included_meters: number;
  per_increment_cents: number;
  increment_meters: number;
  waiting_per_min_cents: number;
  free_waiting_min: number;
  large_vehicle_surcharge_cents: number;
  pickup_delivery_surcharge_cents: number;
  pickyou_platform_fee_cents: number;
  pickyou_gst_rate: number;
}

export const FALLBACK_BYLAW_RATES: BylawRates = {
  base_fare_cents: 470,
  included_meters: 150,
  per_increment_cents: 24,
  increment_meters: 100,
  waiting_per_min_cents: 95,
  free_waiting_min: 3,
  large_vehicle_surcharge_cents: 600,
  pickup_delivery_surcharge_cents: 300,
  pickyou_platform_fee_cents: 97,
  pickyou_gst_rate: 0.05,
};

export type FareMode = "taxi" | "pickyou";

export interface FareInput {
  /** Trip distance in kilometres. */
  distanceKm: number;
  /** Total waiting minutes (free grace period applied inside). */
  waitingMin?: number;
  /** True for 5–6 pax van. */
  largeVehicle?: boolean;
  /** True if accessibility use waives the large-vehicle surcharge. */
  accessibilityRequired?: boolean;
  /** Auto-true for Courier service / parcel-only rides. */
  pickupDeliveryNoPassenger?: boolean;
}

export interface FareBreakdown {
  baseFareCents: number;
  distanceChargeCents: number;
  waitingChargeCents: number;
  freeWaitingMin: number;
  billableWaitingMin: number;
  largeVehicleSurchargeCents: number;
  pickupDeliverySurchargeCents: number;
  subtotalCents: number;
  taxCents: number;
  platformFeeCents: number;
  totalCents: number;
  mode: FareMode;
}

/**
 * Compute the fare per the City of Yellowknife bylaw (Taxi or PickYou).
 * All amounts are returned in integer cents.
 */
export function computeFare(
  mode: FareMode,
  rates: BylawRates,
  input: FareInput,
): FareBreakdown {
  const distanceKm = Math.max(0, input.distanceKm || 0);
  const waitingMin = Math.max(0, input.waitingMin || 0);

  // Distance charge
  const totalMeters = distanceKm * 1000;
  const billableMeters = Math.max(0, totalMeters - rates.included_meters);
  const increments = Math.ceil(billableMeters / rates.increment_meters);
  const distanceChargeCents = increments * rates.per_increment_cents;

  // Waiting charge
  const billableWaitingMin = Math.max(0, waitingMin - rates.free_waiting_min);
  const waitingChargeCents = Math.round(
    billableWaitingMin * rates.waiting_per_min_cents,
  );

  // Surcharges
  const largeVehicleSurchargeCents =
    input.largeVehicle && !input.accessibilityRequired
      ? rates.large_vehicle_surcharge_cents
      : 0;

  const pickupDeliverySurchargeCents = input.pickupDeliveryNoPassenger
    ? rates.pickup_delivery_surcharge_cents
    : 0;

  const subtotalCents =
    rates.base_fare_cents +
    distanceChargeCents +
    waitingChargeCents +
    largeVehicleSurchargeCents +
    pickupDeliverySurchargeCents;

  // PickYou-only fees
  const taxCents =
    mode === "pickyou"
      ? Math.round(subtotalCents * rates.pickyou_gst_rate)
      : 0;
  const platformFeeCents =
    mode === "pickyou" ? rates.pickyou_platform_fee_cents : 0;

  const totalCents = subtotalCents + taxCents + platformFeeCents;

  return {
    baseFareCents: rates.base_fare_cents,
    distanceChargeCents,
    waitingChargeCents,
    freeWaitingMin: rates.free_waiting_min,
    billableWaitingMin,
    largeVehicleSurchargeCents,
    pickupDeliverySurchargeCents,
    subtotalCents,
    taxCents,
    platformFeeCents,
    totalCents,
    mode,
  };
}

/** Convert a service_type string to FareMode. Returns null for non-metered. */
export function modeForServiceType(serviceType: string): FareMode | null {
  if (serviceType === "taxi") return "taxi";
  if (serviceType === "private_hire") return "pickyou";
  return null;
}

/**
 * Coerce a partial taxi_rates row from the DB into a complete BylawRates,
 * filling any missing fields from FALLBACK_BYLAW_RATES. Use this in edge
 * functions immediately after `select('*').from('taxi_rates')`.
 */
export function coerceRatesRow(row: Record<string, unknown> | null | undefined): BylawRates {
  const r = (row ?? {}) as Record<string, unknown>;
  const num = (k: keyof BylawRates) =>
    r[k] !== undefined && r[k] !== null
      ? Number(r[k])
      : FALLBACK_BYLAW_RATES[k];
  return {
    base_fare_cents: num("base_fare_cents"),
    included_meters: num("included_meters"),
    per_increment_cents: num("per_increment_cents"),
    increment_meters: num("increment_meters"),
    waiting_per_min_cents: num("waiting_per_min_cents"),
    free_waiting_min: num("free_waiting_min"),
    large_vehicle_surcharge_cents: num("large_vehicle_surcharge_cents"),
    pickup_delivery_surcharge_cents: num("pickup_delivery_surcharge_cents"),
    pickyou_platform_fee_cents: num("pickyou_platform_fee_cents"),
    pickyou_gst_rate: num("pickyou_gst_rate"),
  };
}
