

## Rider Dashboard Audit — Status

### Completed ✓
1. ✅ **DashboardHome: Greeting + personalization** — Time-of-day greeting with first name
2. ✅ **DashboardHome: Active ride banner** — Prominent banner showing active ride status, links to tracking
3. ✅ **DashboardHome: Loading skeletons** — Saved places query shows skeleton placeholders
4. ✅ **DashboardHome: Error states with retry** — ErrorRetry component on saved places failure
5. ✅ **DashboardHome: Recent destinations** — Shows up to 3 deduplicated recent drop-offs from ride history
6. ✅ **DashboardHome: Help/Support access** — SupportChatDialog accessible from quick actions
7. ✅ **RiderActivity: Status filters** — All/Active/Completed/Cancelled filter chips
8. ✅ **RiderActivity: Trip detail sheet** — Tap a ride to see full receipt with fare breakdown
9. ✅ **RiderActivity: Realtime subscription** — Auto-refreshes when rides change
10. ✅ **RiderActivity: Error state with retry** — ErrorRetry on query failure
11. ✅ **RiderAccount: Avatar upload** — Camera button uploads to avatars bucket
12. ✅ **RiderAccount: Editable name** — Pencil icon to edit full name inline
13. ✅ **RiderAccount: Help/Support link** — SupportChatDialog in navigation links
14. ✅ **SavedPlaceChips shared component** — Extracted from RiderDashboard, used for both pickup and dropoff
15. ✅ **Rider types** — `src/types/rider.ts` with proper interfaces replacing `any` usage
16. ✅ **RiderDashboard: Reduced duplication** — Replaced 60+ lines of duplicate saved place chips with shared component

### Still Outstanding
- **Full RiderDashboard split** — The booking form + active ride panel + ride history could be further extracted into separate files (RiderDashboard is still ~1390 lines). This is a large refactor best done incrementally.
- **Saved places management UI** — CRUD interface for managing saved places from Account page

## Driver Dashboard — Remaining Gaps

(See previous plan entries — all 11 items completed)
