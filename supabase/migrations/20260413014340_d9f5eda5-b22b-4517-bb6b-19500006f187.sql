
-- 1. Harden profiles UPDATE RLS to prevent privilege escalation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
  AND commission_rate = (SELECT p.commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
  AND driver_balance_cents = (SELECT p.driver_balance_cents FROM public.profiles p WHERE p.user_id = auth.uid())
  AND standard_commission_rate = (SELECT p.standard_commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
  AND promo_commission_rate = (SELECT p.promo_commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- 2. Create server-side revenue aggregation function
CREATE OR REPLACE FUNCTION public.get_total_revenue()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(final_price), 0)
  FROM public.rides
  WHERE status = 'completed'
$$;

-- 3. Restrict proof-photos storage SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view proof photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view proof photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for proof-photos" ON storage.objects;

CREATE POLICY "Ride participants and admins can view proof photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'proof-photos'
  AND (
    has_role(auth.uid(), 'admin'::user_role)
    OR EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.proof_photo_url LIKE '%' || name || '%'
        AND (
          r.rider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
          OR r.driver_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
        )
    )
  )
);
