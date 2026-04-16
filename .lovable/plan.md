
The user signed up as a rider with email "hybronx..." and now wants to use the SAME email to also act as a driver. Currently when they click "Drive" / sign in with that email, they get routed back to `/rider`.

Let me check the relevant code paths.

**Current architecture (from context):**
- One account = one `profile.role` (rider | driver | admin)
- `Index.tsx` redirects based on `profile.role`
- `AuthCallback.tsx` upgrades rider → driver if `?role=driver` is present in URL (Google OAuth flow only)
- `useAuth.ts` does the same upgrade on `SIGNED_IN` event when `?role=driver` is in URL
- `RoleSwitcher` exists for users whose `dbRole === "driver"` (lets them toggle between viewing as rider vs driver)
- `ActiveRoleContext` — `canSwitch = dbRole === "driver"`

**Why the user is stuck:**
Their profile row has `role = 'rider'`. Login with email/password does NOT carry the `?role=driver` URL param through the same upgrade path that Google OAuth does — and even when it does, the upgrade only runs on the `SIGNED_IN` event listener in `useAuth.ts`. Let me verify the email/password login flow.
