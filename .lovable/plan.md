

## Plan: Add VAPID Secrets for Push Notifications

The VAPID keys (`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`) need to be stored as backend secrets so the push notification edge functions can use them.

### Steps

1. **Add `VAPID_PUBLIC_KEY` secret** — Prompt you to paste the public key generated from [vapidkeys.com](https://vapidkeys.com) or `npx web-push generate-vapid-keys`.
2. **Add `VAPID_PRIVATE_KEY` secret** — Prompt you to paste the private key.
3. **Update edge function config** — Add `push-vapid-key` and `send-push-notification` to `supabase/config.toml` with `verify_jwt = false` so they're callable from the frontend.
4. **Verify** — Test the push-vapid-key endpoint to confirm keys are accessible.

No database changes needed — the `push_subscriptions` table and `notifications` table already exist.

