

# Driver Experience Audit — PickYou

## What's Working Well
- **Online/offline toggle**: Clear, prominent power button with green visual state, live-ticking duration timer, and shift summary on toggle-off.
- **Dispatch system**: Realtime subscriptions, audio/haptic alerts for broadcast vs dispatched rides, visual flash for urgent requests, 30s/15s countdown timers.
- **Acceptance flow**: Atomic `accept_ride` DB function prevents double-acceptance. Instant feedback with loading spinner and toast.
- **Active trip panel**: Trip stepper, live ETA, Google Maps/Waze deep-links, turn-by-turn nav, rider chat + phone, taxi meter, delivery proof uploads.
- **Earnings**: Detailed breakdown with commission ramp visibility, weekly chart, payout requests, service-type labels.
- **Trip summary + rider rating**: Appears post-trip with fare breakdown, feedback tags, and skip option.

---

## Top 10 Issues (Priority Order)

### 1. Trip completion uses client-side status update (CRITICAL)
**Problem**: `ActiveTripPanel.handleNextAction()` calls `supabase.from("rides").update({ status: "completed" })` directly from the client for non-taxi services, bypassing the `complete-ride` edge function. This skips server-side earnings calculation, commission deduction, and payment capture for standard rides.
**Fix**: Always route completion through `complete-ride` edge function. Only the edge function should set `status = completed`.

### 2. "Start trip" skips `start-ride` edge function (CRITICAL)
**Problem**: `handleNextAction` also sets `status: "in_progress"` via direct client update instead of calling the `start-ride` edge function. This bypasses server-side validation and audit logging.
**Fix**: Route "I've arrived" → call a server function or at minimum validate server-side. Route "Start trip" through `start-ride` edge function.

### 3. No "Arrived" status persisted in database
**Problem**: The stepper UI has an "At pickup" step but `handleNextAction` skips directly from `accepted` to `in_progress`. There's no actual `arrived` status in the `ride_status` enum. The rider never gets an "arrived" notification from the DB trigger.
**Fix**: Add `arrived` to the `ride_status` enum. Update `handleNextAction` to transition: accepted → arrived → in_progress. Update `notify_ride_status_change` trigger to handle the new status.

### 4. Dispatch page shows requests even when driver is offline
**Problem**: `DriverDispatch` fetches pending rides regardless of `profile.is_available`. An offline driver sees requests they shouldn't act on, causing confusion.
**Fix**: Only fetch and show incoming requests when `profile?.is_available === true`. Show a "Go online to receive requests" prompt when offline.

### 5. No server-side validation that driver is online before accepting
**Problem**: The `accept_ride` DB function doesn't check if the driver's `is_available` flag is true. An offline driver could theoretically accept a ride.
**Fix**: Add `is_available` check to `accept_ride` function.

### 6. Trip summary only shows for delivery-type rides
**Problem**: `TripSummaryCard` is rendered from `recentDeliveries` (filtered to delivery service types only). Standard taxi/private_hire/shuttle completions never show a post-trip summary with earnings breakdown and rider rating prompt.
**Fix**: Fetch the most recent completed ride regardless of service type, and show `TripSummaryCard` for all types.

### 7. Dashboard stats poll at 8s with no Realtime
**Problem**: `DriverDashboard` uses `refetchInterval: 8000` for stats. This means earnings and trip counts are always 0-8s stale. Combined with dispatch polling at 5s, this creates unnecessary network load.
**Fix**: Add Realtime subscription on driver's rides to invalidate stats queries instantly.

### 8. Taxi service has no "Complete trip" button
**Problem**: `ActiveTripPanel` line 517: `{activeRide.service_type !== "taxi" && (...action buttons)}`. Taxi drivers have NO way to complete a trip from the UI — they rely solely on the taxi meter's "End Meter" flow, but that only updates meter fields, not ride status.
**Fix**: Show a "Complete trip" button for taxi rides that calls `complete-ride` edge function after the meter is stopped.

### 9. Driver location tracking stops updating profile after going offline
**Problem**: `useDriverLocation` stops tracking when `isActive` is false. However, when a driver goes offline mid-trip (toggle off accidentally), location updates stop and the rider loses tracking. The hook should remain active while there's an active ride.
**Fix**: Track location when `isActive || hasActiveRide`.

### 10. No earnings notification after trip completion
**Problem**: After completing a trip, the driver only sees a toast. If they navigate away before the `TripSummaryCard` renders, they miss their earnings. No push notification is sent to the driver with their earnings for the completed trip.
**Fix**: Send a push notification to the driver with earnings amount after trip completion in `complete-ride` edge function.

---

## Must-Fix Before Launch (Items 1-3, 5, 6, 8)

### Fix 1: Route all status transitions through edge functions
- `accepted → arrived`: New transition (requires enum update)
- `arrived → in_progress`: Call `start-ride` edge function
- `in_progress → completed`: Call `complete-ride` edge function
- Remove direct `supabase.from("rides").update({ status })` from `ActiveTripPanel`

### Fix 2: Add `arrived` to ride_status enum
- DB migration: `ALTER TYPE ride_status ADD VALUE 'arrived' AFTER 'accepted';`
- Update `notify_ride_status_change` trigger to handle `arrived`
- Update `log_ride_event` trigger
- Update ActiveTripPanel stepper logic

### Fix 3: Gate dispatch on online status
- Only show incoming requests when `is_available === true`
- Add `is_available` check to `accept_ride` DB function

### Fix 4: Show TripSummaryCard for ALL service types
- Fetch most recent completed ride (any type) instead of filtering to deliveries only

### Fix 5: Add "Complete trip" button for taxi rides
- After meter is stopped, show complete button that calls `complete-ride`

---

## Quick Wins

1. **Gate dispatch requests on online status** — 5-line conditional in `DriverDispatch.tsx`
2. **Fix TripSummaryCard visibility** — change the query filter to include all service types
3. **Add Realtime to DriverDashboard** — copy the pattern from `DriverDispatch.tsx`
4. **Add active ride check to useDriverLocation** — pass `hasActiveRide` as additional condition

---

## Technical Details

**Files to modify:**
- `src/components/driver/ActiveTripPanel.tsx` — replace direct status updates with edge function calls; add taxi complete button
- `src/pages/DriverDispatch.tsx` — gate requests on online status; fix recentDeliveries → recentCompletedRides
- `src/pages/DriverDashboard.tsx` — add Realtime subscription
- `src/hooks/useDriverLocation.ts` — accept `hasActiveRide` param
- `supabase/functions/complete-ride/index.ts` — add driver earnings push notification

**DB migrations:**
- Add `arrived` value to `ride_status` enum
- Update `accept_ride` function to check `is_available`
- Update `notify_ride_status_change` to handle `arrived` event
- Update `log_ride_event` to handle `arrived` transitions

**Edge function changes:**
- `start-ride/index.ts` — accept transition from `arrived` status
- `complete-ride/index.ts` — send earnings push notification to driver

**Priority**: Fix 1 (server-side transitions) → Fix 2 (arrived status) → Fix 3 (online gating) → Fix 5 (taxi complete) → Fix 4 (summary visibility) → Quick wins

