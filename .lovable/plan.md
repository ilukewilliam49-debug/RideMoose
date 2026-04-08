

## Driver Dashboard — Remaining Gaps

Here's what's been done vs. what's still outstanding from the Uber-level audit.

---

### Already Implemented (13 items) ✓
Loading skeletons, live-ticking online duration, shift summary dialog, shared constants, dispatch badge, decline hides requests, accept loading state, request age display, avatar upload, driver rating on account, help/support link, full 7-day chart, navigate button.

---

### Still Outstanding (11 items)

#### High Priority

1. **Split DriverDispatch.tsx (1,030 lines)** — Still a god component. Should extract `ActiveTripPanel`, `IncomingRequestCard`, `OutstandingBalances`, `RecentDeliveries` into separate files.

2. **Auto-decline countdown timer** — Requests sit indefinitely. Uber gives ~15 seconds with a visual countdown before auto-declining. Needs a circular progress indicator and timer logic.

3. **Sound/vibration on new request** — No multi-sensory alert when a trip comes in. Should play an audio tone and trigger `navigator.vibrate()` when new requests appear.

4. **TripStepper missing "arrived" status** — The stepper maps `accepted` → index 0 and `in_progress` → index 2, but skips "arrived at pickup" (index 1). No action button transitions to "arrived" status either.

5. **Driver rating + acceptance rate on Dashboard header** — Rating is on Account page but not on the Dashboard home screen where Uber prominently shows it.

#### Medium Priority

6. **No per-trip earning breakdown** — Earnings only show net amount. Uber shows fare, tip, surge, commission for each trip.

7. **No error states / retry prompts** — If any query fails, nothing renders. Should show an error message with a retry button.

8. **Earnings chart empty state** — New drivers see empty bars with no message. Should show "No earnings yet" placeholder.

9. **Account page has no editable fields** — Name, phone, vehicle info are read-only. Drivers can't update anything.

10. **No notification preferences** — No toggles for push notifications or email alerts on Account page.

#### Lower Priority

11. **Type safety** — Heavy use of `any` types across all driver pages (ride objects, trip lists, earnings data). Should define proper TypeScript interfaces.

---

### Recommended Build Order

| Step | Task | Files |
|------|------|-------|
| 1 | Split DriverDispatch into sub-components | New: `ActiveTripPanel.tsx`, `IncomingRequestCard.tsx`, `OutstandingBalances.tsx`, `RecentDeliveries.tsx` |
| 2 | Add auto-decline countdown (15s timer with circular progress) | `IncomingRequestCard.tsx` |
| 3 | Add sound + vibration alerts on new requests | `DriverDispatch.tsx` |
| 4 | Fix TripStepper to handle "arrived" status + add "I've arrived" action button | `ActiveTripPanel.tsx` |
| 5 | Add rating + acceptance rate to Dashboard header | `DriverDashboard.tsx` |
| 6 | Add error boundaries with retry across all driver pages | All driver pages |
| 7 | Add per-trip breakdown in earnings | `DriverEarnings.tsx` |
| 8 | Add empty state for earnings chart | `DriverEarnings.tsx` |
| 9 | Make Account fields editable (name, phone, vehicle) | `DriverAccount.tsx` |
| 10 | Add notification preference toggles | `DriverAccount.tsx` |
| 11 | Replace `any` types with proper interfaces | `src/types/driver.ts` + all driver pages |

