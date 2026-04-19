-- 1) Harden accept_ride: reject if dispatch window expired
CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id uuid, _driver_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ride rides%ROWTYPE;
  _driver_available boolean;
BEGIN
  SELECT is_available INTO _driver_available
  FROM profiles WHERE id = _driver_profile_id;

  IF _driver_available IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'reason', 'driver_offline');
  END IF;

  SELECT * INTO _ride
  FROM rides
  WHERE id = _ride_id
  FOR UPDATE SKIP LOCKED;

  IF _ride.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'ride_locked');
  END IF;

  IF _ride.status NOT IN ('requested', 'dispatched') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_taken');
  END IF;

  IF _ride.status = 'dispatched' AND _ride.dispatched_to_driver_id IS NOT NULL
     AND _ride.dispatched_to_driver_id != _driver_profile_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'dispatched_to_other');
  END IF;

  -- New: enforce dispatch expiry window
  IF _ride.status = 'dispatched' AND _ride.dispatch_expires_at IS NOT NULL
     AND _ride.dispatch_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'reason', 'dispatch_expired');
  END IF;

  UPDATE rides
  SET status = 'accepted',
      driver_id = _driver_profile_id,
      dispatched_to_driver_id = NULL,
      dispatch_expires_at = NULL,
      updated_at = now()
  WHERE id = _ride_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 2) Allow drivers to cancel arrived rides too (rider no-show etc.)
DROP POLICY IF EXISTS "Drivers can cancel accepted rides" ON public.rides;
CREATE POLICY "Drivers can cancel accepted or arrived rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  driver_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
  AND status IN ('accepted'::ride_status, 'arrived'::ride_status)
)
WITH CHECK (
  status = 'cancelled'::ride_status
  AND cancellation_reason IS NOT NULL
);

-- 3) Driver heartbeat fallback when GPS denied — refreshes last_seen_at only
CREATE OR REPLACE FUNCTION public.touch_driver_seen()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
     SET last_seen_at = now()
   WHERE user_id = auth.uid()
     AND is_driver = true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.touch_driver_seen() TO authenticated;