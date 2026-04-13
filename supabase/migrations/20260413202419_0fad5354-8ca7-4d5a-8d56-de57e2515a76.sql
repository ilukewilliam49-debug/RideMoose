
-- Function that invokes the send-push-notification edge function on ride status changes
CREATE OR REPLACE FUNCTION public.notify_ride_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _event text;
  _supabase_url text;
  _service_key text;
BEGIN
  -- Determine which event to fire
  IF TG_OP = 'INSERT' AND NEW.status = 'requested' THEN
    _event := 'requested';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
      _event := 'accepted';
    ELSIF OLD.status = 'accepted' AND NEW.status = 'in_progress' THEN
      _event := 'arrived';
    ELSIF OLD.status != 'completed' AND NEW.status = 'completed' THEN
      _event := 'completed';
    END IF;
  END IF;

  -- Only fire if we identified a relevant event
  IF _event IS NOT NULL THEN
    _supabase_url := current_setting('app.settings.supabase_url', true);
    _service_key := current_setting('app.settings.service_role_key', true);

    -- Fire-and-forget HTTP call to edge function
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

  RETURN NEW;
END;
$$;

-- Trigger on rides table
DROP TRIGGER IF EXISTS trg_notify_ride_status ON public.rides;
CREATE TRIGGER trg_notify_ride_status
  AFTER INSERT OR UPDATE OF status ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ride_status_change();
