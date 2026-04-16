
The user wants riders to be able to switch between rider and driver modes (like Uber's "Switch to Driving" feature). Let me investigate the current state.

Looking at the code:
- `ActiveRoleContext` already exists and supports switching, but only when `dbRole === "driver"` (i.e., `canSwitch` is true only for users whose DB role is already "driver").
- This means a pure rider can't become a driver — they'd need to apply/onboard first. That's correct.
- For users who ARE drivers, the switch capability exists in context but I need to check if there's any UI exposing it.

Let me check `AppSidebar`, `BottomTabBar`, `DriverBottomTabBar`, and `RiderAccount` / `DriverAccount` for any role switcher UI.

Based on my read of `RoleLayout` and the bottom tab bars, there's no visible switcher. The `ActiveRoleContext` exists but nothing calls `setActiveRole`. So the infrastructure is there — we just need UI.

Two distinct user groups need different treatment:
1. **Existing drivers** (`profile.role === "driver"`): Toggle between Rider mode and Driver mode (infra exists, just add UI)
2. **Pure riders** (`profile.role === "rider"`): Need a "Become a driver" CTA that routes to driver onboarding/signup

## Plan: Add Role Switcher UI

### 1. For drivers — add a "Switch to Rider/Driver" toggle
**Location**: Top-right of header in `RoleLayout.tsx` (next to NotificationBell), plus an entry in account pages.

Create `src/components/RoleSwitcher.tsx`:
- Reads `useActiveRole()` — only renders if `canSwitch === true`
- Compact dropdown / pill button: shows current mode with car/person icon, click to switch
- On switch: calls `setActiveRole(newRole)` then `navigate("/rider")` or `navigate("/driver")`
- Shows toast: "Switched to Driver mode"

Place in `RoleLayout` header so it's globally visible for drivers in either mode.

### 2. For riders — add "Drive with PickYou" CTA
**Location**: `RiderAccount.tsx` page — add a card section "Earn with PickYou" with a button routing to `/login?role=driver` (or a dedicated `/driver/signup` flow if onboarding requires a fresh account).

Since drivers and riders use the same auth account (role lives on profile), the cleanest approach is: 
- Add a "Become a driver" card in Rider Account that routes to `/driver/onboarding` 
- The onboarding flow already exists (`DriverOnboarding.tsx`) — it just needs the user's `profile.role` to be promoted. We'd update onboarding to upgrade `role` from `rider` → `driver` on submission.

### 3. Visual design
- Header switcher: pill-style toggle, dark theme, primary blue when active mode highlighted
- Use `Car` and `User` icons from lucide-react
- Mobile: icon-only; Desktop: icon + label

### Files to create/modify
- **New**: `src/components/RoleSwitcher.tsx` (the toggle component)
- **Modify**: `src/components/RoleLayout.tsx` (mount switcher in header for drivers)
- **Modify**: `src/pages/RiderAccount.tsx` (add "Become a driver" card for riders)
- **Modify**: `src/pages/DriverOnboarding.tsx` (allow rider→driver role upgrade on completion — verify this already works)

### Out of scope (ask user if needed)
- Whether pure riders should be able to start driver onboarding directly from the home page header (vs. only from Account)
- Whether to show the driver application status (pending verification) inline

### Technical notes
- `ActiveRoleContext` already persists choice in `localStorage` under `pickyou-active-role`
- `RoleLayout` reads `activeRole` to decide which bottom tab bar to show — so switching will instantly reflect in nav
- Routes `/rider/*` and `/driver/*` are guarded by `ProtectedRoute` with `allowedRoles`. Drivers are already allowed in `/rider`, so switching works. Riders are NOT allowed in `/driver` — correct, since they must onboard first.

This is the minimum to ship a clean Uber-style role switcher.
