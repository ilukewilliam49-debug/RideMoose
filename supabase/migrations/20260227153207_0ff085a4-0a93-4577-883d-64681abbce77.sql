
-- The ALL policy already covers DELETE for admins, but we need to allow admins to read ALL zones (not just active)
CREATE POLICY "Admins can read all zones"
  ON public.private_hire_zones FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));
