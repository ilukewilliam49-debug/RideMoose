-- Harden driver UPDATE policy for arrived rides.
-- Previously: "Drivers can update arrived rides" had no WITH CHECK, allowing
-- a driver to mutate financial columns (final_fare_cents, tip_cents,
-- distance_km, cancellation_fee_cents, etc.) via PostgREST while the ride
-- was in the 'arrived' state. Edge Functions remain the only legitimate
-- writer for those fields (running with service_role and bypassing RLS).
--
-- This migration replaces that policy with one that:
--   * Restricts the post-update status to 'arrived' or 'in_progress'
--     (the only legitimate driver-side transition from 'arrived').
--   * Pins every financial / commission / payment column to its prior
--     value via OLD = NEW comparisons in WITH CHECK, so any client
--     attempt to alter them is rejected by Postgres.
--   * Pins immutable identity fields (rider_id, driver_id, service_type,
--     pricing_model, billed_to, organization_id, addresses/coords,
--     guest fields, stops) so a driver cannot reassign the ride either.

DROP POLICY IF EXISTS "Drivers can update arrived rides" ON public.rides;

CREATE POLICY "Drivers can update arrived rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  status = 'arrived'::ride_status
  AND driver_id IN (
    SELECT profiles.id FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Status may only stay 'arrived' or advance to 'in_progress'
  status IN ('arrived'::ride_status, 'in_progress'::ride_status)
  AND driver_id IN (
    SELECT profiles.id FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
  -- Financial columns: locked to server-side (Edge Function) writes only
  AND final_fare_cents IS NOT DISTINCT FROM (SELECT r.final_fare_cents FROM public.rides r WHERE r.id = rides.id)
  AND final_price IS NOT DISTINCT FROM (SELECT r.final_price FROM public.rides r WHERE r.id = rides.id)
  AND estimated_price IS NOT DISTINCT FROM (SELECT r.estimated_price FROM public.rides r WHERE r.id = rides.id)
  AND tip_cents IS NOT DISTINCT FROM (SELECT r.tip_cents FROM public.rides r WHERE r.id = rides.id)
  AND tax_cents IS NOT DISTINCT FROM (SELECT r.tax_cents FROM public.rides r WHERE r.id = rides.id)
  AND cancellation_fee_cents IS NOT DISTINCT FROM (SELECT r.cancellation_fee_cents FROM public.rides r WHERE r.id = rides.id)
  AND commission_cents IS NOT DISTINCT FROM (SELECT r.commission_cents FROM public.rides r WHERE r.id = rides.id)
  AND driver_earnings_cents IS NOT DISTINCT FROM (SELECT r.driver_earnings_cents FROM public.rides r WHERE r.id = rides.id)
  AND service_fee_cents IS NOT DISTINCT FROM (SELECT r.service_fee_cents FROM public.rides r WHERE r.id = rides.id)
  AND stripe_fee_cents IS NOT DISTINCT FROM (SELECT r.stripe_fee_cents FROM public.rides r WHERE r.id = rides.id)
  AND pickyou_surcharge_cents IS NOT DISTINCT FROM (SELECT r.pickyou_surcharge_cents FROM public.rides r WHERE r.id = rides.id)
  AND captured_amount_cents IS NOT DISTINCT FROM (SELECT r.captured_amount_cents FROM public.rides r WHERE r.id = rides.id)
  AND authorized_amount_cents IS NOT DISTINCT FROM (SELECT r.authorized_amount_cents FROM public.rides r WHERE r.id = rides.id)
  AND overage_cents IS NOT DISTINCT FROM (SELECT r.overage_cents FROM public.rides r WHERE r.id = rides.id)
  AND overage_client_secret IS NOT DISTINCT FROM (SELECT r.overage_client_secret FROM public.rides r WHERE r.id = rides.id)
  AND outstanding_amount_cents IS NOT DISTINCT FROM (SELECT r.outstanding_amount_cents FROM public.rides r WHERE r.id = rides.id)
  AND outstanding_reason IS NOT DISTINCT FROM (SELECT r.outstanding_reason FROM public.rides r WHERE r.id = rides.id)
  AND distance_km IS NOT DISTINCT FROM (SELECT r.distance_km FROM public.rides r WHERE r.id = rides.id)
  AND duration_min IS NOT DISTINCT FROM (SELECT r.duration_min FROM public.rides r WHERE r.id = rides.id)
  AND waiting_min IS NOT DISTINCT FROM (SELECT r.waiting_min FROM public.rides r WHERE r.id = rides.id)
  AND payment_status IS NOT DISTINCT FROM (SELECT r.payment_status FROM public.rides r WHERE r.id = rides.id)
  AND payment_option IS NOT DISTINCT FROM (SELECT r.payment_option FROM public.rides r WHERE r.id = rides.id)
  AND stripe_payment_intent_id IS NOT DISTINCT FROM (SELECT r.stripe_payment_intent_id FROM public.rides r WHERE r.id = rides.id)
  AND paid_at IS NOT DISTINCT FROM (SELECT r.paid_at FROM public.rides r WHERE r.id = rides.id)
  AND invoiced IS NOT DISTINCT FROM (SELECT r.invoiced FROM public.rides r WHERE r.id = rides.id)
  AND invoice_id IS NOT DISTINCT FROM (SELECT r.invoice_id FROM public.rides r WHERE r.id = rides.id)
  AND price_increase_count IS NOT DISTINCT FROM (SELECT r.price_increase_count FROM public.rides r WHERE r.id = rides.id)
  AND pricing_model IS NOT DISTINCT FROM (SELECT r.pricing_model FROM public.rides r WHERE r.id = rides.id)
  AND billed_to IS NOT DISTINCT FROM (SELECT r.billed_to FROM public.rides r WHERE r.id = rides.id)
  AND organization_id IS NOT DISTINCT FROM (SELECT r.organization_id FROM public.rides r WHERE r.id = rides.id)
  -- Identity / immutable trip definition: drivers cannot reassign or rewrite trip
  AND rider_id IS NOT DISTINCT FROM (SELECT r.rider_id FROM public.rides r WHERE r.id = rides.id)
  AND service_type IS NOT DISTINCT FROM (SELECT r.service_type FROM public.rides r WHERE r.id = rides.id)
  AND pickup_address IS NOT DISTINCT FROM (SELECT r.pickup_address FROM public.rides r WHERE r.id = rides.id)
  AND dropoff_address IS NOT DISTINCT FROM (SELECT r.dropoff_address FROM public.rides r WHERE r.id = rides.id)
  AND pickup_lat IS NOT DISTINCT FROM (SELECT r.pickup_lat FROM public.rides r WHERE r.id = rides.id)
  AND pickup_lng IS NOT DISTINCT FROM (SELECT r.pickup_lng FROM public.rides r WHERE r.id = rides.id)
  AND dropoff_lat IS NOT DISTINCT FROM (SELECT r.dropoff_lat FROM public.rides r WHERE r.id = rides.id)
  AND dropoff_lng IS NOT DISTINCT FROM (SELECT r.dropoff_lng FROM public.rides r WHERE r.id = rides.id)
  AND stops IS NOT DISTINCT FROM (SELECT r.stops FROM public.rides r WHERE r.id = rides.id)
  AND scheduled_at IS NOT DISTINCT FROM (SELECT r.scheduled_at FROM public.rides r WHERE r.id = rides.id)
  AND booking_for IS NOT DISTINCT FROM (SELECT r.booking_for FROM public.rides r WHERE r.id = rides.id)
  AND guest_name IS NOT DISTINCT FROM (SELECT r.guest_name FROM public.rides r WHERE r.id = rides.id)
  AND guest_phone IS NOT DISTINCT FROM (SELECT r.guest_phone FROM public.rides r WHERE r.id = rides.id)
  AND passenger_count IS NOT DISTINCT FROM (SELECT r.passenger_count FROM public.rides r WHERE r.id = rides.id)
  AND created_at IS NOT DISTINCT FROM (SELECT r.created_at FROM public.rides r WHERE r.id = rides.id)
  AND completed_at IS NOT DISTINCT FROM (SELECT r.completed_at FROM public.rides r WHERE r.id = rides.id)
  AND cancellation_reason IS NOT DISTINCT FROM (SELECT r.cancellation_reason FROM public.rides r WHERE r.id = rides.id)
);

COMMENT ON POLICY "Drivers can update arrived rides" ON public.rides IS
  'Allows drivers to advance an arrived ride to in_progress (or update operational fields like meter_started_at, started_at, meter_status, pickup_notes, proof_photo_url, updated_at). All financial, payment, identity, and trip-definition columns are pinned via WITH CHECK so they can only be written by Edge Functions running under the service_role.';
