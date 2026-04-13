

# Full Platform Audit — Launch Readiness Assessment

## Overall Verdict: CONDITIONALLY READY — 4 Critical fixes required, 5 Recommended improvements

---

## ADMIN PANEL — Status: GOOD

**What's working well:**
- Dashboard with real-time stats (pending verifications, active rides, revenue, support inbox)
- User management with search, multi-filter, pagination, bulk actions, and confirmation dialogs
- Bookings panel with server-side pagination, status/service filters
- Ride detail view, pricing config, zone management, corporate management, support inbox
- Verifications workflow for driver document approval
- Mock driver simulator for testing

**Issues found:**
- **Revenue query** (AdminDashboard line 49-51): Fetches ALL completed rides to sum `final_price` client-side. With scale, this will hit the 1000-row default limit and return incorrect totals. Should use a database function or aggregate query.
- Minor: Revenue total shown in USD (`$`) — verify this matches your locale (Iceland pricing may use ISK/EUR).

---

## DRIVER FLOW — Status: GOOD

**What's working well:**
- Full onboarding flow (vehicle info → document upload → admin approval gate)
- Dashboard with live-ticking online duration, rating, acceptance rate, earnings
- Dispatch board with realtime updates, sound/vibration alerts for new requests
- Active trip management with live ETA, turn-by-turn nav, rider chat
- Shift sessions (go online/offline with summary)
- Earnings page with time-period filters, bar chart, payout requests
- Outstanding balance tracking

**Issues found:**
- None critical. The dispatch board correctly handles both broadcast and sequential matching models.

---

## RIDER FLOW — Status: GOOD

**What's working well:**
- Home screen with pickup/dropoff autocomplete, saved places, recent destinations, scheduling
- Service selector with live price estimates and ETA chips per service type
- Dedicated courier booking page
- Active ride tracking with live driver location and ETA
- Ride history with rating system
- Payment flow (in-app card auth, pay driver cash, org billing with credit limits)
- Cancel ride with confirmation
- Automated driver matching integration

**Issues found:**
- None critical from a functionality standpoint.

---

## SECURITY — Status: 4 CRITICAL ISSUES

### 1. CRITICAL: Users can escalate their own role (PRIVILEGE ESCALATION)
The `profiles` UPDATE policy allows any user to set `role = 'admin'` on their own profile. This is the most severe issue — any rider can become an admin.

**Fix:** Add a `WITH CHECK` constraint to the "Users can update own profile" policy that prevents changing `role`, `commission_rate`, `driver_balance_cents`, `promo_commission_rate`, `standard_commission_rate`.

### 2. CRITICAL: Realtime channel authorization not enforced
The `authorize_realtime_channel` function exists but isn't wired into Realtime policies on `realtime.messages`. Any authenticated user can subscribe to any channel and see ride updates, driver locations, and financial data.

**Fix:** This was identified in a previous audit but the `authorize_realtime_channel` function needs to be applied as an RLS policy on the Realtime schema (requires Supabase dashboard configuration — may need advisory note).

### 3. CRITICAL: Ride financial data exposed via Realtime
`rides` table is published to Realtime and includes `stripe_payment_intent_id`, `overage_client_secret`, and financial fields. Without Realtime RLS, these are broadcast to all subscribers.

**Fix:** Same as #2 — Realtime RLS policies needed.

### 4. CRITICAL: Driver financial data exposed via Realtime
`profiles` table is published to Realtime with `driver_balance_cents`, `commission_rate`, `latitude`, `longitude`.

**Fix:** Same as #2.

### 5. WARN: Proof photos accessible to all authenticated users
The proof-photos storage bucket has an overly permissive SELECT policy.

**Fix:** Restrict SELECT to the ride's rider, driver, and admins.

### 6. WARN: `match-driver` edge function uses `getClaims()` which may not exist
Line 70: `await userClient.auth.getClaims(token)` — the Supabase JS client doesn't have a `getClaims` method. This will throw silently and `callerUserId` will be null, meaning ownership verification is skipped.

**Fix:** Replace with `await userClient.auth.getUser()` and extract `user.id`.

---

## OTHER ITEMS

### Edge Function CORS
The `match-driver` function uses manually defined CORS headers. This is fine but should match the standard pattern used by other functions.

### i18n
English and French translation files exist. Both appear functional.

### PWA / Service Worker
`public/sw.js` exists for push notifications. Functional.

### Legal Pages
Terms of Service and Privacy Policy pages are present and linked from the landing page footer.

### Error Handling
Global `ErrorBoundary` wraps the app. Individual pages use `ErrorRetry` components for API failures.

---

## RECOMMENDED PLAN

### Must-fix before launch (4 items):

1. **Harden profiles UPDATE RLS policy** — Add WITH CHECK to prevent users from changing `role`, `commission_rate`, `driver_balance_cents`, and other admin-only fields.

2. **Fix match-driver auth validation** — Replace `getClaims()` with `getUser()` to properly validate ride ownership.

3. **Fix admin revenue query** — Use a database aggregate function instead of client-side sum to avoid the 1000-row limit.

4. **Restrict proof-photos storage SELECT policy** — Scope to ride participants and admins only.

### Recommended improvements (not blocking launch):

5. Apply Realtime authorization (this may require configuration not possible via migrations alone — advisory item).

6. Consider rate-limiting on the match-driver edge function to prevent abuse.

7. Add input validation (Zod) to the match-driver edge function.

8. Currency display — verify $ symbol matches target market.

9. Add loading state/overlay ("Finding your driver...") on the rider dashboard while match-driver runs (currently just a toast).

### Technical Details

**Migration for profile UPDATE hardening:**
```sql
DROP POLICY "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())
  AND commission_rate = (SELECT commission_rate FROM public.profiles WHERE user_id = auth.uid())
  AND driver_balance_cents = (SELECT driver_balance_cents FROM public.profiles WHERE user_id = auth.uid())
  AND standard_commission_rate = (SELECT standard_commission_rate FROM public.profiles WHERE user_id = auth.uid())
  AND promo_commission_rate = (SELECT promo_commission_rate FROM public.profiles WHERE user_id = auth.uid())
);
```

**match-driver auth fix:**
Replace `getClaims` with `getUser()` and extract `data.user.id`.

**Revenue aggregate function:**
Create a database function `get_total_revenue()` that returns `SUM(final_price)` from completed rides, callable via `supabase.rpc()`.

