

## Driver Dashboard Audit — Uber-Level Gap Analysis

After reviewing all four driver pages (Dashboard, Dispatch, Earnings, Account) and the bottom tab bar, here are the gaps and improvements needed to reach Uber-level quality.

---

### 1. Dashboard (`DriverDashboard.tsx`) — 495 lines

**What works well:** Online toggle, active trip banner, stats grid, dispatch CTA, service badges.

**Gaps:**
- **No loading/skeleton states** — stats flash from empty to populated with no visual feedback. Uber shows shimmer placeholders.
- **Online duration doesn't live-update** — calculated once on render, never ticks. Should use a `setInterval` or re-render every minute.
- **No acceptance rate or rating display** — Uber prominently shows driver rating and acceptance rate on the home screen. These are trust signals.
- **"Your services" section is low-value real estate** — takes up space but isn't actionable. Could be collapsed or moved to Account.
- **No shift summary when going offline** — Uber shows a shift summary (hours, trips, earnings) when drivers end their shift. Currently just a toast.
- **Recent trips list uses `any` types throughout** — no type safety.
- **Unused imports** — `Package`, `Briefcase`, `format` from date-fns are imported but unused.

---

### 2. Dispatch (`DriverDispatch.tsx`) — 1043 lines (too large)

**What works well:** Trip stepper, airport detection, navigate button, service-specific detail rendering, realtime subscription.

**Gaps:**
- **God component at 1043 lines** — should be split into `ActiveTripPanel`, `IncomingRequestCard`, `OutstandingBalances`, and `RecentDeliveries` sub-components.
- **No sound/vibration on new request** — Uber plays an alert sound and vibrates when a new trip comes in. Critical for driver attention.
- **No auto-decline timer** — Uber gives drivers ~15 seconds to accept before auto-declining. Requests just sit indefinitely here.
- **Decline does nothing** — `declineRide()` only shows a toast, doesn't remove the ride from the list or track the decline. The ride reappears on next poll.
- **No loading state on Accept/Decline buttons** — tapping Accept has no immediate visual feedback while the mutation runs.
- **Request cards don't show time since request** — drivers can't tell if a request is 2 seconds or 5 minutes old.
- **No surge/demand indicator** — Uber shows demand heatmaps or surge pricing zones.
- **Map doesn't auto-center** — no fly-to behavior when switching between active trip and pending requests.
- **TripStepper doesn't handle "arrived" status** — the stepper code only maps `accepted`, `in_progress`, and falls through to index 3. There's no "arrived at pickup" state transition in the action buttons either.

---

### 3. Earnings (`DriverEarnings.tsx`) — 538 lines

**What works well:** Period selector, weekly chart, payout system, commission promo banner, recent trips.

**Gaps:**
- **Chart shows nothing useful for new drivers** — empty bars with no "no data yet" message. Should show an empty state.
- **No per-trip earning breakdown** — Uber shows fare, tip, surge, commission, net for each trip. Currently only shows net.
- **No tips tracking** — tips aren't mentioned anywhere in earnings.
- **Weekly chart doesn't show the full week** — `eachDayOfInterval({ start: weekStart, end: new Date() })` only shows days up to today, so future days are missing from the chart (e.g., on Monday you only see 1 bar).
- **Balance calculation relies on `driver_balance_cents` field** — but there's no visible mechanism that updates this field after each trip. Could show stale/zero data.
- **Payout request uses `as any` cast** — type safety gap.

---

### 4. Account (`DriverAccount.tsx`) — 311 lines

**What works well:** Clean profile card, verification status, shift stats, service badges.

**Gaps:**
- **No avatar upload** — just shows initials. Uber has photo upload for driver profile.
- **No editable fields** — name, phone, vehicle info are all read-only. Driver can't update anything.
- **No notification preferences** — no toggle for push notifications, email alerts, etc.
- **No help/support link** — Uber has prominent "Help" access from the account page.
- **No rating display** — driver doesn't see their own rating.
- **No dark mode toggle or language selector** — though language switcher exists elsewhere.
- **Sign-out button is the only action** — feels incomplete.

---

### 5. Bottom Tab Bar

**Gaps:**
- **No badge/dot on Dispatch tab** — when there are pending requests, the Dispatch tab should show a count badge (like Uber's notification dots).
- **No haptic feedback** — tapping tabs has no physical feel on mobile.

---

### 6. Cross-Cutting Issues

- **No skeleton/loading states anywhere** — all four pages jump from empty to loaded.
- **No error states** — if a query fails, nothing is shown. Should show retry prompts.
- **No pull-to-refresh** — standard in mobile apps, missing here.
- **Type safety** — heavy use of `any` throughout all driver pages.
- **No offline handling** — if the driver loses connection, there's no indicator or queued actions.
- **`serviceLabels` duplicated** — defined identically in Dashboard, Dispatch, and Earnings. Should be a shared constant.

---

### Priority Improvements (Recommended Build Order)

1. **Add loading skeletons** across all driver pages
2. **Split DriverDispatch.tsx** into sub-components (ActiveTripPanel, RequestCard, etc.)
3. **Add request age timer + auto-decline countdown** to incoming requests
4. **Add notification badge to Dispatch tab** in bottom bar
5. **Fix online duration live-ticking** on dashboard
6. **Add driver rating + acceptance rate** to dashboard header
7. **Add new request sound/vibration alert**
8. **Make decline actually work** (hide from list, optionally track)
9. **Add button loading states** on Accept/Start/Complete actions
10. **Extract shared constants** (serviceLabels, fmt, ServiceIcon) into a shared file
11. **Add avatar upload** to Account page
12. **Add shift summary dialog** when going offline
13. **Fill weekly chart with all 7 days** regardless of current day
14. **Add error boundaries and retry states**

These improvements would bring the driver experience from "functional prototype" to "production-grade transportation tool."

