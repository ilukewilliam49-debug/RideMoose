

## Why the preview is blank

**Most likely cause: stale PWA service worker / cached chunks**

Your app registers a service worker via `vite-plugin-pwa` (autoUpdate). After several recent file changes (`useDriverLocation.ts`, `ActiveTripPanel.tsx`, `types.ts` regen, the migration), the SW is likely serving a stale module graph that no longer matches the current code, so React fails silently before mounting and the screen stays blank.

Evidence:
- Dev server is healthy (`vite ready in 698ms`, no errors in log)
- TypeScript compiles cleanly
- HTML 200s and serves the correct shell
- Console logs are empty (which itself is suspicious — usually means the JS bundle never reached `console`)
- `main.tsx` already has chunk-error handling and SW unregistration logic for preview hosts, so a stale cache fully matches the symptom

**Other possibilities (less likely but worth ruling out):**
1. The `as never` cast in `useDriverLocation.ts` heartbeat (`{ updated_at: ... } as never`) — TS accepts it, but at runtime if `profiles` has no `updated_at` column it just errors silently in the `.then`, so this isn't blank-screen worthy.
2. `ErrorBoundary` may have caught a chunk error and triggered its one-shot reload — if it already used its retry token (`pickyou.chunk_reload_attempt`), a second failure would show the fallback UI, not blank. Since you see blank (not the error UI), the failure is happening *before* React mounts at all → confirms SW/cache.

## Fix (one-time, user-side)

I cannot clear your browser cache from code. You need to do this once:

1. **Open the preview in a new tab** (not the iframe) → DevTools → Application → Service Workers → **Unregister**
2. Application → Storage → **Clear site data**
3. Hard reload (Cmd/Ctrl + Shift + R)

OR, simpler:
- Open the preview URL in an **incognito window** — if it loads there, it's 100% the cached SW.

## Code-level hardening (after you confirm the cache theory)

Once the cache is confirmed as the culprit, I'd like to make the recovery automatic so this never strands you again:

1. **Bump SW behavior in `vite.config.ts`**: add `clientsClaim: true` and `skipWaiting: true` to the `workbox` config so new SW versions activate immediately instead of waiting for all tabs to close.
2. **Reset the chunk-reload guard in `ErrorBoundary.tsx`** after a successful mount (currently the sessionStorage flag is never cleared on success, so a second chunk error in the same session shows the fallback instead of auto-recovering).
3. **Add a render-detection watchdog in `main.tsx`**: if `#root` is still empty 4s after `createRoot().render()`, force-unregister SWs and hard-reload once.

That trio means: if a deploy ships and a user's tab has a stale SW, the page recovers itself instead of going blank.

## Files I would touch

- `vite.config.ts` — Workbox `clientsClaim`/`skipWaiting`
- `src/components/ErrorBoundary.tsx` — clear `pickyou.chunk_reload_attempt` after successful render
- `src/main.tsx` — add post-render watchdog for blank `#root`

Approve and I'll implement these in default mode. In the meantime, please try the preview in an incognito window to confirm the diagnosis.

