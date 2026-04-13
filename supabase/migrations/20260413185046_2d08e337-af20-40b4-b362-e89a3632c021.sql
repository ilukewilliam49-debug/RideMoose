
-- Atomic ride acceptance function to prevent race conditions
CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id uuid, _driver_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ride rides%ROWTYPE;
BEGIN
  -- Lock the ride row and check status atomically
  SELECT * INTO _ride
  FROM rides
  WHERE id = _ride_id
  FOR UPDATE SKIP LOCKED;

  -- If we couldn't lock (another transaction has it), fail
  IF _ride.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ride_locked');
  END IF;

  -- Only accept if still in requested or dispatched state
  IF _ride.status NOT IN ('requested', 'dispatched') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_taken');
  END IF;

  -- If dispatched, only the dispatched driver can accept
  IF _ride.status = 'dispatched' AND _ride.dispatched_to_driver_id IS NOT NULL 
     AND _ride.dispatched_to_driver_id != _driver_profile_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'dispatched_to_other');
  END IF;

  -- Atomically update
  UPDATE rides
  SET status = 'accepted',
      driver_id = _driver_profile_id,
      dispatched_to_driver_id = NULL,
      dispatch_expires_at = NULL,
      updated_at = now()
  WHERE id = _ride_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
