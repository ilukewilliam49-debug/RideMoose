

# Launch Readiness Audit - April 8, 2026

## Status: 4 issues remaining (2 critical, 2 moderate)

---

## Previously Fixed (confirmed resolved)
- Dead Auth.tsx file removed
- Global ErrorBoundary added
- password_reset_attempts RLS locked down (SELECT = false)
- proof-photos uploads scoped to user folders
- Realtime channel authorization function added
- RiderDashboard decomposed into smaller components
- Terms of Service and Privacy Policy pages added with SEO meta tags

---

## Remaining Issues

### 1. CRITICAL — Private storage buckets still have public read policies
The `chat-images` and `voice-messages` buckets were made private, but overly broad SELECT policies (`Anyone can read voice messages`, `Anyone can read chat images`) still exist on `storage.objects`. Because RLS policies are permissive (OR logic), these override the ownership-scoped policies and let **unauthenticated users read every file**.

**Fix:** Drop the two broad public SELECT policies, keeping only the user-scoped and admin policies.

### 2. CRITICAL — Drivers can overwrite financial fields on any requested ride
The `Drivers can accept requested rides` UPDATE policy has no `WITH CHECK` clause. Any driver can set `final_fare_cents`, `payment_status`, `driver_earnings_cents`, etc. on any ride with status `requested`.

**Fix:** Add a `WITH CHECK` that restricts drivers to only setting `driver_id = their profile id` and `status = 'accepted'` when accepting rides. Alternatively, tighten the policy to only allow updating `driver_id` and `status` columns.

### 3. MODERATE — Riders can manipulate delivery bid amounts and status
The `Riders can update bids on own rides` policy has no `WITH CHECK`. A rider could set `offer_amount_cents` to 0 or change status arbitrarily.

**Fix:** Add a `WITH CHECK` restricting riders to only changing `status` to `accepted` or `rejected`.

### 4. MODERATE — Leaked password protection (HIBP) is disabled
Supabase's built-in check against known breached passwords is turned off.

**Fix:** Enable via Cloud > Users > Auth Settings > Email > Password HIBP Check.

---

## Implementation Plan

### Step 1: Database migration
A single SQL migration to:
- Drop the two overly broad storage SELECT policies for `chat-images` and `voice-messages`
- Drop and recreate the `Drivers can accept requested rides` policy with a proper `WITH CHECK` clause restricting column changes to `driver_id` and `status`
- Drop and recreate the `Riders can update bids on own rides` policy with a `WITH CHECK` restricting to `status IN ('accepted', 'rejected')`

### Step 2: Enable HIBP leaked password protection
Configure via the auth settings tool to enable the password HIBP check.

### Step 3: Mark security findings as fixed
Update the security scan results to reflect the resolved issues.

---

## Summary
No frontend code changes needed. This is purely a backend security hardening pass consisting of one database migration and one auth configuration change. After these 4 fixes, the platform has no outstanding critical or moderate security findings.

