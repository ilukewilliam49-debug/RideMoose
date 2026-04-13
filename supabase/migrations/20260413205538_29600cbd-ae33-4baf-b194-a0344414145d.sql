
CREATE OR REPLACE FUNCTION public.notify_ride_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Try app.settings first, then fall back to vault/env
    _supabase_url := coalesce(
      nullif(current_setting('app.settings.supabase_url', true), ''),
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1)
    );
    _service_key := coalesce(
      nullif(current_setting('app.settings.service_role_key', true), ''),
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    );

    -- Only attempt HTTP call if we have both values
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
$function$;
