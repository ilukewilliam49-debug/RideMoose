DROP POLICY IF EXISTS "Riders can cancel own rides" ON public.rides;

CREATE POLICY "Riders can cancel own rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  rider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND status IN ('requested', 'accepted')
)
WITH CHECK (
  status = 'cancelled'
  AND rider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  AND cancellation_fee_cents   = (SELECT r.cancellation_fee_cents   FROM public.rides r WHERE r.id = rides.id)
  AND tip_cents                = (SELECT r.tip_cents                FROM public.rides r WHERE r.id = rides.id)
  AND final_fare_cents         IS NOT DISTINCT FROM (SELECT r.final_fare_cents         FROM public.rides r WHERE r.id = rides.id)
  AND final_price              IS NOT DISTINCT FROM (SELECT r.final_price              FROM public.rides r WHERE r.id = rides.id)
  AND tax_cents                = (SELECT r.tax_cents                FROM public.rides r WHERE r.id = rides.id)
  AND service_fee_cents        = (SELECT r.service_fee_cents        FROM public.rides r WHERE r.id = rides.id)
  AND commission_cents         = (SELECT r.commission_cents         FROM public.rides r WHERE r.id = rides.id)
  AND stripe_fee_cents         = (SELECT r.stripe_fee_cents         FROM public.rides r WHERE r.id = rides.id)
  AND driver_earnings_cents    = (SELECT r.driver_earnings_cents    FROM public.rides r WHERE r.id = rides.id)
  AND captured_amount_cents    IS NOT DISTINCT FROM (SELECT r.captured_amount_cents    FROM public.rides r WHERE r.id = rides.id)
  AND outstanding_amount_cents IS NOT DISTINCT FROM (SELECT r.outstanding_amount_cents FROM public.rides r WHERE r.id = rides.id)
  AND authorized_amount_cents  IS NOT DISTINCT FROM (SELECT r.authorized_amount_cents  FROM public.rides r WHERE r.id = rides.id)
  AND stripe_payment_intent_id IS NOT DISTINCT FROM (SELECT r.stripe_payment_intent_id FROM public.rides r WHERE r.id = rides.id)
  AND payment_status           = (SELECT r.payment_status           FROM public.rides r WHERE r.id = rides.id)
  AND driver_id                IS NOT DISTINCT FROM (SELECT r.driver_id                FROM public.rides r WHERE r.id = rides.id)
  AND distance_km              IS NOT DISTINCT FROM (SELECT r.distance_km              FROM public.rides r WHERE r.id = rides.id)
  AND waiting_min              = (SELECT r.waiting_min              FROM public.rides r WHERE r.id = rides.id)
);