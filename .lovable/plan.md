

## Diagnosis: Your three domains ARE in sync

I just inspected all three URLs at the network level. Here's what I found:

### Server-side evidence (all three identical)

| URL | Final URL after redirects | Deployment ID | HTML hash | Size |
|---|---|---|---|---|
| `https://pickyou.lovable.app` | → `https://www.pickyou.ca/` | `d475d1bf-9c27-4c10-a07f-37fbd89f68ac` | `1334aa6c…` | 5013 B |
| `https://www.pickyou.ca` | (no redirect) | `d475d1bf-9c27-4c10-a07f-37fbd89f68ac` | `1334aa6c…` | 5013 B |
| `https://pickyou.ca` | → `https://www.pickyou.ca/` | `d475d1bf-9c27-4c10-a07f-37fbd89f68ac` | `1334aa6c…` | 5013 B |

**All three serve byte-for-byte identical HTML from the same deployment.** DNS is also correctly configured: both `pickyou.ca` and `www.pickyou.ca` point to Lovable's IP `185.158.133.1`.

### So why do they "feel" different?

The desync you're experiencing is happening **inside the browser**, not on the server. Three culprits:

1. **Stale Service Workers** — Each origin (`pickyou.lovable.app`, `www.pickyou.ca`, `pickyou.ca`) installs its **own independent Service Worker** with its **own cache**. When you visit any of them, the SW serves the *previously cached* HTML/JS, not the new deployment, until the SW updates on the next visit. That's why one URL looks "old" while another looks "new."

2. **Independent localStorage/sessionStorage** — Auth tokens, idle-timeout flags, the `pickyou.session_only` key, the watchdog recovery key — all are scoped per-origin. Sign in on `www.pickyou.ca` and you're still signed out on `pickyou.lovable.app`.

3. **`pickyou.lovable.app` and `pickyou.ca` both 301 to `www.pickyou.ca`** at the Lovable edge. So once redirected, the browser stays on `www.pickyou.ca`, but it has already registered a SW for the *original* origin (`pickyou.ca` or `pickyou.lovable.app`). That orphaned SW keeps serving stale content the next time you type the bare URL.

### What to do (no code changes needed)

The previous fix I shipped (removing `clientsClaim`, scoping the watchdog) prevents the reload loop, but it can't retroactively un-cache content in browsers that already loaded an old build. Three options, easiest first:

**A. Hard-refresh once on each URL** — DevTools → Application → Service Workers → Unregister, then Cmd/Ctrl+Shift+R. After that, all three behave identically. Do this on every device you've used.

**B. Pick ONE canonical URL and stop visiting the others** — `www.pickyou.ca` is your true primary (it's where the redirects land). Bookmark only this. Treat `pickyou.lovable.app` as a staging/internal URL and never share `pickyou.ca` with users.

**C. Have me ship a one-time "kill switch"** — A small change to `sw.js` / `vite.config.ts` that bumps the workbox cache-version string and force-unregisters any SW from the legacy origins on first load. After one publish + visit, every browser self-cleans. I can also add a tiny script that, when run on `pickyou.lovable.app` or `pickyou.ca`, clears all caches/SWs and redirects to `www.pickyou.ca`.

### Recommendation

Go with **C** (ship the kill switch) — it's the only fix that solves the problem for users who don't know to hard-refresh. It's ~15 lines across `src/main.tsx` and one cache-version bump. After publishing once, every visitor's browser self-heals on their next visit.

If you approve, I'll implement option C in default mode.

