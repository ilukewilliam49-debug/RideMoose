
What I found

- Google auth is already wired to Lovable Cloud managed OAuth in `src/pages/Login.tsx`, so this is no longer the old callback-URL mismatch problem.
- The PWA config is already doing the right thing for OAuth: `/~oauth/*` is excluded from service-worker navigation fallback in `vite.config.ts`, and `src/main.tsx` already clears stale service workers/caches on OAuth proxy routes.
- The router does not define `/index`; `src/App.tsx` only defines `/`. If auth ever returns to `/index`, the app will show the `NotFound` page.
- Current project settings show `https://pickyou.lovable.app` as the published URL and no active custom domain, while `index.html` still points metadata at `https://pickyou.ca`. If you are testing from an old/inactive domain, that can still 404 outside the app.

Implementation plan

1. Harden return-path routing
- Add a safe redirect from `/index` to `/`.
- Add an early path normalizer in `src/main.tsx` so common stray return paths are corrected before React Router mounts.

2. Stabilize the Google auth landing flow
- Keep Lovable Cloud OAuth.
- Route the post-auth landing through one predictable in-app path (`/auth/callback`) if it works cleanly with the managed flow in this project; otherwise keep the current origin redirect and rely on the new path normalizer.
- Keep `src/pages/AuthCallback.tsx` focused on “hydrate session -> load profile -> send user to /admin, /driver, or /rider”.

3. Clean up stale domain references
- Update `index.html` canonical/Open Graph/Twitter URLs so they match the real live domain.
- If you want `pickyou.ca`, reconnect/activate that custom domain in Lovable first; code changes alone will not fix OAuth 404s on an inactive domain.

4. Verify end to end
- Test Google sign-up on the active published URL.
- Test both new-user sign-up and returning-user sign-in.
- Test mobile/PWA behavior to confirm no service worker regression.
- Confirm the user lands on the correct role-based dashboard after auth.

Technical details

Files likely involved:
- `src/App.tsx`
- `src/main.tsx`
- `src/pages/Login.tsx`
- `src/pages/AuthCallback.tsx`
- `index.html`

No database or backend schema changes should be needed.

Most likely root cause:
- either the auth flow is landing on `/index` (which the app does not handle), or
- sign-in is being started from an old domain (`pickyou.ca`) that is not currently active in project settings.
