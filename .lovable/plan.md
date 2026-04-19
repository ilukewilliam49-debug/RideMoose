

## Goal
Make PickYou (private_hire) fare always equal **Taxi meter estimate + $2.99 surcharge + 5% GST**, instead of using a separate base/per-km/per-min formula.

## Root cause
In `src/hooks/useRideQueries.ts` `computePrice()`:
- `taxi` uses `taxi_meter_rates` (base_fare_cents + km × per_km_cents)
- `private_hire` uses the `service_pricing` row (different base, per-km AND per-min, surge, minimum)

So the two base estimates are unrelated. The $2.99 surcharge in `PriceEstimate.tsx` is added on top of the *private_hire base*, not the *taxi base*.

Example with your trip: taxi base = $13.14 → PickYou base = something else (e.g. $10.62) → display = $10.62 + $2.99 + GST. Hence the mismatch.

## Fix (frontend only — 1 file)
`src/hooks/useRideQueries.ts`, inside `computePrice()`:
- Replace the `private_hire` branch so it returns the **same** number as the `taxi` branch (just the meter estimate). The existing surcharge + GST math in `PriceEstimate.tsx` and `create-payment-intent` already adds $2.99 + 5% GST on top — no changes needed there.

```ts
if (svcType === "private_hire") {
  if (!routeKm || !taxiRates) return null;
  return ((taxiRates.base_fare_cents + routeKm * taxiRates.per_km_cents) / 100).toFixed(2);
}
```

## Result
For your current trip:
- Taxi card: **$13.14**
- PickYou card breakdown:
  - Fare: $13.14
  - PickYou Surcharge: $2.99
  - GST (5%): $0.81
  - **Total: $16.94**

## Files touched
- `src/hooks/useRideQueries.ts` — single branch change in `computePrice()`

## Out of scope
- No DB migration. The `service_pricing` row for `private_hire` becomes unused for estimates but stays in DB for admin reference.
- Backend Edge Functions (`create-payment-intent`, `pay-with-saved-card`, `capture-payment`) already compute surcharge + GST from the fare passed in — they remain correct.

