

## Why `pickyou.ca` always lands on `/driver/onboarding`

This is **not a domain/DNS issue** — it's the **driver onboarding gate** in `ProtectedRoute.tsx` doing exactly what it's designed to do, and your browser is signed in as a driver account that hasn't completed verification.

### The exact chain of events

1. You type `pickyou.ca` → `main.tsx` (line 26-33) redirects to `www.pickyou.ca/` (canonical host).
2. `Index.tsx` mounts at `/`, sees you're signed in, reads `profile.role === "driver"`, and navigates to `/driver`.
3. `/driver` is wrapped in `ProtectedRoute` (App.tsx line 140). The gate (ProtectedRoute.tsx lines 56-72) runs:
   - Checks `profile.vehicle_type` is set
   - Checks all three required documents exist: `drivers_license`, `vehicle_insurance`, `vehicle_registration`
   - Checks all three are `status = "approved"`
4. If **any** of those fail → `<Navigate to="/driver/onboarding" replace />`.

So one of these is true for the driver account signed into that browser:
- `profiles.vehicle_type` is `NULL`, OR
- One of the three required `verifications` rows is missing, OR
- One of them is still `pending` / `rejected` (not `approved`)

### Why it feels "permanent"

Once redirected, the URL is `/driver/onboarding`. Even if you close the tab and re-type `pickyou.ca`, the same auto-navigation chain runs every time. The behaviour is deterministic — it will keep happening until either:
- The driver completes vehicle info + uploads all 3 docs + admin approves them, OR
- You sign out (then `pickyou.ca` shows the public landing page), OR
- You switch accounts to a non-driver

### How to confirm and fix

Two quick diagnostics — pick one:

**Option A — verify it's a session issue**: Open `pickyou.ca` in an incognito window. If the landing page shows (no redirect to onboarding), it 100% confirms the driver session is the trigger.

**Option B — let me query your DB** to show exactly which check is failing for the signed-in driver (missing vehicle_type vs. missing/unapproved docs). I'll need the driver's email or user_id.

### What I'd change (if you want)

Nothing in code is broken — the gate is intentional and correct (drivers shouldn't reach the dispatch screen unverified). But if the UX feels jarring, I can:
1. Add a clearer banner on `/driver/onboarding` showing **exactly what's missing** ("Vehicle info: ✓, Driver's License: ✗ pending upload, Insurance: ✓, Registration: ✗ awaiting admin approval").
2. Allow drivers stuck in onboarding to switch to **rider mode** with one tap (so `pickyou.ca` lands on the rider home instead of the onboarding wall).

Which would you like — diagnose the specific account, improve the onboarding-gate UX, or both?

<lov-actions>
<lov-suggestion message="Query the database to show exactly which onboarding requirement is failing for my driver account, so we know what's blocking progress.">Diagnose my driver account</lov-suggestion>
<lov-suggestion message="Improve the driver onboarding gate: show a clear checklist on /driver/onboarding of exactly what's missing (vehicle info, each document, approval status) instead of a generic page.">Add onboarding checklist</lov-suggestion>
<lov-suggestion message="Let drivers who are stuck in onboarding switch to rider mode with one tap, so pickyou.ca lands on the rider home instead of the onboarding wall.">Allow rider-mode fallback</lov-suggestion>
<lov-suggestion message="Test the driver onboarding gate end-to-end in an incognito window to confirm the redirect logic works as expected.">Verify in incognito</lov-suggestion>
</lov-actions>
