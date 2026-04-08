CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, full_name, phone, phone_verified, role, is_available, created_at)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.phone,
    CASE WHEN NEW.phone IS NOT NULL AND NEW.phone != '' THEN true ELSE false END,
    COALESCE(NEW.raw_user_meta_data->>'role', 'rider')::user_role,
    true,
    now()
  );
  RETURN NEW;
END;
$$;