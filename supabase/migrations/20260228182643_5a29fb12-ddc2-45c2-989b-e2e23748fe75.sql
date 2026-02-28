
-- Allow drivers to delete their own pending bids (withdraw)
CREATE POLICY "Drivers can delete own pending bids"
ON public.delivery_bids FOR DELETE
USING (
  status = 'pending'
  AND driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Allow drivers to update their own pending bids (change amount)
CREATE POLICY "Drivers can update own pending bids"
ON public.delivery_bids FOR UPDATE
USING (
  status = 'pending'
  AND driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
