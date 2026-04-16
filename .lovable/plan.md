

# Fix Netlify SPA Routing + Google OAuth

## Problem
`pickyou.ca` is deployed on Netlify, but there's no SPA rewrite rule. Every route except `/` returns Netlify's built-in 404. This breaks:
- The login page (`/login`)
- The OAuth callback (`/auth/callback`)
- Every other client-side route

## Changes

### 1. Create `public/_redirects`
Add a single Netlify rewrite rule so all routes serve `index.html`:

```
/*    /index.html   200
```

This file goes in `public/` so Vite copies it to the build output root.

### 2. Publish
After adding the file, publish to apply changes on `pickyou.ca`.

## Technical Details
- Netlify uses `_redirects` (or `netlify.toml`) for routing rules
- The `200` status code means "rewrite" (serve index.html but keep the URL), not a redirect
- This is the standard pattern for all SPAs on Netlify
- Once this works, the Google OAuth flow (`/auth/callback`) will also work since the page will actually load

