
The user is asking why a page refresh feels slower than expected. Let me think through the current bootstrap sequence.

Looking at `src/main.tsx`, the boot sequence runs **sequentially** before React even starts mounting:

1. `runKillSwitchOnce()` — reads localStorage, may unregister SWs + clear caches
2. `redirectToCanonicalHost()` — checks hostname, awaits SW unregister + cache clear on legacy hosts
3. `normalizePathname()` — synchronous
4. If preview/iframe → `await unregisterServiceWorkers()` — **runs on every preview reload**
5. `shouldRecoverOAuthRoute()` — only on /~oauth/ paths
6. `installSessionOnlyTokenWipe()` — adds listener
7. `createRoot().render(<App />)` — finally mounts React

Plus a 4s blank-screen watchdog timer.

### Root causes of slow refresh

1. **Service Worker unregister on every preview reload** (step 4): `await unregisterServiceWorkers()` blocks React mount on the preview/iframe host. This is a network/IO call that delays first paint by hundreds of ms every single refresh.

2. **Sequential awaits**: kill-switch check → host redirect → SW unregister all run one after another even though they're independent on a normal load.

3. **Pre-mount loader animation**: works fine, but the *real* delay is the JS bundle download + parse + the awaits above. The loader masks it but doesn't fix it.

4. **Vite dev mode in preview**: in the Lovable preview/iframe, modules are fetched on-demand (waterfall). This is unavoidable in dev but feels slower than prod. Production build (pickyou.ca) won't have this.

### Plan: speed up the bootstrap

**File: `src/main.tsx`**

1. **Skip SW unregister when there's nothing to unregister.** Guard with `navigator.serviceWorker?.getRegistrations()` early-return: if zero registrations, skip the await entirely. This makes every reload after the first essentially free.

2. **Move the preview-host SW unregister off the critical path.** Don't `await` it before mounting React — fire it in the background after `createRoot().render()`. The SW can't affect the already-loaded page, so unregistering it after mount is safe.

3. **Mount React first, run side-effects after.** Reorder `bootstrap()`:
   - Run kill-switch check (must stay first — it may reload)
   - Run host redirect check (must stay — may navigate away)
   - `normalizePathname()` (sync, cheap)
   - `installSessionOnlyTokenWipe()` (sync, cheap)
   - **Mount React immediately**
   - Then asynchronously: SW unregister on preview, watchdog setup

4. **Tighten the blank-screen watchdog**: 4s is reasonable, keep as-is.

### Expected result
On a normal refresh of the preview/canonical host with no stale SW, React mounts as soon as the JS bundle is parsed — no extra awaits in front. The pulsing loader stays visible only for the genuine bundle-download time, not artificial blocking.

### Files to edit
- `src/main.tsx` — reorder bootstrap, move SW unregister off the critical path, early-return when no SWs to unregister.

No other files need changes.
