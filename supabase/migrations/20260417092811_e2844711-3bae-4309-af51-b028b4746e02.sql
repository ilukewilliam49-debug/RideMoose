-- 1. Add last_seen_at to profiles for heartbeat-based stale detection
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_driver_online_seen
  ON public.profiles (role, is_available, last_seen_at)
  WHERE role = 'driver' AND is_available = true;

-- 2. Auto-update last_seen_at whenever the driver's location changes
CREATE OR REPLACE FUNCTION public.touch_driver_last_seen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.latitude IS DISTINCT FROM OLD.latitude
     OR NEW.longitude IS DISTINCT FROM OLD.longitude THEN
    NEW.last_seen_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_driver_last_seen ON public.profiles;
CREATE TRIGGER trg_touch_driver_last_seen
  BEFORE UPDATE OF latitude, longitude ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_driver_last_seen();

-- 3. Auto-offline drivers who haven't checked in for 3 minutes
CREATE OR REPLACE FUNCTION public.auto_offline_stale_drivers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _affected integer;
BEGIN
  UPDATE public.profiles
  SET is_available = false,
      went_online_at = NULL
  WHERE role = 'driver'
    AND is_available = true
    AND (last_seen_at IS NULL OR last_seen_at < now() - interval '3 minutes')
    AND (went_online_at IS NULL OR went_online_at < now() - interval '3 minutes');
  GET DIAGNOSTICS _affected = ROW_COUNT;
  RETURN _affected;
END;
$$;

-- 4. Schedule cleanup every minute via pg_cron if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-offline-stale-drivers') THEN
      PERFORM cron.unschedule('auto-offline-stale-drivers');
    END IF;
    PERFORM cron.schedule(
      'auto-offline-stale-drivers',
      '* * * * *',
      $cron$ SELECT public.auto_offline_stale_drivers(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not configured: %', SQLERRM;
END $$;

-- 5. Update notify_ride_status_change trigger to fire on INSERT for new requests
CREATE OR REPLACE FUNCTION public.notify_ride_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event text;
  _supabase_url text;
  _service_key text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'requested' THEN
    _event := 'requested';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
      _event := 'accepted';
    ELSIF OLD.status = 'accepted' AND NEW.status = 'arrived' THEN
      _event := 'arrived';
    ELSIF NEW.status = 'in_progress' AND OLD.status IN ('accepted', 'arrived') THEN
      _event := 'started';
    ELSIF OLD.status != 'completed' AND NEW.status = 'completed' THEN
      _event := 'completed';
    ELSIF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
      _event := 'cancelled';
    END IF;
  END IF;

  IF _event IS NOT NULL THEN
    _supabase_url := coalesce(
      nullif(current_setting('app.settings.supabase_url', true), ''),
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1)
    );
    _service_key := coalesce(
      nullif(current_setting('app.settings.service_role_key', true), ''),
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    );

    IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        ),
        body := jsonb_build_object(
          'mode', 'ride_event',
          'ride_id', NEW.id::text,
          'event', _event
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger is wired up on the rides table
DROP TRIGGER IF EXISTS trg_notify_ride_status_change ON public.rides;
CREATE TRIGGER trg_notify_ride_status_change
  AFTER INSERT OR UPDATE OF status ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ride_status_change();