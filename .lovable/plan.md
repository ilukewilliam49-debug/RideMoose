

## Plan: Create Test Admin Account

**Goal**: Create a new admin account with email `testadmin@pickyou.test` and password `Test1234!`

### Steps

1. **Create the auth user** via Supabase Auth API (using the edge function or direct admin API call)
2. **Ensure the profile** is created with `role = 'admin'` — the `handle_new_user` trigger will auto-create the profile, but it reads the role from user metadata, so we pass `role: 'admin'` in the signup metadata
3. **Enable auto-confirm** temporarily (or use the admin API) so the account is immediately usable without email verification

### Technical Details

- Use `supabase.auth.admin.createUser()` via a `psql` call or a quick script that calls the Supabase Admin API with the service role key
- Pass `user_metadata: { full_name: 'Test Admin', role: 'admin' }` so the `handle_new_user` trigger sets `role = 'admin'` in the profiles table
- Set `email_confirm: true` so the account is immediately active
- No database migration needed — the existing trigger handles profile creation

