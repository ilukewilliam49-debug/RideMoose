

# Set Up Your Own Google OAuth Credentials

## What You Need to Do (in Google Cloud Console)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Credentials**
2. On the **OAuth consent screen**, add your domains (`pickyou.ca`, `*.lovable.app`) under Authorized domains
3. Configure scopes: `openid`, `email`, `profile`
4. Create an **OAuth Client ID** (Web application type)
5. Set **Authorized JavaScript origins**:
   - `https://pickyou.ca`
   - `https://www.pickyou.ca`
   - `https://pickyou.lovable.app`
6. Set **Authorized redirect URI** to the Supabase callback URL:
   - `https://qmkcgwgiqrmtqrxmxeam.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**

## What I'll Do in the App

### 1. Configure Google credentials in Lovable Cloud
Use the Cloud auth settings tool to switch Google OAuth from "Managed by Lovable" to your own Client ID and Secret. You'll be prompted to enter these values.

### 2. Keep the current direct Supabase OAuth code
The current code already uses `supabase.auth.signInWithOAuth()` which is correct for BYOK (Bring Your Own Keys) Google credentials — this bypasses Lovable's managed proxy and talks directly to Supabase, which is what we want.

### 3. Verify the `/auth/callback` route
The existing `AuthCallback` page and route are already set up to handle the OAuth return, read the session, and redirect to the correct dashboard.

### 4. Ensure redirect URL works
The current `redirectTo: window.location.origin + "/auth/callback"` will resolve to `https://pickyou.ca/auth/callback` in production and `http://localhost:5173/auth/callback` in dev — both need to be in Supabase's allowed redirect URLs.

## Summary of Changes
- Configure your Google Client ID + Secret in Lovable Cloud auth settings
- No code changes needed — the current implementation already supports BYOK credentials

