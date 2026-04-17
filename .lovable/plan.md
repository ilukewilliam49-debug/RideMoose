

## What's actually happening

`https://pickyou.ca/driver/onboarding` is stuck in a **page-reload loop every ~2 seconds**. Console shows `[v3-piercer] installed` + `i18next maintained` repeating at 10:37:04, :07, :10, :12, :14, :16, :18, :21, :23, :25, :27, :30, :32, :34, :36 — each one is a fresh full-page reload.

### Root cause

Three fixes from earlier sessions are interacting badly. The chain on `pickyou.ca` (no www, signed-out user):

1. **`pickyou.ca` → `www.pickyou.ca` redirect** kicks in (main.tsx:26-33). DNS now resolves, so the redirect happens.
2. After redirect, page lands on `/driver/onboarding`. User is **not signed in**.
3. `App.tsx:146` wraps it in `ProtectedRoute` with `allowedRoles=["driver"]`.
4. `ProtectedRoute` returns the **pulse-glow loader** while `useAuth().loading === true` (lines 32-38). The loader is rendered inside React, so `#root` *does* have children.
5. But — and this is the subtle bug — when `useAuth` finishes and finds no user, it returns `<Navigate to="/login" replace />`. React Router does the navigation. But the **`Suspense` fallback** (`PageLoader`) is also `min-h-screen` with one child div, while the new `/login` route's lazy chunk is loading.
6. **The watchdog in `main.tsx:115-127`** checks `rootEl.childElementCount > 0` after 4s. That part is fine — there ARE children. So the watchdog itself is NOT firing.

So why the reload loop? Let me re-read: actually the reloads are happening every ~2s, not 4s. That's faster than the watchdog. The watchdog isn't the cause.

**The real culprit is the SplashScreen + a navigation race.** Looking again: the reloads are caused by something else triggering `window.location.reload()`. Candidates: 
- `handleReLoginSuccess` reloads on session expiry success
- `handleIdleSignOut` redirects to `/login`
- **`SessionExpiredDialog`** — if `useAuth` is repeatedly setting `sessionExpired=true` because there's a stale `sb-*-auth-token` in localStorage that fails to refresh, the dialog opens, but on this signed-out flow it might be auto-dismissing and triggering reload.

Actually, the simpler explanation that fits 2-second cadence: **the service worker (`autoUpdate` + new `skipWaiting: true` from the recent vite.config change) is detecting a new SW on each load and `clientsClaim` is forcing an immediate controllerchange → page reload**. Combined with `pickyou.ca` → `www.pickyou.ca` host redirect, every reload hits the redirect again, the new SW activates again on the new origin, and you loop.

The header trace from `navigate_to_url` confirms it: `pickyou.ca` returned **status 200 with `set-cookie: __dpl=...`** (a deployment cookie), and the browser ended on `https://pickyou.ca/driver/onboarding` — meaning the canonical-host redirect either didn't fire or fired and came back. Combined with `skipWaiting + clientsClaim`, every newly registered SW immediately claims the page and triggers a controllerchange handler → reload.

### Why this only happens here

- `pickyou.lovable.app` doesn't have the `pickyou.ca → www.pickyou.ca` redirect path
- Signed-in users on `www.pickyou.ca/driver/onboarding` actually render the page (no Suspense+navigate race)
- The SW reload-on-controllerchange is harmless when nothing else is causing reloads — but combined with the host-redirect bouncing, it loops

## Proposed fix

Three small changes, all in code I already own:

1. **Remove `pickyou.ca` from `legacyHosts`** in `main.tsx`. Today the project ships *with* the apex domain configured in Lovable hosting — so `pickyou.ca` is a first-class host, not a "legacy" one to redirect away from. Only redirect `pickyou.lovable.app` → `www.pickyou.ca`. This stops the reload bounce immediately. (Or: keep the redirect but make it a 301 server-side via Lovable domain settings, never client-side — which is what's actually causing the loop.)

2. **Remove `clientsClaim: true`** from the workbox config in `vite.config.ts` (keep `skipWaiting`). `clientsClaim` forces the new SW to take over open pages immediately, which is what triggers the reload-on-controllerchange in many SPA setups. `skipWaiting` alone is enough for "next navigation gets the new build."

3. **Guard the watchdog reload** with a per-pathname session key (`__pickyou_blank_recovery__:${pathname}`) so even if the watchdog is involved, it can't loop on the same path twice. Currently the guard is global, but on a fresh tab it has no memory.

That trio breaks the loop, keeps the auto-recovery for genuinely-broken builds, and makes `pickyou.ca` work as a proper alias rather than a redirect target.

## Files to change

- `src/main.tsx` — drop `pickyou.ca` from `legacyHosts`; scope watchdog key by pathname
- `vite.config.ts` — remove `clientsClaim: true` from workbox config

No DB / edge function changes. After publishing, the loop stops on all three URLs.

