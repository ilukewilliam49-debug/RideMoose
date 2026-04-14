

# Driver Experience Fixes — Prioritized Action Plan

## Already Implemented ✓
These items from the audit are complete and working:
- Server-side `start-ride` and `complete-ride` edge functions (issues #1, #2)
- `arrived` status in ride_status enum and stepper UI (issue #3)
- Dispatch gated on `is_available` (issue #4)
- `accept_ride` checks driver availability server-side (issue #5)
- TripSummaryCard shows for ALL service types (issue #6)
- Realtime subscription on DriverDashboard (issue #7)
- Taxi "Complete trip" button after meter stops (issue #8)
- Location tracking continues during active ride (issue #9)
- Earnings notification after trip completion (issue #10)
- Declined ride persistence in localStorage
- AudioContext warm-up for notification sounds
- Scoped Realtime on DriverDispatch

## Remaining Issues — 5 Items

### 1. "Arrived" transition is still client-side (HIGH priority)
`ActiveTripPanel.tsx` line 210 sets `status: "arrived"` via direct `supabase.from("rides").update()`, bypassing server-side validation. This is the only status transition not going through an edge function.

**Fix**: Create an `arrive-ride` edge function (or extend `start-ride` to accept an `action` param). Replace the direct update in `handleArrivedAtPickup` with `supabase.functions.invoke("arrive-ride", { body: { ride_id } })`.

### 2. No estimated earnings on incoming request card (MEDIUM priority)
Drivers see pickup address, distance, and countdown — but not estimated earnings. This is the #1 factor in acceptance speed for ride-share drivers.

**Fix**: In `IncomingRequestCard`, compute and display estimated driver earnings from `estimated_price` minus estimated commission. Show as a prominent chip: "Est. $X.XX".

### 3. No distance-to-pickup on incoming request card (MEDIUM priority)
Drivers can't quickly assess how far away the pickup is. The card shows pickup address but not the distance from the driver's current location.

**Fix**: Pass driver lat/lng into `IncomingRequestCard`. Calculate haversine distance to pickup and display "X.X km away" chip.

### 4. Dead profile columns: `can_food_delivery` and `pet_approved` (LOW priority)
These columns still exist in the `profiles` table after removing food/pet service types. They add confusion to driver onboarding and admin panels.

**Fix**: DB migration to drop `can_food_delivery` and `pet_approved` columns from `profiles`.

### 5. No Realtime subscription for dispatch ride list (LOW priority)
The dispatch page listens for new/updated rides via Realtime, but the `filter: status=eq.requested` subscription on UPDATE events won't catch rides that transition *away* from `requested` (e.g., when another driver accepts). This means a stale "requested" ride can linger for up to 5s (the polling interval).

**Fix**: Add a broader Realtime listener for ride status changes (INSERT + UPDATE without status filter) to invalidate the dispatch query instantly when any ride changes status.

---

## Implementation Priority

```text
Priority  | Item                              | Impact           | Effort
──────────┼───────────────────────────────────┼──────────────────┼────────
1 (HIGH)  | arrive-ride edge function         | Safety/integrity | ~30 min
2 (MED)   | Estimated earnings on request     | Acceptance speed | ~20 min
3 (MED)   | Distance-to-pickup chip           | Acceptance speed | ~15 min
4 (LOW)   | Drop dead profile columns         | Code hygiene     | ~5 min
5 (LOW)   | Broader Realtime on dispatch      | Fewer stale UIs  | ~10 min
```

## Technical Details

**New edge function:**
- `supabase/functions/arrive-ride/index.ts` — validates ride is `accepted`, driver is assigned, then sets `status = 'arrived'`

**Modified files:**
- `src/components/driver/ActiveTripPanel.tsx` — replace `handleArrivedAtPickup` direct update with edge function call
- `src/components/driver/IncomingRequestCard.tsx` — add estimated earnings display and distance-to-pickup chip
- `src/pages/DriverDispatch.tsx` — pass driver coords to `IncomingRequestCard`; broaden Realtime filter

**DB migration:**
- Drop `can_food_delivery` and `pet_approved` columns from `profiles`

