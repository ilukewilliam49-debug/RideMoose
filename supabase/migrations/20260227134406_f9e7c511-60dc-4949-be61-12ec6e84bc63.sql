
-- Allow drivers to see requested rides (needed for dispatch)
CREATE POLICY "Drivers can view requested rides"
ON public.rides
FOR SELECT
USING (
  status = 'requested'
  AND has_role(auth.uid(), 'driver'::user_role)
);

-- Allow drivers to accept requested rides (update status + set driver_id)
CREATE POLICY "Drivers can accept requested rides"
ON public.rides
FOR UPDATE
USING (
  status = 'requested'
  AND has_role(auth.uid(), 'driver'::user_role)
);
