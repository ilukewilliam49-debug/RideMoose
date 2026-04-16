
The user wants to add Apple Sign In to the login flow. Looking at the existing code:

- `src/integrations/lovable/index.ts` already exposes `lovable.auth.signInWithOAuth("google" | "apple" | "microsoft", ...)` — Apple support is built into the Lovable Cloud auth wrapper.
- Google OAuth is presumably already wired into `Login.tsx` (and `AuthCallback.tsx` handles role-based redirect).
- Lovable Cloud supports Apple Sign In with a managed default — no Apple Developer account / credentials required to start. BYOC (custom Apple credentials) is optional later for branding.

## Plan

### 1. Add "Continue with Apple" button to Login page
In `src/pages/Login.tsx`:
- Add an Apple sign-in button styled to match the existing Google button (black background, white Apple logo, "Continue with Apple" label).
- Place it directly under the Google button in both Sign In and Sign Up tabs.
- Preserve the `?role=driver` URL param so Apple sign-ins from the Driver landing flow get auto-promoted to driver role (handled in `useAuth.ts`).

### 2. Wire up the handler
```ts
const handleAppleSignIn = async () => {
  const params = new URLSearchParams(window.location.search);
  const role = params.get("role");
  const redirect = `${window.location.origin}/auth/callback${role ? `?role=${role}` : ""}`;
  
  const result = await lovable.auth.signInWithOAuth("apple", { redirect_uri: redirect });
  if (result.error) toast.error("Apple sign-in failed");
  // result.redirected → browser navigates to Apple
};
```

### 3. Confirm callback handling
`src/pages/AuthCallback.tsx` already handles any OAuth provider generically (reads session, fetches profile, routes by role) — no changes needed.

### 4. Apple credentials decision
Lovable Cloud's **managed Apple Auth** is the default and works with zero setup. We'll ship that. If the user later wants their own Apple Developer credentials (custom branding showing "PickYou" instead of "Lovable" on Apple's sheet), they can configure BYOC in the Lovable Cloud dashboard — out of scope for this change.

### Files to modify
- `src/pages/Login.tsx` — add Apple button + handler

### Out of scope
- BYOC Apple credentials setup (mention as a follow-up only if user asks for custom branding)
- Apple-specific scopes (defaults are fine: name + email on first sign-in)
