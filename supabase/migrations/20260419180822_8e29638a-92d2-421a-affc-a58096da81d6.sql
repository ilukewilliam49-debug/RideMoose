
-- 1. Harden driver_can_serve to require is_driver capability
CREATE OR REPLACE FUNCTION public.driver_can_serve(_user_id uuid, _service service_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND is_driver = true
      AND CASE _service::text
        WHEN 'taxi' THEN can_taxi
        WHEN 'private_hire' THEN can_private_hire
        WHEN 'courier' THEN can_courier
        WHEN 'retail_delivery' THEN can_courier
        WHEN 'personal_shopper' THEN can_courier
        WHEN 'large_delivery' THEN (vehicle_type IN ('SUV', 'truck', 'van'))
        ELSE can_shuttle
      END
  )
$function$;

-- 2. Update auto_offline_stale_drivers to use is_driver capability
CREATE OR REPLACE FUNCTION public.auto_offline_stale_drivers()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _affected integer;
BEGIN
  UPDATE public.profiles
  SET is_available = false,
      went_online_at = NULL
  WHERE is_driver = true
    AND is_available = true
    AND (last_seen_at IS NULL OR last_seen_at < now() - interval '3 minutes')
    AND (went_online_at IS NULL OR went_online_at < now() - interval '3 minutes');
  GET DIAGNOSTICS _affected = ROW_COUNT;
  RETURN _affected;
END;
$function$;

-- 3. Default can_taxi to false going forward — this should only be enabled
-- after a driver completes onboarding and is approved.
ALTER TABLE public.profiles ALTER COLUMN can_taxi SET DEFAULT false;

-- 4. Backfill: clear can_taxi for non-driver profiles to remove privilege creep
UPDATE public.profiles
SET can_taxi = false
WHERE is_driver = false
  AND can_taxi = true;

-- 5. One-off cleanup for hybronx@gmail.com — they signed in with driver intent
-- accidentally; reset their primary identity to rider and clear driver
-- capability so they get the rider experience by default.
UPDATE public.profiles
SET role = 'rider'::user_role,
    is_driver = false,
    driver_onboarding_complete = false,
    last_used_role = 'rider',
    can_taxi = false
WHERE user_id = '12b3372c-902d-4d0e-8b74-aef268d6dc1c';
