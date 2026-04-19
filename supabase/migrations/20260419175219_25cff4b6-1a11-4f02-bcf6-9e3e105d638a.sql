
-- 1. Add new capability + onboarding columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_business boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rider_onboarding_complete boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS business_onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_used_role text;

-- 2. Backfill business capability from approved org memberships
UPDATE public.profiles p
SET is_business = true,
    business_onboarding_complete = true
WHERE EXISTS (
  SELECT 1 FROM public.org_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = p.user_id AND o.status = 'approved'
);

-- 3. Heal orphaned role='driver' accounts (no verifications, never onboarded)
UPDATE public.profiles
SET role = 'rider'
WHERE role = 'driver'
  AND driver_onboarding_complete = false
  AND NOT EXISTS (SELECT 1 FROM public.verifications v WHERE v.driver_id = profiles.id);

-- 4. Rewrite handle_new_user: never write role=driver/business from intent.
--    Intent only flips the corresponding capability flag. Role stays 'rider'
--    for all new signups (admins are promoted manually).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _intent text := COALESCE(NEW.raw_user_meta_data->>'role', 'rider');
BEGIN
  INSERT INTO public.profiles (
    id, user_id, full_name, phone, phone_verified,
    role,
    is_rider, is_driver, is_business,
    rider_onboarding_complete, driver_onboarding_complete, business_onboarding_complete,
    last_used_role,
    is_available, created_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.phone,
    CASE WHEN NEW.phone IS NOT NULL AND NEW.phone <> '' THEN true ELSE false END,
    'rider'::user_role,
    true,
    (_intent = 'driver'),
    (_intent = 'business'),
    true,
    false,
    false,
    CASE WHEN _intent IN ('rider','driver','business') THEN _intent ELSE 'rider' END,
    true,
    now()
  );
  RETURN NEW;
END;
$$;

-- 5. Switch the two driver RLS policies on rides from has_role(_, 'driver')
--    to capability-based check (is_driver=true).
DROP POLICY IF EXISTS "Drivers can accept requested rides" ON public.rides;
CREATE POLICY "Drivers can accept requested rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  status = 'requested'::ride_status
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() AND profiles.is_driver = true
  )
)
WITH CHECK (
  status = 'accepted'::ride_status
  AND driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Drivers can view requested rides" ON public.rides;
CREATE POLICY "Drivers can view requested rides"
ON public.rides
FOR SELECT
USING (
  status = 'requested'::ride_status
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() AND profiles.is_driver = true
  )
);

-- 6. Extend the profile self-update lock so users can't grant themselves
--    business cap or flip onboarding-complete flags (admins still can via
--    the "Admins can update all profiles" policy).
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
  AND driver_onboarding_complete = (SELECT p.driver_onboarding_complete FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_business = (SELECT p.is_business FROM public.profiles p WHERE p.user_id = auth.uid())
  AND business_onboarding_complete = (SELECT p.business_onboarding_complete FROM public.profiles p WHERE p.user_id = auth.uid())
  AND rider_onboarding_complete = (SELECT p.rider_onboarding_complete FROM public.profiles p WHERE p.user_id = auth.uid())
);
