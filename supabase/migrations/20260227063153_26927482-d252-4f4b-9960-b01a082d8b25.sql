
-- Fix rides policies: drop restrictive, recreate as permissive
DROP POLICY IF EXISTS "Riders can view own rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can view assigned rides" ON public.rides;
DROP POLICY IF EXISTS "Admins can view all rides" ON public.rides;
DROP POLICY IF EXISTS "Riders can create rides" ON public.rides;
DROP POLICY IF EXISTS "Drivers can update assigned rides" ON public.rides;
DROP POLICY IF EXISTS "Admins can update all rides" ON public.rides;

CREATE POLICY "Riders can view own rides" ON public.rides FOR SELECT TO authenticated
USING (rider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Drivers can view assigned rides" ON public.rides FOR SELECT TO authenticated
USING (driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all rides" ON public.rides FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role));

CREATE POLICY "Riders can create rides" ON public.rides FOR INSERT TO authenticated
WITH CHECK (rider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Drivers can update assigned rides" ON public.rides FOR UPDATE TO authenticated
USING (driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update all rides" ON public.rides FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role));

-- Fix verifications policies
DROP POLICY IF EXISTS "Drivers can view own verifications" ON public.verifications;
DROP POLICY IF EXISTS "Admins can view all verifications" ON public.verifications;
DROP POLICY IF EXISTS "Drivers can insert own verifications" ON public.verifications;
DROP POLICY IF EXISTS "Admins can update verifications" ON public.verifications;

CREATE POLICY "Drivers can view own verifications" ON public.verifications FOR SELECT TO authenticated
USING (driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all verifications" ON public.verifications FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role));

CREATE POLICY "Drivers can insert own verifications" ON public.verifications FOR INSERT TO authenticated
WITH CHECK (driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update verifications" ON public.verifications FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'::user_role));
