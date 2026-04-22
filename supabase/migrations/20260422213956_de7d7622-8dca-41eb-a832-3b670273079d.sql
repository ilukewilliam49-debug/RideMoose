-- ─────────────────────────────────────────────────────────────────────────────
-- 12-hour driver hours-of-service cap (regulatory / safety)
--
-- 1. Helper: returns true if the driver's currently-open shift (if any)
--    has been running ≤ 12 hours. Used by accept_ride and the reaper.
-- 2. accept_ride() updated to reject ride acceptance once the cap is hit,
--    forcing the driver to log off and rest.
-- 3. auto_offline_overdue_shifts(): cron-friendly reaper that flips drivers
--    offline and closes their shift_session row once they exceed 12 hours.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.driver_shift_within_limit(_driver_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.shift_sessions
    WHERE driver_id = _driver_profile_id
      AND ended_at IS NULL
      AND started_at < now() - interval '12 hours'
  );
$$;

-- Update accept_ride to enforce the cap.
CREATE OR REPLACE FUNCTION public.accept_ride(_ride_id uuid, _driver_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ride rides%ROWTYPE;
  _driver_available boolean;
  _within_limit boolean;
BEGIN
  SELECT is_available INTO _driver_available
  FROM profiles WHERE id = _driver_profile_id;

  IF _driver_available IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'reason', 'driver_offline');
  END IF;

  -- ENFORCE 12-HOUR HOURS-OF-SERVICE CAP
  SELECT public.driver_shift_within_limit(_driver_profile_id) INTO _within_limit;
  IF _within_limit IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'reason', 'shift_limit_exceeded');
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
$$;

-- Reaper: flips overdue drivers offline and closes their open shift.
CREATE OR REPLACE FUNCTION public.auto_offline_overdue_shifts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _affected integer := 0;
BEGIN
  -- Close shift_sessions older than 12 hours that are still open.
  WITH closed AS (
    UPDATE public.shift_sessions
       SET ended_at = now()
     WHERE ended_at IS NULL
       AND started_at < now() - interval '12 hours'
    RETURNING driver_id
  )
  UPDATE public.profiles p
     SET is_available = false,
         went_online_at = NULL
    FROM closed c
   WHERE p.id = c.driver_id
     AND p.is_driver = true;

  GET DIAGNOSTICS _affected = ROW_COUNT;
  RETURN _affected;
END;
$$;

COMMENT ON FUNCTION public.driver_shift_within_limit IS
  '12-hour hours-of-service cap. Returns false if driver has an open shift_sessions row started more than 12 hours ago.';
COMMENT ON FUNCTION public.auto_offline_overdue_shifts IS
  'Reaper: closes shift_sessions older than 12 hours and forces the driver offline. Safe to run on a cron every 1–5 minutes.';
