/**
 * City of Yellowknife taxi bylaw fare calculator + PickYou Independent variant.
 *
 * Single source of truth shared between:
 *   • Rider price estimate (PriceEstimate.tsx, useRideQueries.ts)
 *   • Driver meter (useTaxiMeter.ts)
 *   • Server-authoritative capture (capture-payment edge function mirrors this)
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
 *     +5% GST on the bylaw subtotal (base + distance + waiting + surcharges)
 *     +$0.97 PickYou platform fee, added AFTER GST and itself NOT subject
 *       to GST (it is a flat service charge layered on top of the regulated
 *       taxable supply, not part of the metered fare).
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
  /**
   * If true, the large-vehicle surcharge is waived (wheelchair / accessibility
   * use is not chargeable per City bylaw).
   */
  accessibilityRequired?: boolean;
  /** Auto-true for Courier service / parcel-only rides. */
  pickupDeliveryNoPassenger?: boolean;
}

export interface FareBreakdown {
  /** Flag rate (includes first 150 m). */
  baseFareCents: number;
  /** $0.24 × increments after the included distance. */
  distanceChargeCents: number;
  /** $0.95 × billable waiting minutes. */
  waitingChargeCents: number;
  /** Free waiting minutes used in this calc. */
  freeWaitingMin: number;
  /** Waiting minutes that were actually billable. */
  billableWaitingMin: number;
  /** $6.00 if large vehicle and not accessibility-waived. */
  largeVehicleSurchargeCents: number;
  /** $3.00 if no passengers (parcel only). */
  pickupDeliverySurchargeCents: number;
  /** Subtotal before PickYou-only fees (flag + distance + wait + surcharges). */
  subtotalCents: number;
  /** 5% GST on subtotal — PickYou mode only. */
  taxCents: number;
  /** $0.97 platform fee — PickYou mode only. */
  platformFeeCents: number;
  /** Final amount the rider pays. */
  totalCents: number;
  /** "taxi" or "pickyou" — for receipts. */
  mode: FareMode;
}

/**
 * Compute the fare per the City of Yellowknife bylaw (Taxi or PickYou).
 *
 * All amounts are returned in integer cents to avoid floating-point drift.
 */
export function computeFare(
  mode: FareMode,
  rates: BylawRates,
  input: FareInput
): FareBreakdown {
  const distanceKm = Math.max(0, input.distanceKm || 0);
  const waitingMin = Math.max(0, input.waitingMin || 0);

  // ── Distance charge ────────────────────────────────────────────────────────
  const totalMeters = distanceKm * 1000;
  const billableMeters = Math.max(0, totalMeters - rates.included_meters);
  const increments = Math.ceil(billableMeters / rates.increment_meters);
  const distanceChargeCents = increments * rates.per_increment_cents;

  // ── Waiting charge ─────────────────────────────────────────────────────────
  const billableWaitingMin = Math.max(0, waitingMin - rates.free_waiting_min);
  const waitingChargeCents = Math.round(
    billableWaitingMin * rates.waiting_per_min_cents
  );

  // ── Surcharges ─────────────────────────────────────────────────────────────
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

  // ── PickYou-only fees ─────────────────────────────────────────────────────
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

/** Convert a fare service_type string to FareMode. */
export function modeForServiceType(serviceType: string): FareMode | null {
  if (serviceType === "taxi") return "taxi";
  if (serviceType === "private_hire") return "pickyou";
  return null;
}

/** Format cents as $X.XX. */
export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
