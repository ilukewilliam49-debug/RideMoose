-- Add dispatch tracking columns to rides
ALTER TABLE public.rides
  ADD COLUMN dispatched_to_driver_id uuid REFERENCES public.profiles(id),
  ADD COLUMN dispatch_expires_at timestamptz;

-- Allow drivers to see rides dispatched specifically to them
CREATE POLICY "Drivers can view rides dispatched to them"
  ON public.rides
  FOR SELECT
  TO authenticated
  USING (
    dispatched_to_driver_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );