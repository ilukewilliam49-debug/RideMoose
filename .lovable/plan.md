

# Fix Google OAuth — Use Managed Lovable Cloud Auth

## Problem
The Login page calls `supabase.auth.signInWithOAuth()` directly, which requires the Lovable Cloud Supabase callback URL (`qmkcgwgiqrmtqrxmxeam.supabase.co/auth/v1/callback`) to be registered in your Google Cloud Console. You don't have access to that project.

## Solution
Switch to Lovable Cloud's managed OAuth (`lovable.auth.signInWithOAuth("google")`), which handles all redirect URIs automatically through a proxy. No Google Cloud Console configuration needed.

## Changes

### 1. Update `src/pages/Login.tsx`
- Replace `supabase.auth.signInWithOAuth({ provider: "google", ... })` with `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`
- Import `lovable` from `@/integrations/lovable/index`
- Handle the `result.redirected` and `result.error` response pattern

### 2. Update `src/pages/AuthCallback.tsx`
- The managed OAuth flow returns tokens directly (no separate callback needed in most cases), but keep the callback page as a fallback for session hydration

## What This Means
- Google sign-in will work immediately without any Google Cloud Console changes
- Your existing Google OAuth credentials in the console (for `xucepkpwqkdvtmwwmylj`) are no longer needed for this app
- Apple sign-in can also use the same managed approach if needed

