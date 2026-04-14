

# Rider Flow Fixes — Implementation Plan

## What's Already Done
- Saved places → dropoff (fixed)
- Matching timeout 180s (fixed)
- Pickup auto-fill from geolocation (fixed)
- Driver info card with photo/vehicle/rating on ActiveRideCard (fixed)
- Stripe idempotency, overage payment, decline persistence, AudioContext, admin force-cancel (fixed)
- Rating system, receipt component, cancel dialog, offline banner (all exist)

## Remaining Issues — 8 Items, Priority Order

### 1. Post-Trip Receipt Auto-Display (High Impact, Fast)
**Problem**: After trip completion, rider sees nothing — receipt only accessible by drilling into ride history detail sheet.
**Fix**: When `activeRide` transitions from `in_progress` to `completed`, automatically show a trip summary dialog with fare breakdown, driver info, and the existing `RideReceipt` component. Add a `useEffect` in `RiderDashboard.tsx` that detects a newly completed ride (track previous status) and opens a `TripCompleteSheet`.
- Create `src/components/rider/TripCompleteSheet.tsx` — sheet with fare, route summary, receipt download, and rate button
- Wire into `RiderDashboard.tsx`

### 2. Ride Confirmation Step (High Impact, Medium)
**Problem**: Tapping "Request Ride" submits instantly with no review. Riders can't verify details before committing.
**Fix**: Add a confirmation bottom sheet before `requestRide()` executes, showing:
- Pickup → Dropoff addresses
- Service type, estimated price
- Payment method
- "Confirm" and "Edit" buttons
- Create `src/components/rider/RideConfirmSheet.tsx`
- Wire into `RiderDashboard.tsx` — button opens sheet, sheet's confirm triggers `requestRide()`

### 3. Server-Side Duplicate Ride Prevention (Critical Safety)
**Problem**: Nothing stops a rider from having multiple active rides simultaneously.
**Fix**: Add a database trigger on `rides` INSERT that checks for existing active rides (`requested`, `accepted`, `in_progress`) for the same `rider_id` and raises an exception if found.
- DB migration with a validation trigger

### 4. Dead Code Cleanup — pet_transport/food_delivery Remnants (Medium, Fast)
**Problem**: Previous cleanup missed references in `useRideQueries.ts` (pet_transport price calc), `DriverDispatch.tsx` (food_delivery/pet query keys), `driver-constants.ts`, `send-push-notification`, `capture-payment`, and `pet-arrival-notify` edge function.
**Fix**:
- Remove pet_transport pricing block from `useRideQueries.ts`
- Remove `can_food_delivery`/`pet_approved` from dispatch query key in `DriverDispatch.tsx`
- Clean `driver-constants.ts` labels/icons
- Remove pet/food branches from `send-push-notification/index.ts` and `capture-payment/index.ts`
- Note: `pet-arrival-notify` edge function is fully dead — delete it
- Clean `driver_can_serve` DB function of food/pet branches

### 5. Realtime for Active Ride Banner on Home Screen (Medium Impact)
**Problem**: `ActiveRideBanner.tsx` polls every 10s. Rider on home screen doesn't see status changes (driver assigned, ride started) for up to 10s.
**Fix**: Add a scoped Realtime subscription in `ActiveRideBanner.tsx` that invalidates the banner query on ride changes, reducing perceived latency to near-instant.

### 6. "Driver Arrived" Distinct State (UX Polish)
**Problem**: No visual distinction between "driver en route" and "driver has arrived at pickup."
**Fix**: Since there's no `arrived` DB status, use proximity detection — when driver location is within ~100m of pickup coords, show "Your driver has arrived" in `ActiveRideCard.tsx` instead of the generic "accepted" status. Use `driverProfile.latitude/longitude` vs `activeRide.pickup_lat/pickup_lng`.

### 7. Pickup Address Auto-Fill on Home Screen (Quick Win)
**Problem**: `DashboardHome.tsx` detects user location for the map but doesn't auto-fill the pickup input.
**Fix**: After geolocation succeeds in the `useEffect`, reverse-geocode and set `pickupAddress` automatically (same pattern already used in `RiderDashboard.tsx`).

### 8. Outstanding Balance Visibility on Home Screen (Quick Win)
**Problem**: Outstanding balance warning only shows on the booking page, not the home screen. Riders may not realize they owe money.
**Fix**: Add a compact "You have an outstanding balance" banner on `DashboardHome.tsx` that links to the booking page.

---

## Technical Details

**New files:**
- `src/components/rider/TripCompleteSheet.tsx`
- `src/components/rider/RideConfirmSheet.tsx`

**Modified files:**
- `src/pages/RiderDashboard.tsx` — trip complete detection, confirm sheet integration
- `src/pages/DashboardHome.tsx` — pickup auto-fill, outstanding balance banner
- `src/components/rider/ActiveRideBanner.tsx` — Realtime subscription
- `src/components/rider/ActiveRideCard.tsx` — driver arrived proximity check
- `src/hooks/useRideQueries.ts` — remove pet_transport pricing
- `src/pages/DriverDispatch.tsx` — remove food/pet query key refs
- `src/lib/driver-constants.ts` — remove food/pet labels
- `supabase/functions/send-push-notification/index.ts` — remove food/pet branches
- `supabase/functions/capture-payment/index.ts` — remove pet commission branch

**Deleted:**
- `supabase/functions/pet-arrival-notify/` — dead edge function

**DB migration:**
- Trigger to prevent duplicate active rides per rider
- Clean `driver_can_serve` function

**Priority**: 1 → 3 → 2 → 7 → 5 → 6 → 8 → 4

