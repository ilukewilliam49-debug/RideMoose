

## Root cause — confirmed via DB lookup

`hybronx@gmail.com` (user_id `12b3372c…`) signed in with Google **using a driver-intent link in the past**. The `handle_new_user()` trigger ran with `raw_user_meta_data.role = 'driver'`, which set:

```
role: driver
is_driver: true
is_rider: true
driver_onboarding_complete: false
```

When they later clicked **"Apply for a business account"**, three things conspired to send them to driver onboarding instead of the apply form:

### Bug 1 — Business CTA is gated behind a driver-only route
`BusinessLanding.tsx` line 83: `handleApply = () => navigate("/rider/corporate-apply")`.
That nested route is wrapped in `<ProtectedRoute allowedRoles={["rider", "driver"]}>` → forces login.

### Bug 2 — `ProtectedRoute` driver-onboarding gate fires on `/rider/*` for driver-capable users (the actual trap)
In `ProtectedRoute.tsx` the onboarding gate **only** checks `isDriverRoute`, but the user's primary `role` is `'driver'`. `resolvePostAuthRoute` therefore sends them to `/driver/onboarding` immediately after Google sign-in — **before** they ever reach `/rider/corporate-apply`. The redirect intent (`/rider/corporate-apply`) is dropped because login does not preserve a `returnTo`.

### Bug 3 — `DriverOnboardingPending` crashes with `RangeError: Invalid time value`
Because the user has zero `verifications` rows, `earliestSubmission` calls `Math.min(...[])` → `Infinity` → `new Date(Infinity).toISOString()` throws. ErrorBoundary catches it → "Something went wrong." Visible in the console logs you shared. They likely got bounced into `/driver/onboarding/pending` (current route confirms this), then crashed.

### Bug 4 — No public/unauthenticated path to apply
The application form requires auth and is mounted under `/rider/*`. A first-time business owner has no way to apply without first being routed through driver/rider gates.

---

## Fix plan

**A. Fix the crash (`DriverOnboardingPending.tsx`)**
Guard `earliestSubmission` against empty arrays:
```ts
if (!verifications?.length) return null;
const times = verifications.map(v => new Date(v.created_at).getTime()).filter(Number.isFinite);
return times.length ? new Date(Math.min(...times)).toISOString() : null;
```

**B. Make business apply reachable for anyone**
Move the apply page out of `/rider/*` to a top-level `/business/apply` route that is **public** (renders the form if logged in, otherwise prompts a quick sign-in/up that returns to `/business/apply`). Update `BusinessLanding` CTAs to navigate there. Keep `/rider/corporate-apply` as a redirect alias for backwards compatibility.

**C. Preserve return path on login**
Add `?returnTo=` support in `Login` + `AuthCallback` so a logged-out user clicking "Apply" lands back on the apply form after Google OAuth instead of being thrown into driver onboarding.

**D. Don't force `/driver/onboarding` when the user is heading somewhere else**
In `Index.tsx` and `AuthCallback.tsx`, if a `returnTo` is present and points to a non-driver route, honour it ahead of the driver-onboarding redirect for users whose primary `role='driver'` but who are dual-capable.

**E. Optional cleanup for hybronx specifically**
Since this account never started driver onboarding (zero verifications, no vehicle info) but their primary `role` got set to `driver` by the original Google intent, downgrade them to `role='rider'`, keep `is_driver=true` so they can opt in later. This is a one-row admin update, not a migration.

---

## Files to change

- `src/pages/DriverOnboardingPending.tsx` — guard empty array in `earliestSubmission`
- `src/pages/BusinessLanding.tsx` — point CTA to `/business/apply`
- `src/App.tsx` — add public `/business/apply` route, redirect `/rider/corporate-apply` to it
- `src/pages/CorporateApply.tsx` — render sign-in prompt when `!user` instead of relying on `ProtectedRoute`
- `src/pages/Login.tsx` + `src/pages/AuthCallback.tsx` + `src/lib/post-auth-route.ts` — honour `returnTo` query param
- One-off DB update for `hybronx@gmail.com`: `UPDATE profiles SET role='rider' WHERE user_id='12b3372c-902d-4d0e-8b74-aef268d6dc1c'`

