
-- 1. Drop overly broad storage SELECT policies
DROP POLICY IF EXISTS "Anyone can read voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read chat images" ON storage.objects;

-- 2. Tighten driver ride acceptance policy
DROP POLICY IF EXISTS "Drivers can accept requested rides" ON public.rides;
CREATE POLICY "Drivers can accept requested rides"
  ON public.rides
  FOR UPDATE
  TO authenticated
  USING (
    status = 'requested'::ride_status
    AND has_role(auth.uid(), 'driver'::user_role)
  )
  WITH CHECK (
    status = 'accepted'::ride_status
    AND driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- 3. Tighten rider bid update policy
DROP POLICY IF EXISTS "Riders can update bids on own rides" ON public.delivery_bids;
CREATE POLICY "Riders can update bids on own rides"
  ON public.delivery_bids
  FOR UPDATE
  TO authenticated
  USING (
    ride_id IN (
      SELECT r.id FROM rides r
      WHERE r.rider_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
    )
  )
  WITH CHECK (
    status IN ('accepted', 'rejected')
  );
