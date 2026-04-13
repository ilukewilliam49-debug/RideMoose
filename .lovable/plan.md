

# Differentiate Pricing: Private Hire vs Taxi

## Current behavior
- Both taxi and private hire estimates show GST (5%) on top of the fare
- Both use the same fare calculation logic in the meter
- No $1.20 surcharge exists for private hire

## What the user wants
- **Taxi**: Meter fare only, NO GST, no extra surcharge
- **Private Hire**: Meter fare + $1.20 surcharge + 5% GST (on fare + surcharge)

## Changes required

### 1. Rider-facing estimate (PriceEstimate.tsx)
- **Taxi block**: Remove GST line items. Display fare only (no tax breakdown)
- **Private Hire block**: Add a "$1.20 PickYou surcharge" line between fare and GST. Compute GST on (fare + $1.20)

### 2. Price computation (useRideQueries.ts → computePrice)
- **Taxi**: No change to the raw fare calculation (stays as-is, no GST added)
- **Private Hire**: Add 120 cents ($1.20) to the computed estimate before returning

### 3. Taxi meter receipt (useTaxiMeter.ts → computeReceipt)
- Add a `serviceType` parameter to the hook (passed from the ride data)
- **Private Hire**: Add $1.20 (120 cents) to grossFare, then compute 5% GST on that total. Include both in receipt
- **Taxi**: No GST, no surcharge. Receipt total = grossFare + service fee only
- Update the `FareReceipt` interface with `taxCents` and `surchargeCents` fields

### 4. Receipt UI (TaxiMeter.tsx → ReceiptBreakdown)
- Show surcharge and GST lines only for private hire
- For taxi, show fare + service fee only

### 5. Payment capture (capture-payment edge function)
- Branch GST logic by `service_type`:
  - `taxi`: `taxCents = 0`
  - `private_hire`: Add 120 cents surcharge to grossFare, then `taxCents = Math.round((grossFareCents + 120) * 0.05)`
- Adjust `riderTotalCents` accordingly

### 6. Payment intent creation (create-payment-intent edge function)
- Branch GST: taxi authorization should not include GST; private hire should include surcharge + GST in the authorized amount

### 7. Driver trip summary (TripSummaryCard.tsx)
- Conditionally show/hide GST and surcharge lines based on service type

## Files to modify
- `src/components/rider/PriceEstimate.tsx`
- `src/hooks/useRideQueries.ts`
- `src/hooks/useTaxiMeter.ts`
- `src/components/TaxiMeter.tsx`
- `supabase/functions/capture-payment/index.ts`
- `supabase/functions/create-payment-intent/index.ts`
- `src/components/driver/TripSummaryCard.tsx` (if it shows tax)

## No database changes needed
All pricing differentiation is handled in application logic. The existing `tax_cents` column stores whatever is computed.

