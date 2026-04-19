CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _intent text := COALESCE(NEW.raw_user_meta_data->>'role', 'rider');
BEGIN
  -- SECURITY: is_business is admin-approval gated and must never be set
  -- from user-controlled signup metadata. Only is_rider and is_driver can
  -- be self-provisioned.
  INSERT INTO public.profiles (
    id, user_id, full_name, phone, phone_verified,
    is_rider, is_driver, is_business,
    rider_onboarding_complete, driver_onboarding_complete, business_onboarding_complete,
    last_used_role, is_available, created_at
  )
  VALUES (
    NEW.id, NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.phone,
    CASE WHEN NEW.phone IS NOT NULL AND NEW.phone <> '' THEN true ELSE false END,
    true,
    (_intent = 'driver'),
    false,  -- is_business: NEVER granted from signup metadata
    true, false, false,
    CASE WHEN _intent IN ('rider','driver') THEN _intent ELSE 'rider' END,
    true, now()
  );
  RETURN NEW;
END;
$function$;