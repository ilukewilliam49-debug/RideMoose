-- Replace the broad "Drivers can update assigned rides" policy with a column-restricted variant.
-- Drivers may still update operational fields (status, meter timestamps, distance_km, waiting_min, proof_photo_url, notes)
-- but NOT financial columns. Financial columns are only writable via SECURITY DEFINER edge functions
-- (capture-payment, complete-ride) running with the service role.

DROP POLICY IF EXISTS "Drivers can update assigned rides" ON public.rides;

CREATE POLICY "Drivers can update operational fields on assigned rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  driver_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
)
WITH CHECK (
  driver_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
  -- Lock all financial columns: drivers cannot modify these via direct UPDATE.
  AND final_fare_cents             IS NOT DISTINCT FROM (SELECT r.final_fare_cents             FROM public.rides r WHERE r.id = rides.id)
  AND final_price                  IS NOT DISTINCT FROM (SELECT r.final_price                  FROM public.rides r WHERE r.id = rides.id)
  AND tax_cents                    IS NOT DISTINCT FROM (SELECT r.tax_cents                    FROM public.rides r WHERE r.id = rides.id)
  AND service_fee_cents            IS NOT DISTINCT FROM (SELECT r.service_fee_cents            FROM public.rides r WHERE r.id = rides.id)
  AND commission_cents             IS NOT DISTINCT FROM (SELECT r.commission_cents             FROM public.rides r WHERE r.id = rides.id)
  AND stripe_fee_cents             IS NOT DISTINCT FROM (SELECT r.stripe_fee_cents             FROM public.rides r WHERE r.id = rides.id)
  AND driver_earnings_cents        IS NOT DISTINCT FROM (SELECT r.driver_earnings_cents        FROM public.rides r WHERE r.id = rides.id)
  AND captured_amount_cents        IS NOT DISTINCT FROM (SELECT r.captured_amount_cents        FROM public.rides r WHERE r.id = rides.id)
  AND outstanding_amount_cents     IS NOT DISTINCT FROM (SELECT r.outstanding_amount_cents     FROM public.rides r WHERE r.id = rides.id)
  AND authorized_amount_cents      IS NOT DISTINCT FROM (SELECT r.authorized_amount_cents      FROM public.rides r WHERE r.id = rides.id)
  AND stripe_payment_intent_id     IS NOT DISTINCT FROM (SELECT r.stripe_payment_intent_id     FROM public.rides r WHERE r.id = rides.id)
  AND payment_status               IS NOT DISTINCT FROM (SELECT r.payment_status               FROM public.rides r WHERE r.id = rides.id)
  AND organization_id              IS NOT DISTINCT FROM (SELECT r.organization_id              FROM public.rides r WHERE r.id = rides.id)
  AND billed_to                    IS NOT DISTINCT FROM (SELECT r.billed_to                    FROM public.rides r WHERE r.id = rides.id)
  AND rider_id                     IS NOT DISTINCT FROM (SELECT r.rider_id                     FROM public.rides r WHERE r.id = rides.id)
);

-- Re-create the more specific "Drivers can update arrived rides" policy (already permissive enough).
-- The "Drivers can accept requested rides" and "Drivers can cancel accepted or arrived rides"
-- policies already have narrow WITH CHECK clauses that don't allow setting financial fields.