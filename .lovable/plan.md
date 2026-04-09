

## Remove Bókun Integration

The Bókun booking sync feature is unused. Here's what needs to be removed:

### Files to delete
- `src/pages/AdminBookings.tsx` — the admin bookings page
- `supabase/functions/sync-bokun-bookings/index.ts` — the edge function

### Files to edit

1. **`src/App.tsx`** — Remove the `AdminBookings` import and the `/admin/bookings` route

2. **`src/pages/AdminDashboard.tsx`** — Remove the Bókun bookings stat card, the `bokun_bookings` query from the `Promise.all`, and the `syncedBookings` references

3. **`supabase/config.toml`** — Remove the `[functions.sync-bokun-bookings]` block

### Database migration
- Drop the `bokun_bookings` and `bokun_sync_status` tables

### Secrets (optional cleanup)
- `BOKUN_ACCESS_KEY` and `BOKUN_SECRET_KEY` can be removed if no longer needed elsewhere

