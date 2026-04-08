

## Uber-Style Feature Gaps — Cross-Platform Audit

After reviewing all three dashboards (rider, driver, admin) and the full codebase, here are the Uber-level features that are still missing across the entire platform.

---

### Already Built
Booking flow (7 service types), live GPS tracking, taxi meter, Stripe payments (authorize/capture), driver bidding, ride ratings, scheduling, push notifications, support chat with AI + escalation, food delivery, corporate billing, admin management, i18n, real-time subscriptions, session management.

---

### Missing Uber-Style Features (12 items)

#### Rider Experience

1. **In-ride messaging (rider ↔ driver chat)** — The `ride_messages` table exists with full RLS policies, but there is zero UI for it. Uber lets riders and drivers text each other during active rides. Should add a chat drawer/sheet accessible from the active ride panel.

2. **Tipping after ride** — No tip functionality anywhere. Uber prompts riders to tip after completion. Should add tip selection (preset amounts + custom) to the post-ride rating dialog and store it on the ride record.

3. **Share trip / share ETA** — No way to share live trip status with a friend or family member. Uber's "Share my trip" generates a link with real-time tracking. Could implement as a shareable URL with a public tracking page.

4. **Ride cancellation with reason + fee** — Riders can cancel but there's no reason selection ("Driver too far", "Changed plans", etc.) and no cancellation fee logic after driver acceptance.

5. **Fare estimate on DashboardHome** — The "Where to?" search navigates to booking but doesn't show a quick fare estimate inline. Uber shows estimated price right on the home screen before you commit to booking.

#### Driver Experience

6. **In-ride messaging (driver side)** — Same as #1 — driver needs a chat UI to communicate with the rider during active trips.

7. **Navigation integration** — No "Open in Google Maps / Waze" button for drivers. The turn-by-turn nav component exists but there's no deep-link to native maps apps for actual navigation.

8. **Trip receipt / summary screen** — After completing a ride, drivers see nothing. Uber shows a trip summary (fare, tip, commission, duration, distance) as a dismissible card.

#### Cross-Platform

9. **Rider onboarding flow** — New riders land directly on the dashboard with no introduction. Uber shows a 3-step walkthrough (how to book, payment setup, safety features) on first login.

10. **Promo codes / referral system** — No promotional pricing, discount codes, or referral bonuses. Uber heavily uses these for growth. Would need a `promo_codes` table and a redemption UI.

11. **Multi-stop rides** — Only single pickup → single dropoff. Uber supports adding stops mid-trip. Would require a `ride_stops` table and UI for adding intermediate waypoints.

12. **Ride receipt email / download** — No way to get a PDF receipt or email summary of a completed ride. The Activity page shows details but nothing exportable.

---

### Recommended Build Order

| Step | Task | Impact | Files |
|------|------|--------|-------|
| 1 | Rider ↔ Driver in-ride chat | High | New: `RideChatSheet.tsx` + driver equivalent |
| 2 | Tipping after ride completion | High | `RideRatingDialog.tsx`, DB migration for `tip_cents` column |
| 3 | Cancellation reasons + fee logic | High | `RiderDashboard.tsx`, DB migration |
| 4 | Open in Google Maps / Waze for drivers | Medium | `ActiveTripPanel.tsx` |
| 5 | Share trip with live tracking link | Medium | New: public tracking page + share button |
| 6 | Driver trip summary after completion | Medium | New: `TripSummaryCard.tsx` |
| 7 | Fare estimate on DashboardHome | Medium | `DashboardHome.tsx` |
| 8 | New rider onboarding walkthrough | Medium | New: `OnboardingFlow.tsx` |
| 9 | Promo codes / referral system | Medium | DB migration + new UI |
| 10 | Ride receipt PDF / email | Low | Edge function + UI button |
| 11 | Multi-stop rides | Low | DB migration + significant UI changes |
| 12 | Driver post-trip receipt card | Low | `DriverDispatch.tsx` |

---

### Technical Notes
- The `ride_messages` table is fully set up with RLS for both riders and drivers — just needs UI components.
- Tipping requires a new `tip_cents` column on `rides` and updates to the `capture-payment` edge function.
- "Open in Maps" is a simple `window.open()` with a Google Maps / Waze deep link — minimal effort, high driver satisfaction.
- Promo codes would need a new table, validation edge function, and integration into the booking flow's pricing calculation.

