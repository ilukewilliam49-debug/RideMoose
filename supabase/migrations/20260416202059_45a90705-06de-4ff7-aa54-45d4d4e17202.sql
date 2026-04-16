UPDATE public.profiles
SET role = 'driver'::user_role,
    is_available = false,
    updated_at = now()
WHERE role = 'rider'
  AND user_id IN (
    SELECT id FROM auth.users WHERE email ILIKE 'hybronx@gmail.com'
  );