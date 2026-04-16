

## Goal
Enforce a strong password during email signup with clear, real-time guidance so users know exactly what's required before they submit.

## Current state
- `src/pages/Login.tsx` signup uses `<Input minLength={6} />` and calls `supabase.auth.signUp` directly.
- No strength meter, no rule checklist, no breach check.
- Lovable Cloud has a built-in HIBP (Have I Been Pwned) leaked-password check that can be toggled on server-side — independent of any client UI.

## Two layers to add

### 1. Client-side: strong-password UX in signup form (`src/pages/Login.tsx`)
Only shown when `!isLogin` (signup mode). Login flow is untouched so existing users with shorter passwords can still sign in.

**Rules enforced (all required):**
- At least 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one symbol

**UI when password field is focused or non-empty during signup:**
- Inline checklist below the password input — each rule shows a green check when met, muted dot when not.
- A 4-segment strength bar (Weak / Fair / Good / Strong) colored red → orange → yellow → green.
- Submit button stays disabled until all rules pass (in addition to the existing terms-agreement gate).
- Validate again in `handleEmailSubmit` before calling `supabase.auth.signUp` — show a toast if somehow bypassed.

**i18n:** add keys under `auth.password*` to both `en.json` and `fr.json`:
- `auth.passwordRequirements`, `auth.passwordMinLength`, `auth.passwordUppercase`, `auth.passwordLowercase`, `auth.passwordNumber`, `auth.passwordSymbol`, `auth.passwordStrengthWeak/Fair/Good/Strong`.

### 2. Server-side: enable leaked-password protection (HIBP)
Use `configure_auth` to set `password_hibp_enabled: true`. Supabase will then reject any signup or password change where the password appears in the HIBP breach database, returning a clear error that we surface via the existing `toast.error(error.message)` path.

This is the real defense — client rules can be bypassed; HIBP cannot.

## Files to modify
- `src/pages/Login.tsx` — add `passwordChecks` derived state, checklist + strength bar UI, gate submit, re-validate in handler.
- `src/i18n/en.json`, `src/i18n/fr.json` — add password-rule strings.
- Supabase auth config — enable HIBP via `configure_auth`.

## Out of scope
- Forcing existing users to rotate weak passwords on next login.
- Custom password reset flow changes (the same HIBP check will automatically apply to password resets too).

