-- 1. Update accept_ride to check driver is_available
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

-- 2. Update notify_ride_status_change to handle 'arrived'
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
$function$;

-- 3. Update log_ride_event to handle 'arrived'
CREATE OR REPLACE FUNCTION public.log_ride_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ride_events (ride_id, event_type, actor_profile_id, metadata)
    VALUES (NEW.id, NEW.status::text, NEW.rider_id, jsonb_build_object(
      'service_type', NEW.service_type::text,
      'pickup_address', NEW.pickup_address,
      'dropoff_address', NEW.dropoff_address
    ));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.ride_events (ride_id, event_type, actor_profile_id, metadata)
    VALUES (NEW.id, NEW.status::text,
      CASE
        WHEN NEW.status IN ('accepted', 'arrived', 'in_progress', 'completed') THEN NEW.driver_id
        WHEN NEW.status = 'cancelled' THEN COALESCE(NEW.driver_id, NEW.rider_id)
        ELSE NEW.rider_id
      END,
      jsonb_build_object(
        'previous_status', OLD.status::text,
        'new_status', NEW.status::text,
        'driver_id', NEW.driver_id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Update prevent_duplicate_active_rides to include 'arrived'
CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_rides()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('requested', 'accepted', 'arrived', 'in_progress') THEN
    IF EXISTS (
      SELECT 1 FROM public.rides
      WHERE rider_id = NEW.rider_id
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status IN ('requested', 'accepted', 'arrived', 'in_progress')
    ) THEN
      RAISE EXCEPTION 'Rider already has an active ride';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. RLS policy for drivers to update arrived rides  
CREATE POLICY "Drivers can update arrived rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND status = 'arrived'::ride_status
);