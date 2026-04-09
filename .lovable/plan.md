

## Plan: Show Scheduled Time in Admin Trip Reports

### What's missing
The rider's scheduling popover saves `scheduled_at` to the `rides` table, but the Admin Reports page (`/admin/reports`) does not display or export this information.

### Changes

**File: `src/pages/AdminReports.tsx`**

1. **Add a "Scheduled" column** to the trip table between "Date" and "Status" (or after "Date"):
   - Display the `scheduled_at` value formatted as date + time if present, or "—" if null (meaning it was a "Now" ride).

2. **Add a "Scheduled" badge/indicator** — rides with a `scheduled_at` value get a small badge so admins can quickly spot pre-scheduled trips.

3. **Update CSV export** — add a "Scheduled At" column to the exported CSV so the data is included in reports.

4. **Optional filter** — add a filter option (e.g., "Scheduled only" toggle or a dropdown) so admins can filter to see only pre-scheduled rides.

### Technical details
- The `rides` table already has a `scheduled_at` column (nullable timestamp).
- The existing query (`select("*, rider:rider_id(full_name), driver:driver_id(full_name)")`) already fetches all columns including `scheduled_at` — no query change needed.
- Format using `date-fns` `format()` which is already imported.
- No database migrations required.

