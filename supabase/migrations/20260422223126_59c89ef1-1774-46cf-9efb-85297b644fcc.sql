-- Test-only seed helper. Allowed ONLY for testdriver@pickyou.test.
CREATE OR REPLACE FUNCTION public._test_seed_lifecycle_ride(
  _driver_id uuid,
  _service_type service_type,
  _status ride_status
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _rider_id uuid;
  _new_id uuid;
BEGIN
  -- Restrict to test account ONLY
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL OR _email <> 'testdriver@pickyou.test' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Find an idle rider (no active ride)
  SELECT p.id INTO _rider_id
    FROM public.profiles p
   WHERE p.is_rider = true
     AND NOT EXISTS (
       SELECT 1 FROM public.rides r
        WHERE r.rider_id = p.id
          AND r.status IN ('requested','accepted','arrived','in_progress')
     )
   LIMIT 1;

  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'No idle rider available';
  END IF;

  INSERT INTO public.rides (
    rider_id, driver_id, status, service_type,
    pickup_address, dropoff_address,
    pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
    payment_option, pricing_model
  ) VALUES (
    _rider_id, _driver_id, _status, _service_type,
    'TEST PICKUP', 'TEST DROPOFF',
    62.454, -114.371, 62.46, -114.38,
    'in_app', 'metered'
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public._test_seed_lifecycle_ride(uuid, service_type, ride_status) FROM public;
GRANT EXECUTE ON FUNCTION public._test_seed_lifecycle_ride(uuid, service_type, ride_status) TO authenticated;

-- Test-only cleanup helper. Allowed ONLY for testdriver@pickyou.test.
CREATE OR REPLACE FUNCTION public._test_cleanup_lifecycle_ride(_ride_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _pickup text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL OR _email <> 'testdriver@pickyou.test' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Extra safety: only delete rides we seeded (pickup_address sentinel)
  SELECT pickup_address INTO _pickup FROM public.rides WHERE id = _ride_id;
  IF _pickup IS NULL OR _pickup <> 'TEST PICKUP' THEN
    RAISE EXCEPTION 'Refusing to delete non-test ride';
  END IF;

  DELETE FROM public.ride_events WHERE ride_id = _ride_id;
  DELETE FROM public.rides WHERE id = _ride_id;
END;
$$;

REVOKE ALL ON FUNCTION public._test_cleanup_lifecycle_ride(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public._test_cleanup_lifecycle_ride(uuid) TO authenticated;