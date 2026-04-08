

## Admin Dashboard Audit — Gap Analysis

---

### What works well
- **Dashboard home**: Clean stat cards with counts, quick action links, motion animations.
- **Support**: Full ticket management with chat transcript, admin replies, notifications, status updates, internal notes, and status filtering.
- **Corporate**: Complete application review workflow (approve/reject/request-info), member management, invoice generation, status toggling.
- **Pricing**: Comprehensive — platform config, taxi meter rates, pet transport rates, service-specific pricing, flat rate toggles.
- **Zones**: Both route pricing and geofence boundary management with CRUD and JSON polygon editing.
- **Bookings**: Bókun sync with status card, manual trigger, and booking table.

---

### Outstanding Issues (15 items)

#### High Priority

1. **No loading skeletons on Dashboard home** — Stats flash from 0 to actual values. No shimmer/skeleton while the 5 parallel queries resolve.

2. **No error states anywhere** — If any query fails across all 8 admin pages, nothing renders. No retry prompts. Should use the existing `ErrorRetry` component from the driver audit.

3. **No real-time refresh on Dashboard** — Stats are fetched once and never update. Support tickets, active rides, and pending verifications should auto-refresh (e.g. `refetchInterval: 30000`).

4. **AdminReports is too basic** — No filtering (by status, date range, service type, driver). No pagination (fetches ALL rides). No summary stats (total revenue, avg fare, completion rate). CSV filename says "onlyknifers" instead of "PickYou".

5. **AdminUsers has no search or filtering** — No way to find a specific user by name, phone, or role. No pagination. Fetches all profiles at once. Missing columns: phone, email, registration date, verification status.

6. **AdminUsers stores roles on profiles table** — Roles are stored directly on the `profiles.role` column. Per security guidelines, roles should be in a separate `user_roles` table to prevent privilege escalation. However, this is deeply integrated across the app (ProtectedRoute, AppSidebar, useAuth all read `profile.role`), so migrating would be a large refactor.

#### Medium Priority

7. **No revenue/earnings card on Dashboard** — Dashboard shows counts but not total revenue (sum of completed ride fares). This is a key admin KPI.

8. **AdminVerifications has no loading state** — Uses `useQuery` but no loading indicator while fetching. Also no filter by status (pending/approved/rejected).

9. **AdminSupport doesn't load admin_notes on selection** — When clicking a conversation, `adminNotes` is initialized from `conv.admin_notes`, but if you switch between conversations the state persists from the previous selection incorrectly.

10. **No audit log / activity feed** — No way to see recent admin actions (who approved what, when roles changed, etc.).

11. **Corporate page is a god component (596 lines)** — Combines org list, member management, application review, invoice management, all in one file. Should split into sub-components.

12. **No confirmation dialogs for destructive actions** — Deleting zones, removing org members, changing user roles — all happen instantly with no "Are you sure?" prompt.

#### Lower Priority

13. **No `as any` cleanup** — `bokun_bookings as any`, `as any` casts in verifications, reports, support, and corporate pages.

14. **No mobile optimization** — Admin tables don't scroll well on mobile. The 440px viewport would clip most table views.

15. **No dark/light mode toggle** — Admin panel inherits app theme but has no way to switch.

---

### Recommended Build Order

| Step | Task | Files |
|------|------|-------|
| 1 | Add loading skeletons + error states to Dashboard home | `AdminDashboard.tsx` |
| 2 | Add auto-refresh interval + revenue stat to Dashboard | `AdminDashboard.tsx` |
| 3 | Add search, role filter, phone column, and pagination to Users | `AdminUsers.tsx` |
| 4 | Add date/status/service filters, pagination, summary stats, and fix CSV filename in Reports | `AdminReports.tsx` |
| 5 | Add loading state + status filter to Verifications | `AdminVerifications.tsx` |
| 6 | Add error boundaries with retry across all admin pages | All admin pages |
| 7 | Add confirmation dialogs for destructive actions (delete zone, remove member, role change) | `AdminZones.tsx`, `AdminCorporate.tsx`, `AdminUsers.tsx` |
| 8 | Split AdminCorporate into sub-components (OrgList, ApplicationReview, InvoicePanel) | `AdminCorporate.tsx` + new files |
| 9 | Fix AdminSupport adminNotes state bug on conversation switch | `AdminSupport.tsx` |
| 10 | Add mobile-responsive table wrappers with horizontal scroll | All admin pages with tables |
| 11 | Replace `as any` casts with proper types | All admin pages |

