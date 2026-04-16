

# Fix Offline Page & Logo

## Problem
1. **pickyou.ca/login shows the offline page** even when you're connected to Wi-Fi. The `public/offline.html` is a static fallback page that Netlify may be serving from cache. Since your app is an SPA and all routes should go to `index.html`, this file shouldn't exist — it can interfere with Netlify's routing.

2. **The offline page logo is plain text** ("PickYou") instead of the actual logo image used throughout the app.

## Solution

### 1. Delete `public/offline.html`
This file is not referenced by the service worker or any app code. Netlify may be caching and serving it as a fallback for routes it can't resolve, causing the false offline screen. Removing it ensures all routes go through `index.html` → React Router as intended.

### 2. Update `public/_redirects`
Ensure the Netlify redirects file properly catches all routes and sends them to `index.html` with a 200 status, preventing any stale offline page from being served.

### 3. Keep in-app offline handling as-is
The app already has proper offline detection via `NetworkErrorBanner`, `OfflineBanner`, and `OfflineIndicator` components that show contextual messages when the browser detects no internet — these are the correct way to handle offline state in a React SPA.

## Technical details
- Delete: `public/offline.html`
- Verify: `public/_redirects` contains `/* /index.html 200`
- No other code changes needed — the in-app offline components already use the correct logo via `src/assets/logo.png`

