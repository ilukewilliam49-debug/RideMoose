

## Plan: Create Test Driver Account

**Goal**: Create a test driver account for end-to-end testing of the document verification flow.

### Approach
Same pattern as the test admin account — use a temporary edge function with the Admin API.

### Steps

1. **Create temporary edge function** `supabase/functions/create-test-driver/index.ts` that calls `supabase.auth.admin.createUser()` with:
   - Email: `testdriver@pickyou.test`
   - Password: `Test1234!`
   - `email_confirm: true`
   - `user_metadata: { full_name: "Test Driver", role: "driver" }`

2. **Deploy and invoke** the function to create the account — the `handle_new_user` trigger will auto-create a profile with `role = 'driver'`.

3. **Verify** the profile exists in the database with the correct role.

4. **Clean up** — delete the temporary edge function.

### Result
- **Email**: `testdriver@pickyou.test`
- **Password**: `Test1234!`
- **Role**: `driver`

You can then test the full flow:
1. Log in as admin (`testadmin@pickyou.test`) → reject a document
2. Log in as driver (`testdriver@pickyou.test`) → re-upload the rejected document
3. Log back in as admin → verify the notification appears

