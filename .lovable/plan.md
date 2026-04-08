

## Rider Dashboard Audit — Uber-Level Gap Analysis

---

### What works well
- **DashboardHome**: Clean tab system (Taxi/Charter/Delivery), "Where to?" autocomplete with scheduling, saved places, suggestions grid, quick action cards — solid Uber-like home screen.
- **RiderDashboard (Booking)**: Full booking flow with 7 service types, live map, traffic-aware ETA, zone-based pricing, org billing, Stripe payment, real-time driver tracking, rating dialog.
- **RiderActivity**: Loading skeletons, empty state, ride history with status colors.
- **BottomTabBar**: Clean 4-tab mobile nav.

---

### Still Outstanding (14 items)

#### High Priority

1. **RiderDashboard.tsx is a god component (1,432 lines)** — Booking form, active ride view, ride history, payment, rating, 7 service type forms all in one file. Should split into `ActiveRidePanel`, `BookingForm`, `RideHistory`, and service-specific form components.

2. **No loading/skeleton state on DashboardHome** — Saved places query has no loading indicator. The page renders empty then pops content in.

3. **No active ride banner on DashboardHome** — If a rider has an active ride (requested/accepted/in_progress), the home screen shows nothing. Uber shows a prominent "Your ride is on the way" banner that links to the tracking view.

4. **No greeting or personalization** — DashboardHome doesn't greet the user by name or show time-of-day context ("Good morning, John"). Uber personalizes the home screen.

5. **No error states on any rider page** — If queries fail (saved places, rides, pricing), nothing renders. No retry prompts anywhere.

#### Medium Priority

6. **Activity page is too basic** — No filtering (by status, date, service type), no search, no pagination beyond 20 rides, no trip detail view. Tapping a ride should show a detailed receipt.

7. **RiderAccount is sparse** — No avatar/photo upload, no editable name, no saved places management, no payment methods section, no ride preferences. Just phone + SMS toggle + sign out.

8. **No real-time ride status updates on Activity page** — Activity page doesn't subscribe to realtime changes. If a ride completes while viewing Activity, it stays stale.

9. **Duplicate saved places chips** — Saved places are rendered twice in the booking form (once for pickup, once for dropoff) with identical geocoding logic. Should be a shared component.

10. **No ETA display on DashboardHome** — When a ride is active, home should show driver ETA prominently.

#### Lower Priority

11. **No support/help access from rider pages** — No help button on DashboardHome or Activity. Only corporate apply link on Account.

12. **Heavy `any` type usage** — `riderOrgMembership` uses `as any` casts, ride objects lack proper typing throughout.

13. **No recent/frequent destinations** — Uber shows "Recent" destinations based on ride history for quick re-booking. Only saved places are shown.

14. **No promotional banners or announcements** — No way to show promos, discounts, or service announcements on the home screen.

---

### Recommended Build Order

| Step | Task | Files |
|------|------|-------|
| 1 | Split RiderDashboard.tsx into sub-components | New: `ActiveRidePanel.tsx`, `BookingForm.tsx`, `RideHistoryList.tsx` |
| 2 | Add active ride banner to DashboardHome | `DashboardHome.tsx` |
| 3 | Add greeting + loading skeletons to DashboardHome | `DashboardHome.tsx` |
| 4 | Add error boundaries with retry across rider pages | All rider pages |
| 5 | Add trip detail view + filters to Activity | `RiderActivity.tsx` |
| 6 | Enhance RiderAccount (avatar, name edit, saved places, help link) | `RiderAccount.tsx` |
| 7 | Extract SavedPlaceChips shared component | New: `SavedPlaceChips.tsx` |
| 8 | Add recent destinations from ride history to DashboardHome | `DashboardHome.tsx` |
| 9 | Add realtime subscription to Activity page | `RiderActivity.tsx` |
| 10 | Replace `any` types with proper interfaces | `src/types/rider.ts` + rider pages |
| 11 | Add support/help access to rider pages | `DashboardHome.tsx`, `RiderAccount.tsx` |

