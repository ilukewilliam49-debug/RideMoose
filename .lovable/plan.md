

## Add Role Selection to Signup Flow

**Problem**: The database trigger `handle_new_user` hardcodes every new user as `'rider'`. There's no UI for choosing "Driver" during registration.

**Solution**: Add a role selector (Rider / Driver) to the signup form, pass it via user metadata, and update the database trigger to read it.

### Changes

**1. `src/pages/Login.tsx`** — Add role toggle to signup form
- Add a two-option toggle group (Rider / Driver) that appears only during signup
- Store selection in state, default to `"rider"`
- Pass `role` in the `options.data` metadata alongside `full_name`

**2. Database migration** — Update `handle_new_user()` trigger function
- Read `NEW.raw_user_meta_data->>'role'` and default to `'rider'` if missing
- Cast to `user_role` enum so only valid values are accepted

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, full_name, role, is_available, created_at)
  VALUES (
    NEW.id, NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'rider')::user_role,
    true, now()
  );
  RETURN NEW;
END;
$$;
```

**3. `src/i18n/en.json` & `src/i18n/fr.json`** — Add translation keys
- `auth.selectRole`, `auth.rider`, `auth.driver`

### UI Design
- Two pill-style buttons below the name field: 🚗 **Rider** | 🚙 **Driver**
- Matches existing glassmorphism card styling
- Admin role is not exposed in the signup UI (admin accounts are created manually)

