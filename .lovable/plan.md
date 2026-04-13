

# PickYou Ride-Sharing App — Full Audit Report

---

## 1. USER EXPERIENCE (UX/UI)

**Friction Points Identified:**
- **No inline address entry on booking page**: Pickup/dropoff are passed via URL params from the home screen. If a rider lands directly on `/rider/rides`, there's no visible way to enter addresses — the form appears empty with no obvious inputs.
- **Geolocation uses Nominatim (OpenStreetMap)** for reverse geocoding instead of Google Places. This produces verbose, less-recognizable addresses in Yellowknife/Dettah (e.g., full county strings).
- **No loading indicator during driver matching**: The `DriverMatchingOverlay` appears but there's no timeout or user feedback if `match-driver` hangs (the edge function polls up to 45+ seconds synchronously).
- **Rating dialog auto-opens** on every dashboard load if an unrated ride exists — can feel intrusive if the rider dismissed it previously.
- **Pet transport and food delivery** references remain in code (`petMode`, `can_food_delivery`, `pet_approved` filters) despite being removed from the UI — confusing if encountered.

**Recommendations:**
- Add fallback address inputs directly on the booking page
- Switch reverse geocoding to Google Geocoding API (key already available)
- Add a visual timeout (e.g., "No drivers found after 60s — try again") on the matching overlay
- Persist rating dismissal so it doesn't reappear until next completed ride

---

## 2. DRIVER EXPERIENCE

**Issues:**
- **Decline is client-side only** (`declinedIds` state): If the driver refreshes the page, declined rides reappear. No server-side tracking of declines.
- **No auto-accept timeout warning**: For dispatched rides, the 15s countdown is shown but if the driver doesn't act, the ride silently disappears — no "You missed a ride" feedback.
- **Sound alerts use Web Audio API** which requires user interaction to initialize `AudioContext` on mobile browsers — first alert may be silent.
- **Polling every 5s** for pending rides is fine for low volume but will generate heavy DB load at scale.

**Recommendations:**
- Persist declined ride IDs in localStorage or a DB column
- Add a "Missed ride" toast when a dispatched ride expires
- Request audio permission on first interaction (e.g., when going online)
- At scale, replace polling with Realtime-only updates

---

## 3. CORE RIDE SYSTEM

**Race Conditions:** HANDLED — The `accept_ride` PostgreSQL function uses `FOR UPDATE SKIP LOCKED`, which is correct.

**Stuck Ride States — CRITICAL:**
- **No timeout on `requested` rides**: If no driver accepts and the match-driver function returns "no_driver_accepted", the ride is reset to `requested` but could remain there indefinitely.
- **No timeout on `accepted` rides**: If a driver accepts but never starts the ride, it stays in `accepted` forever.
- **No timeout on `dispatched` rides**: The `dispatch_expires_at` is set but nothing automatically resets the ride if the edge function crashes mid-dispatch.

**Missing Transitions:**
- No automatic cancellation of stale rides (needs a cron/scheduled function)
- No "driver cancelled" flow — driver can only "decline" before accepting. After accepting, there's no driver-initiated cancel mechanism.

**Recommendations:**
- Create a scheduled edge function (cron) to auto-cancel rides stuck in `requested` > 10min, `accepted` > 15min, or `dispatched` past `dispatch_expires_at`
- Add a driver-cancel flow post-acceptance with appropriate rider notification

---

## 4. REAL-TIME PERFORMANCE

**Current Setup:**
- Rides, delivery_bids, notifications, ride_messages, ride_events are in `supabase_realtime` publication
- Rider subscribes to all ride changes (unfiltered `table: "rides"`)
- Driver subscribes to all ride changes (unfiltered `table: "rides"`)

**Issues — CRITICAL:**
- **Unfiltered Realtime subscriptions**: Both rider and driver subscribe to ALL changes on the `rides` table. At scale with 1000+ rides/day, every status change triggers invalidation for every connected client.
- **No Realtime channel authorization enforced**: The `authorize_realtime_channel` function exists but the subscriptions in code use generic table-level channels, not ride-specific ones.
- **Driver location polling** (every 5s via profile refetch) instead of Realtime — creates unnecessary DB reads.

**Recommendations:**
- Scope Realtime subscriptions to specific ride IDs or use filter-based channels
- Use Realtime for driver location broadcasts instead of polling profiles table
- Remove `notification_logs` from Realtime publication (admin-only, no need)

---

## 5. MATCHING SYSTEM

**Architecture:** Sequential dispatch to top 3 nearest drivers with 15s timeout each. Falls back to broadcast.

**Issues:**
- **Blocking edge function**: `match-driver` holds the HTTP connection for up to 45+ seconds (3 candidates × 15s). This is fragile — client or gateway timeout could kill it mid-dispatch.
- **Haversine-only fallback**: Google Directions API used only after a match, not for ranking. Two drivers equidistant by air may have very different road times.
- **No blacklist/cooldown**: A driver who just declined a ride could be re-dispatched if the system retries.

**Recommendations:**
- Refactor to async dispatch: insert dispatch records, use a scheduled function to poll for acceptance, return immediately to the client
- Consider road-distance for initial ranking (or at minimum, use it for top 3)

---

## 6. NOTIFICATION SYSTEM

**Current:** OneSignal push + Twilio SMS fallback, triggered by `trg_notify_ride_status` DB trigger calling `send-push-notification` edge function via `pg_net`.

**Issues:**
- **Trigger fires on status change** but the trigger itself (`notify_ride_status_change`) reads `app.settings.supabase_url` and `vault.decrypted_secrets` — if either is missing, notifications silently fail with no error logging.
- **No retry on push failure**: `send-push-notification` logs failures to `notification_logs` but there's no retry mechanism.
- **Duplicate risk**: Both the trigger AND the `match-driver` function insert notifications — a driver could get both a push notification and a DB notification for the same dispatch.

**Recommendations:**
- Add health check for the trigger's ability to resolve secrets
- Deduplicate notifications using ride_id + event type before sending
- Add retry logic for failed pushes (scheduled function to retry pending logs)

---

## 7. DATABASE & BACKEND

**Critical Missing Indexes:**
```text
rides table has ONLY the primary key index. Missing:
- rides(rider_id, status)     — used by every rider query
- rides(driver_id, status)    — used by every driver query  
- rides(status)               — used by dispatch board
- rides(completed_at)         — used by earnings queries
- rides(organization_id)      — used by corporate billing

profiles table missing:
- profiles(role, is_available) — used by driver matching

notifications table missing:
- notifications(user_id, read) — used by notification bell
```

This is the single biggest performance risk. Every query on rides is doing a sequential scan.

**Other Issues:**
- `food_order_items`, `menu_categories`, `menu_items`, `restaurants` tables exist but food delivery is removed — dead schema
- `private_hire_zones` table is now dead code (route pricing removed)

---

## 8. SECURITY

**2 Critical Findings:**
1. **Stripe payment data exposed to drivers**: `stripe_payment_intent_id`, `overage_client_secret`, financial fields are readable by drivers via RLS. Drivers should NOT see Stripe secrets.
2. **Realtime channel authorization not enforced**: Any authenticated user can subscribe to any channel topic and receive all ride updates.

**4 Warnings:**
3. Avatars bucket allows public listing of all files
4. `proof-photos` bucket has an overly permissive upload policy
5. Organization financial data exposed to all org members (not just admins)
6. Support conversations can't be updated by users (messages JSONB)

**Recommendations (must fix):**
- Create a database VIEW for driver-facing ride data that excludes Stripe fields
- Or add column-level security / restrict the SELECT policy for drivers
- Enforce Realtime channel auth by switching to ride-specific channel names

---

## 9. PAYMENT FLOW

**Architecture:** Authorize-then-capture (125% for taxi). Private hire adds $1.20 surcharge + 5% GST. Taxi has no GST.

**Issues:**
- **Stripe fee calculated on gross fare only**: `stripeFeeCents = Math.round(grossFareCents * STRIPE_RATE + STRIPE_FIXED_CENTS)` — but the actual Stripe charge is `riderTotalCents` (which includes service fee, surcharge, tax). The platform is underestimating Stripe fees and overpaying drivers.
- **No idempotency**: If `capture-payment` is called twice (e.g., network retry), it could double-capture or error ungracefully.
- **Overage flow creates a new payment intent** but there's no UI flow for the rider to pay the overage — it stays as `outstanding_amount_cents` with no collection mechanism.

**Recommendations:**
- Fix Stripe fee calculation to use `riderTotalCents` as the base
- Add idempotency keys to Stripe API calls
- Build a rider-facing overage payment flow or auto-charge with a saved payment method

---

## 10. ADMIN DASHBOARD

**Capabilities:** User management, ride detail, verifications, pricing config, zones, corporate, bookings, simulator, notification logs, reports.

**Gaps:**
- No real-time ride monitoring dashboard (no live map of all active rides)
- No ability to force-cancel or reassign a ride from admin
- No system health view (edge function errors, notification delivery rates)
- Revenue reporting uses `get_total_revenue()` RPC which does a full table scan of all completed rides

---

## 11. EDGE CASES

| Scenario | Handling | Status |
|---|---|---|
| No drivers available | Returns "no_drivers_available" toast | OK |
| Driver cancels after accept | No mechanism exists | MISSING |
| Rider cancels during matching | Handled via overlay cancel button | OK |
| Rider cancels after accept | RLS allows cancel in requested/accepted | OK |
| Lost internet | No offline detection or reconnection | MISSING |
| App closed during ride | Ride persists in DB, resumes on reopen | PARTIAL |
| Multiple rapid booking attempts | No debounce on request button | RISK |

---

## 12. PERFORMANCE & SCALABILITY

**Bottlenecks:**
1. **No indexes on rides table** — every query is O(n). At 10K rides this will cause visible lag.
2. **Polling-heavy architecture** — driver dispatch polls every 5s, dashboard stats every 8s, driver location every 5s. With 100 drivers online, that's 60+ queries/second just for polling.
3. **match-driver blocks for 45s** — HTTP gateway timeout risk, wastes edge function compute time.
4. **Revenue RPC scans all completed rides** — will degrade as ride count grows.
5. **Unscoped Realtime** — every client receives every ride change event.

---

## 13. FINAL VERDICT

**Is this app ready for launch?** **Needs fixes** — but fixable within 1-2 weeks.

The core ride lifecycle is solid (atomic acceptance, server-side start/complete, metered pricing). The main risks are database performance (missing indexes), security (exposed Stripe data), and operational reliability (stuck rides, no stale-ride cleanup).

---

### TOP 10 CRITICAL ISSUES

1. **Add indexes to rides table** (rider_id+status, driver_id+status, status, completed_at)
2. **Fix Stripe fee calculation** — use `riderTotalCents` not `grossFareCents`
3. **Hide Stripe secrets from drivers** — restrict SELECT columns or use a view
4. **Add stale ride cleanup** — scheduled function to timeout stuck rides
5. **Add driver-cancel flow** — allow drivers to cancel after accepting with rider notification
6. **Scope Realtime subscriptions** — filter by ride ID to prevent broadcast storms
7. **Add indexes to profiles table** (role+is_available for matching)
8. **Add debounce to ride request button** — prevent duplicate bookings
9. **Add offline/reconnection detection** — show banner when connection is lost
10. **Fix overage payment collection** — riders with outstanding amounts have no way to pay

### PRIORITIZED ROADMAP

**Must fix now (before launch):**
- Database indexes (#1, #7)
- Stripe fee calculation fix (#2)
- Hide Stripe secrets from drivers (#3)
- Stale ride cleanup cron (#4)
- Request button debounce (#8)

**Fix within first week post-launch:**
- Driver-cancel flow (#5)
- Scoped Realtime subscriptions (#6)
- Overage payment flow (#10)
- Offline detection (#9)
- Notification deduplication

**Nice to have:**
- Async driver matching (replace blocking edge function)
- Admin live ride map
- Road-distance-based driver ranking
- Remove dead food delivery schema
- Light-mode CSS tokens

