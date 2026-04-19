
-- 1. New enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Backfill admins from profiles.role before dropping the column
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::public.app_role
FROM public.profiles
WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- 3. New canonical security-definer check
CREATE OR REPLACE FUNCTION public.has_app_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS on user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_app_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_app_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_app_role(auth.uid(), 'admin'));

-- 5. Loosen profiles UPDATE policy: drop the role-pinning constraint
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND commission_rate = (SELECT p.commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
    AND driver_balance_cents = (SELECT p.driver_balance_cents FROM public.profiles p WHERE p.user_id = auth.uid())
    AND standard_commission_rate = (SELECT p.standard_commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
    AND promo_commission_rate = (SELECT p.promo_commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
    AND driver_onboarding_complete = (SELECT p.driver_onboarding_complete FROM public.profiles p WHERE p.user_id = auth.uid())
    AND is_business = (SELECT p.is_business FROM public.profiles p WHERE p.user_id = auth.uid())
    AND business_onboarding_complete = (SELECT p.business_onboarding_complete FROM public.profiles p WHERE p.user_id = auth.uid())
    AND rider_onboarding_complete = (SELECT p.rider_onboarding_complete FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- 6. Update handle_new_user — stop writing the role column
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _intent text := COALESCE(NEW.raw_user_meta_data->>'role', 'rider');
BEGIN
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
    (_intent = 'business'),
    true, false, false,
    CASE WHEN _intent IN ('rider','driver','business') THEN _intent ELSE 'rider' END,
    true, now()
  );
  RETURN NEW;
END;
$function$;

-- 7. CASCADE drop the legacy function (auto-drops 34 dependent policies)
DROP FUNCTION public.has_role(uuid, public.user_role) CASCADE;

-- 8. Drop the column and the legacy enum
ALTER TABLE public.profiles DROP COLUMN role;
DROP TYPE public.user_role;

-- 9. Recreate has_role under its original name with the new app_role signature.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_app_role(_user_id, _role)
$$;

-- 10. Recreate authorize_realtime_channel against the new signature
CREATE OR REPLACE FUNCTION public.authorize_realtime_channel(_channel text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'admin'::public.app_role) THEN true
    WHEN _channel LIKE 'ride-%' THEN EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id::text = substring(_channel from 'ride-(.+)')
        AND (
          r.rider_id IN (SELECT id FROM public.profiles WHERE user_id = _user_id)
          OR r.driver_id IN (SELECT id FROM public.profiles WHERE user_id = _user_id)
        )
    )
    WHEN _channel LIKE 'notifications-%' THEN EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = _user_id
        AND p.id::text = substring(_channel from 'notifications-(.+)')
    )
    ELSE false
  END
$$;

-- 11. Recreate all 29 table policies dropped by CASCADE.
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all rides" ON public.rides
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all rides" ON public.rides
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all verifications" ON public.verifications
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update verifications" ON public.verifications
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage taxi rates" ON public.taxi_rates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage zones" ON public.private_hire_zones
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can read all zones" ON public.private_hire_zones
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all messages" ON public.ride_messages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage geo zones" ON public.geo_zones
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage pricing config" ON public.pricing_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all ratings" ON public.ride_ratings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage service pricing" ON public.service_pricing
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage organizations" ON public.organizations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage org members" ON public.org_members
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage invoices" ON public.invoices
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage applications" ON public.organization_applications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage config" ON public.platform_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all bids" ON public.delivery_bids
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all notifications" ON public.notifications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all support conversations" ON public.support_conversations
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all reactions" ON public.ride_message_reactions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all shift sessions" ON public.shift_sessions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all payout requests" ON public.payout_requests
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage notification logs" ON public.notification_logs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage ride events" ON public.ride_events
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 12. Recreate the 5 storage.objects policies
CREATE POLICY "Admins read all proof-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'proof-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all voice-messages" ON storage.objects
  FOR SELECT USING (bucket_id = 'voice-messages' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all chat-images" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read all avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Ride participants and admins can view proof photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'proof-photos' AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.rides r
        WHERE r.proof_photo_url LIKE ('%' || objects.name || '%')
          AND (
            r.rider_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
            OR r.driver_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          )
      )
    )
  );
