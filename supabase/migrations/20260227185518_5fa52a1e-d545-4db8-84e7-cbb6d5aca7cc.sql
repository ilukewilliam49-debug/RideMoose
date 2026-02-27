-- Allow riders to cancel their own rides (only when status is requested or accepted)
CREATE POLICY "Riders can cancel own rides"
ON public.rides
FOR UPDATE
USING (
  rider_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND status IN ('requested', 'accepted')
)
WITH CHECK (
  status = 'cancelled'
);