

# Admin Dashboard Audit — PickYou

## What's Working Well
- **Access control**: All admin routes behind `ProtectedRoute` with `allowedRoles={["admin"]}`. RLS policies use `has_role(auth.uid(), 'admin')` consistently.
- **Ride detail page**: Comprehensive financials, route info, people links, admin actions (force cancel, reassign), and full event timeline.
- **Support system**: Conversation list with status filters, admin reply with customer notification, internal notes, status management.
- **Notification logs**: Realtime subscription, delivery rate charts, method breakdown pie chart, retry queue processing.
- **User detail page**: Inline edits, driver capabilities, verification status, ratings with low-rating flag, ride history.
- **Reports**: CSV export, date presets, revenue/trends/service breakdown charts, filterable ride table.
- **Verifications**: Approve/reject with notes, auto-notification to driver on approval.
- **Pricing**: Per-service pricing management with surge multiplier control.

---

## Top 10 Issues

### 1. Reports page loads ALL rides into memory (CRITICAL SCALABILITY)
`AdminReports` fetches `supabase.from("rides").select("*").order("created_at", { ascending: false })` with NO limit. At scale this will fetch tens of thousands of rows, crash the browser, and hit the 1000-row Supabase default limit silently (truncating data without warning). Charts and stats become inaccurate.

**Fix**: Use server-side pagination with `.range()`. Add a DB RPC for aggregated stats (revenue, completion rate) instead of client-side computation. Apply date filters in the query, not post-fetch.

### 2. Dashboard missing "drivers online" count (HIGH)
The main dashboard shows 5 cards but is missing the most critical operational metric: **how many drivers are currently online**. An ops manager needs this at a glance to know if supply meets demand.

**Fix**: Add a 6th card querying `profiles` where `role = 'driver' AND is_available = true`.

### 3. No live operations map (HIGH)
There's no way for admin to see all active rides and online drivers on a map. The simulator page exists but is separate. For real-time operations, an admin needs a live map showing driver locations, active ride routes, and ride statuses.

**Fix**: Create an `AdminLiveMap` page using the existing `MapContainer` component, plotting online driver positions and active ride pickup/dropoff pins.

### 4. No alert system for operational anomalies (HIGH)
No automated detection of: rides not accepted after X seconds, payment failures, cancellation spikes, or low driver availability. Admin must manually check each page.

**Fix**: Add an alerts panel on the dashboard that queries for: rides in `requested` status > 2 min old, failed payments in last hour, cancellation rate > threshold, and online driver count < threshold. Display as dismissible alert cards.

### 5. Reassign driver requires manual profile ID entry (MEDIUM UX)
`AdminRideDetail` reassign dialog asks admin to paste a raw UUID profile ID. No admin would know this. It should show a searchable dropdown of available online drivers.

**Fix**: Replace the text input with a driver search/select that queries online drivers and shows their name, vehicle, and distance from pickup.

### 6. No "force complete" action for stuck rides (MEDIUM)
Admin can force-cancel but cannot force-complete a ride that's stuck in `in_progress` (e.g., driver's app crashed). This leaves the ride permanently open.

**Fix**: Add a "Force Complete" button in `AdminRideDetail` that calls the `complete-ride` edge function with admin override.

### 7. No broadcast notification capability (MEDIUM)
Admin cannot send push notifications to all drivers or all riders. The notification system only handles ride-event-driven notifications. No way to announce maintenance, new features, or urgent operational messages.

**Fix**: Add a "Send Broadcast" panel on the admin dashboard that lets admin compose a message, select audience (all drivers / all riders / all users), and invoke `send-push-notification` with a `broadcast` mode.

### 8. Dashboard stats poll at 30s, not realtime (LOW)
`AdminDashboard` uses `refetchInterval: 30000`. During peak operations, stats are up to 30s stale. Other admin pages already use Realtime.

**Fix**: Add a Realtime subscription on `rides` table to invalidate stats queries instantly.

### 9. User management fetches ALL profiles client-side (SCALABILITY)
`AdminUsers` loads all profiles at once with `supabase.from("profiles").select(...)` then filters/paginates client-side. With thousands of users this will be slow and hit the 1000-row limit.

**Fix**: Move search and filter to server-side queries with `.range()`, `.ilike()`, and `.eq()` filters.

### 10. No admin audit trail for admin actions (SECURITY)
When admin force-cancels a ride, changes a user's role, or approves a verification, there's no log of which admin did what. The `ride_events` table captures ride changes but not who triggered them from admin.

**Fix**: Add admin action logging — either extend `ride_events` with explicit admin actor tracking, or create a lightweight `admin_audit_log` table recording action, admin_id, target, and timestamp.

---

## Implementation Plan — 7 Items (prioritized)

### Fix 1: Server-side pagination for Reports page
- Create DB RPC `get_ride_stats(date_from, date_to, status, service_type)` returning aggregated totals
- Update `AdminReports` to use `.range()` with server-side filters
- Keep charts fed by the RPC, not raw ride rows

### Fix 2: Add "drivers online" metric to dashboard
- Add query: `profiles` where `role = driver AND is_available = true`, count
- Add card to dashboard grid

### Fix 3: Operational alerts panel on dashboard
- Query rides in `requested` > 120s, failed payments (last hour), cancellation rate
- Render as alert cards with action links

### Fix 4: Fix reassign driver UX
- Replace text input with searchable driver dropdown
- Query online drivers, show name + vehicle + distance

### Fix 5: Add force-complete action
- Add button in `AdminRideDetail` for `in_progress` rides
- Call `complete-ride` edge function

### Fix 6: Server-side pagination for Users page
- Move filters to query params: `.ilike("full_name", search)`, `.eq("role", filter)`
- Use `.range()` for pagination

### Fix 7: Realtime dashboard stats
- Add Realtime subscription on `rides` and `profiles` tables to invalidate dashboard stats

---

## Technical Details

**New files:**
- None required (all changes to existing pages)

**Modified files:**
- `src/pages/AdminDashboard.tsx` — add drivers online card, alerts panel, Realtime subscription
- `src/pages/AdminReports.tsx` — server-side pagination and RPC for stats
- `src/pages/AdminUsers.tsx` — server-side search/filter/pagination
- `src/pages/AdminRideDetail.tsx` — driver search dropdown for reassign, force-complete button

**DB migration:**
- RPC `get_ride_stats` for aggregated reporting
- (Optional) `admin_audit_log` table

**Priority**: Fix 1 (scalability) → Fix 2 (visibility) → Fix 3 (alerts) → Fix 4 (reassign UX) → Fix 5 (force-complete) → Fix 6 (users scalability) → Fix 7 (realtime)

