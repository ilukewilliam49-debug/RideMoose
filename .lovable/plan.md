

## Analysis: Driver Matching Backend — What Exists vs. What's Needed

### Current State

The app currently uses a **broadcast model**: when a rider requests a ride, it's inserted into the `rides` table with `status = 'requested'`. All eligible drivers see it in their dispatch screen (`DriverDispatch.tsx`) and manually accept or decline. There is **no automated server-side matching**.

Existing building blocks:
- **`directions` edge function** — Google Directions API wrapper returning distance, ETA, and polyline
- **`useDriverETAs` hook** — client-side Haversine + traffic-aware ETA calculation
- **`useNearestDriverETAs` hook** — finds nearest driver per service type (client-side)
- **Profiles table** — has `latitude`, `longitude`, `is_available`, `can_taxi`, `can_private_hire`, `can_courier` fields
- **Rides table** — has `driver_id`, `status` (requested → dispatched → accepted), `service_type`

### Plan

Create a new **`match-driver`** edge function that automates sequential driver matching.

#### 1. Edge Function: `supabase/functions/match-driver/index.ts`

**Input**: `ride_id` (the ride to match)

**Logic**:
1. Fetch the ride record (pickup coords, service type)
2. Query `profiles` for online, available drivers matching the service type
3. Calculate Haversine distance from each driver to pickup; sort ascending; take top 3
4. For each candidate (sequentially):
   - Update ride: `status = 'dispatched'`, `driver_id = candidate.id`
   - Insert a notification for that driver
   - Wait 15 seconds (polling the ride every 3s to check if driver accepted)
   - If driver accepted (`status = 'accepted'`), return success with ETA
   - If not accepted after 15s, clear `driver_id`, reset to `dispatched`, move to next
5. If all 3 decline/timeout, reset ride to `requested` and return no-match
6. Call the `directions` API for the matched driver → pickup to get real ETA and distance

**Output**:
```json
{
  "matched": true,
  "driver_id": "uuid",
  "eta_seconds": 340,
  "eta_text": "6 min",
  "distance_km": 2.8
}
```

**Security**: Uses service role key internally to update rides. Validates that the calling user owns the ride.

#### 2. Database Changes

Add a migration:
- Add `dispatched_to_driver_id` column to `rides` (nullable uuid) — tracks which driver is currently being offered the ride, separate from the final `driver_id`
- Add `dispatch_expires_at` column to `rides` (nullable timestamptz) — when the current offer expires

This keeps the existing `driver_id` clean (only set on acceptance) while tracking the dispatch state.

#### 3. Client Integration

- In `RiderDashboard.tsx` / ride booking flow: after creating the ride, call `supabase.functions.invoke("match-driver", { body: { ride_id } })` instead of just waiting
- Show a "Finding your driver..." animation while the function runs (it may take up to 45s for 3 attempts)
- On the driver side (`DriverDispatch.tsx`): dispatched rides already show via realtime — add a 15-second countdown timer on `IncomingRequestCard` when the ride's `dispatched_to_driver_id` matches the current driver

#### 4. Driver Notification

- The edge function inserts into the `notifications` table and calls `send-push-notification` for each candidate driver
- Existing realtime subscription on `rides` table already triggers UI updates on the driver side

### Technical Details

- The edge function uses Supabase service role for DB writes (bypasses RLS)
- Haversine formula runs server-side in the edge function (no external API needed for distance ranking)
- Google Directions API called once at the end for the matched driver's actual ETA
- 15-second timeout implemented via polling loop with `await new Promise(r => setTimeout(r, 3000))`
- Config in `supabase/config.toml`: `[functions.match-driver]` with `verify_jwt = false`

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/match-driver/index.ts` | Create |
| DB migration (add `dispatched_to_driver_id`, `dispatch_expires_at` to rides) | Create |
| `src/pages/RiderDashboard.tsx` | Modify — call match-driver after ride creation |
| `src/components/driver/IncomingRequestCard.tsx` | Modify — add countdown timer for dispatched rides |
| `supabase/config.toml` | Add match-driver function config |

