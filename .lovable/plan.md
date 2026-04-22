

## Driver Application Email Notifications

**Short answer to your question:** No — right now you do **not** receive an email when a driver applies. Only the **business/corporate** application sends an email to `contact@pickyou.ca`. Drivers just submit their documents and an in-app admin notification is created (no email).

Here's what I'll add so you get email alerts the same way you do for business applications.

### What you'll get

1. **Email to admin (you, at `contact@pickyou.ca`)** when a driver finishes their onboarding submission, with:
   - Driver name, email, phone
   - Vehicle (year, make, model, color, plate, type)
   - Number of documents uploaded
   - Submitted timestamp
   - One-click link to `/admin/verifications` to review

2. **Confirmation email to the driver** acknowledging their application is received and under review (sets expectation: 1–3 business days, what happens next).

### How it will work

- Two new React Email templates in `supabase/functions/_shared/transactional-email-templates/`:
  - `driver-application-notification.tsx` → sent to admin
  - `driver-application-confirmation.tsx` → sent to applicant
- Both registered in `registry.ts`.
- Triggered from `src/pages/DriverOnboarding.tsx` inside `handleSubmit()` — fired exactly once when the driver hits "Submit application", using an `idempotencyKey` of `driver-app-${profile.id}-${timestamp-bucket}` so retries never duplicate.
- Uses the existing `send-transactional-email` Edge Function (no new function created — per platform rules).
- Branded with PickYou dark theme accent (#2F80ED on white email body, per email standards).

### Technical notes

- Email infrastructure is already provisioned (corporate-application-notification works), so no `setup_email_infra` call needed — only `deploy_edge_functions(["send-transactional-email"])` after registry update.
- Admin recipient is hardcoded to `contact@pickyou.ca` (matching the existing corporate flow). If you'd like a different address or multiple recipients later, that's a one-line change.
- Both emails are strictly transactional (1:1, triggered by the applicant's own action) — fully compliant with the platform's email policy.

### Files to be created / edited

- **Create:** `supabase/functions/_shared/transactional-email-templates/driver-application-notification.tsx`
- **Create:** `supabase/functions/_shared/transactional-email-templates/driver-application-confirmation.tsx`
- **Edit:** `supabase/functions/_shared/transactional-email-templates/registry.ts` (register both)
- **Edit:** `src/pages/DriverOnboarding.tsx` (invoke both emails inside `handleSubmit`)

