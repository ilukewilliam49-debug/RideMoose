
-- Allow drivers to cancel rides they've accepted (before starting)
CREATE POLICY "Drivers can cancel accepted rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND status = 'accepted'
)
WITH CHECK (
  status = 'cancelled'
  AND cancellation_reason IS NOT NULL
);
