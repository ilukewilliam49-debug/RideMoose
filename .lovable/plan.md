

# Remaining Audit Fixes — Implementation Plan

## Already Completed ✓
- Database indexes (rides, profiles, notifications)
- Stripe fee calculation (already uses `riderTotalCents`)
- Stripe secrets not exposed to frontend
- Stale ride cleanup edge function exists
- Driver-cancel flow implemented
- Ride request debounce
- Scoped Realtime subscriptions
- Notification deduplication
- Rating dialog dismissal persistence
- Matching timeout UX (180s)
- Offline/reconnection banner
- Driver info on ActiveRideCard
- Pickup auto-fill from geolocation
- Saved places → dropoff fix

## Still Outstanding — 6 Items

### 1. Idempotency on Stripe capture calls
**Risk**: Network retry could double-capture payment.
- Add Stripe idempotency key to `capture-payment/index.ts` using `ride_id` as the key
- One-line addition: `{ idempotencyKey: ride_id }` on the Stripe capture call

### 2. Rider overage payment flow
**Risk**: Riders with outstanding amounts have no self-service way to pay.
- Add a "Pay Now" button on the outstanding balance banner in `RiderDashboard.tsx`
- On click, create a new PaymentIntent via `create-payment-intent` edge function for the outstanding amount
- Use Stripe's payment sheet to collect, then clear `outstanding_amount_cents`

### 3. Dead food/pet code cleanup
**Impact**: Reduces confusion, smaller bundle.
- Remove `food_delivery` and `pet_transport` references from `DriverDispatch.tsx`, `IncomingRequestCard.tsx`, `ActiveTripPanel.tsx`, `DriverEarningsSummary.tsx`, `AdminBookings.tsx`
- Remove dead DB triggers (`notify_pet_transport_drivers`, `notify_large_delivery_drivers` food references)
- Remove dead tables: `restaurants`, `menu_categories`, `menu_items`, `food_order_items`

### 4. Persist declined ride IDs
**Risk**: Driver refresh causes declined rides to reappear.
- Store declined ride IDs in `localStorage` instead of React state in `DriverDispatch.tsx`
- Clear on shift end or after 1 hour

### 5. Audio context initialization fix
**Risk**: First notification sound may be silent on mobile.
- Add a one-time `AudioContext.resume()` call when the driver toggles online in `DriverDispatch.tsx`
- This satisfies browser autoplay policy

### 6. Admin force-cancel/reassign ride
**Impact**: Ops team cannot intervene on stuck rides.
- Add "Cancel Ride" and "Reassign Driver" buttons on `AdminRideDetail.tsx`
- Use existing RLS admin policies to update ride status

---

## Technical Details

**Files modified:**
1. `supabase/functions/capture-payment/index.ts` — add idempotency key
2. `src/pages/RiderDashboard.tsx` — overage payment button + Stripe integration
3. `src/pages/DriverDispatch.tsx` — localStorage for declines, AudioContext resume
4. `src/components/driver/IncomingRequestCard.tsx` — remove pet/food refs
5. `src/components/driver/ActiveTripPanel.tsx` — remove pet/food refs
6. `src/components/DriverEarningsSummary.tsx` — remove pet/food refs
7. `src/pages/AdminBookings.tsx` — remove pet/food filter options
8. `src/pages/AdminRideDetail.tsx` — add force-cancel/reassign controls
9. DB migration — drop dead tables and triggers

**Priority order:** 1 → 2 → 4 → 5 → 3 → 6 (stability first, then cleanup)

