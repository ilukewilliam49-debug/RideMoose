

# Google Sign-In on pickyou.ca — Clarification & Plan

## Important Context

This project is **not deployed on Netlify** — it runs on **Lovable hosting** (published at `pickyou.lovable.app` with `pickyou.ca` as a custom domain). This changes the approach significantly:

1. **`public/_redirects` has no effect** — Lovable hosting has built-in SPA fallback. The existing `_redirects` file is inert and can be deleted.

2. **No `/auth/callback` route is needed** — The project uses **Lovable Cloud managed OAuth** (`lovable.auth.signInWithOAuth`), which handles the entire OAuth token exchange automatically via Lovable's proxy at `/~oauth/`. Custom domains are fully supported by this system.

3. **Google sign-in should already work on pickyou.ca** — The managed OAuth infrastructure handles custom domains automatically. The current `redirect_uri: window.location.origin` resolves correctly to `https://pickyou.ca`.

## What I'll Actually Do

Since the architecture doesn't need the changes you described, here's what will genuinely help:

### 1. Delete `public/_redirects`
It's a Netlify artifact with no effect on Lovable hosting. Removing it avoids confusion.

### 2. Verify Google OAuth works on pickyou.ca
Navigate to `https://pickyou.ca/login` and test the Google sign-in button to confirm the managed OAuth flow completes successfully on the custom domain.

### 3. If OAuth fails — diagnose and fix
If the flow does fail, the most likely causes are:
- Custom domain DNS misconfiguration (preventing `/~oauth` proxy interception)
- A service worker caching `/~oauth` routes (the existing `sw.js` would need a denylist entry)

I'll check `public/sw.js` for any problematic caching of OAuth paths and add `/~oauth` to the denylist if needed.

### 4. Improve post-OAuth role routing
The current flow redirects to `/` after OAuth, then the Login page's `useEffect` redirects to the role-based route. This works but adds a visible hop. I can make the redirect smoother if desired.

## Technical Details

- **OAuth flow**: `lovable.auth.signInWithOAuth("google")` → Lovable proxy at `/~oauth/initiate` → Google → `/~oauth/callback` → token exchange → redirect to `redirect_uri` with session set
- **No server-side callback route needed** — tokens are exchanged by the proxy, not by app code
- **Custom domain OAuth** is explicitly supported per Lovable Cloud docs

