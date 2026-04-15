

# Driver-to-Rider Role Switching

## What this does
Adds a "Switch to Rider" button on the driver's account page (and sidebar/bottom tab) so drivers can temporarily view the app as a rider — book rides, view rider dashboard, etc. — and switch back to driver mode when needed.

## Approach

Rather than changing the database role permanently, we add a **client-side "active role" toggle** stored in React state (context). The driver's profile keeps `role = 'driver'` in the database, but the UI renders the rider experience when switched. The `ProtectedRoute` component will check the active role instead of only the DB role, and the allowed roles for rider routes will include `'driver'` (since drivers are also valid riders).

This is the same pattern used by Uber/Lyft where drivers can seamlessly switch between driving and riding.

## Steps

1. **Update ProtectedRoute to allow drivers on rider routes** — Add `'driver'` to the `allowedRoles` for rider routes in `App.tsx`, or use an "active role" context to override the navigation role.

2. **Create an ActiveRoleContext** — A lightweight React context (`src/contexts/ActiveRoleContext.tsx`) that stores the user's current "view" (`driver` or `rider`), persisted in `localStorage`. Only drivers can switch; riders and admins stay fixed.

3. **Add "Switch to Rider" button on DriverAccount page** — A prominent button/card in the driver account page that navigates to `/rider` and sets active role to `rider`.

4. **Add "Switch to Driver" option on rider view** — When a driver is viewing as rider, show a banner or button (on RiderAccount or the sidebar) to switch back to driver mode.

5. **Update routing logic** — Modify `ProtectedRoute` and the role-based redirect logic to use the active role from context instead of `profile.role` directly, so drivers viewing as riders aren't bounced back to `/driver`.

6. **Update sidebar and bottom tab bar** — Show navigation items matching the active role, and include the role-switch option in both the sidebar and bottom tab bar.

## Technical details

- **ActiveRoleContext**: wraps `AppContent`, provides `activeRole`, `setActiveRole`, and `canSwitch` (true only for drivers).
- **ProtectedRoute change**: uses `activeRole` from context instead of `profile?.role` for routing decisions. The driver onboarding gate only applies when `activeRole === 'driver'`.
- **localStorage key**: `pickyou-active-role` — cleared on sign-out.
- **RLS unaffected**: database queries use `auth.uid()` which remains the same user regardless of UI role. Rider routes that insert rides use `rider_id` from profiles, which works for driver profiles too since `rides.rider_id` just references `profiles.id`.
- **Ride booking consideration**: drivers booking as riders will use their driver profile ID as `rider_id`. The `prevent_duplicate_active_rides` trigger checks `rider_id`, so a driver can't have an active ride as both driver and rider simultaneously — which is correct behavior.

