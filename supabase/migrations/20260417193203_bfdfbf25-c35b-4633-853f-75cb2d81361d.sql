-- 1. Add capability flags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_rider boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_driver boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_onboarding_complete boolean NOT NULL DEFAULT false;

-- 2. Backfill from existing role
UPDATE public.profiles
SET is_driver = true
WHERE role = 'driver' AND is_driver = false;

UPDATE public.profiles
SET is_rider = true
WHERE role IN ('rider', 'driver') AND is_rider = false;

-- Mark existing fully-set-up drivers as onboarding-complete
UPDATE public.profiles p
SET driver_onboarding_complete = true
WHERE p.role = 'driver'
  AND p.vehicle_type IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.verifications v
    WHERE v.driver_id = p.id
      AND v.document_type = 'drivers_license'
      AND v.status = 'approved'
  )
  AND EXISTS (
    SELECT 1 FROM public.verifications v
    WHERE v.driver_id = p.id
      AND v.document_type = 'vehicle_insurance'
      AND v.status = 'approved'
  )
  AND EXISTS (
    SELECT 1 FROM public.verifications v
    WHERE v.driver_id = p.id
      AND v.document_type = 'vehicle_registration'
      AND v.status = 'approved'
  );

-- 3. Update handle_new_user trigger to set flags from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _intent text := COALESCE(NEW.raw_user_meta_data->>'role', 'rider');
  _is_driver boolean := (_intent = 'driver');
BEGIN
  INSERT INTO public.profiles (
    id, user_id, full_name, phone, phone_verified,
    role, is_available, is_rider, is_driver, driver_onboarding_complete, created_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.phone,
    CASE WHEN NEW.phone IS NOT NULL AND NEW.phone != '' THEN true ELSE false END,
    -- Keep `role` as the user's primary/last-used role for backwards compatibility
    _intent::user_role,
    true,
    true,                  -- every account is rider-capable
    _is_driver,            -- driver-capable only if signup intent was driver
    false,
    now()
  );
  RETURN NEW;
END;
$function$;

-- 4. Relax the profile self-update guard so a user can opt into the driver
--    capability themselves (when they hit the driver signup link). The other
--    locked fields (role, commission_rate, driver_balance_cents,
--    standard_commission_rate, promo_commission_rate) stay locked.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
  AND commission_rate = (SELECT p.commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
  AND driver_balance_cents = (SELECT p.driver_balance_cents FROM public.profiles p WHERE p.user_id = auth.uid())
  AND standard_commission_rate = (SELECT p.standard_commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
  AND promo_commission_rate = (SELECT p.promo_commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
  -- driver_onboarding_complete is set server-side by admin verification flow, not by user
  AND driver_onboarding_complete = (SELECT p.driver_onboarding_complete FROM public.profiles p WHERE p.user_id = auth.uid())
);