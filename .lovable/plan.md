

## Investigation findings

**Good news: The documents ARE in the database.** I queried `verifications` and found 3 pending uploads from hybronx (driver_id `12b3372c...`):
- `drivers_license` — pending — uploaded 20:34:38
- `vehicle_insurance` — pending — uploaded 20:34:51
- `vehicle_registration` — pending — uploaded 20:35:00

I also verified:
- The FK `verifications_driver_id_fkey → profiles` exists, so the embedded join in the admin query works.
- RLS policy `Admins can view all verifications` allows admin SELECT.
- The route `/admin/verifications` is wired in `App.tsx` and the sidebar nav item exists.

So technically the admin page **should** show those 3 pending docs. The most likely reasons you're not seeing them:

1. You haven't navigated to **Admin → Verifications** in the sidebar (the main `/admin` dashboard does not surface pending verification counts).
2. Your browser is showing a stale react-query cache from before hybronx submitted — a hard refresh would fix it.
3. You're viewing under a non-admin account.

## Proposed fix (improves UX so this can't happen again)

Rather than just telling you to click the right link, I'll add visibility so pending verifications surface clearly:

### 1. Add a "Pending Verifications" badge on the admin sidebar
Update `AppSidebar.tsx` so the **Verifications** nav item shows a red count badge (e.g. `3`) whenever there are docs with `status = 'pending'`. Uses a lightweight react-query poll every 30s.

### 2. Add a "Pending Verifications" KPI card on the Admin Dashboard
On `/admin` (`AdminDashboard.tsx`), add a clickable card showing the pending count that links to `/admin/verifications`. So even if an admin lands on the dashboard, they immediately see "3 drivers awaiting review".

### 3. Add auto-refresh on the Verifications page
Add `refetchInterval: 30000` to the query in `AdminVerifications.tsx` so newly-submitted docs appear without a manual refresh.

### Files to change
- `src/components/AppSidebar.tsx` — pending count badge on Verifications nav item
- `src/pages/AdminDashboard.tsx` — pending verifications KPI card
- `src/pages/AdminVerifications.tsx` — add `refetchInterval`

### What to do right now (no code change needed)
Sign in as your admin account, click **Verifications** in the left sidebar, and ensure the status filter is set to **All** or **Pending**. You should see hybronx's 3 documents immediately. If you still don't, hard-refresh (Ctrl/Cmd+Shift+R).

