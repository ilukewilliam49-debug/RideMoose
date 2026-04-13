
-- 1. Enable pg_net extension (needed for HTTP calls in notify_ride_status_change)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Attach the trigger to rides table
CREATE TRIGGER on_ride_status_change
  AFTER INSERT OR UPDATE OF status ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ride_status_change();

-- 3. Create ride_events audit log table
CREATE TABLE public.ride_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_profile_id UUID REFERENCES public.profiles(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups by ride
CREATE INDEX idx_ride_events_ride_id ON public.ride_events(ride_id);
CREATE INDEX idx_ride_events_event_type ON public.ride_events(event_type);
CREATE INDEX idx_ride_events_created_at ON public.ride_events(created_at DESC);

-- 4. Enable RLS
ALTER TABLE public.ride_events ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage ride events"
  ON public.ride_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::user_role));

-- Riders can view events on their rides
CREATE POLICY "Riders can view own ride events"
  ON public.ride_events FOR SELECT
  USING (ride_id IN (
    SELECT r.id FROM public.rides r
    WHERE r.rider_id IN (
      SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  ));

-- Drivers can view events on assigned rides
CREATE POLICY "Drivers can view assigned ride events"
  ON public.ride_events FOR SELECT
  USING (ride_id IN (
    SELECT r.id FROM public.rides r
    WHERE r.driver_id IN (
      SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  ));

-- 5. Auto-log ride_events on status changes via trigger
CREATE OR REPLACE FUNCTION public.log_ride_event()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
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
        WHEN NEW.status IN ('accepted', 'in_progress', 'completed') THEN NEW.driver_id
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
$$;

CREATE TRIGGER on_ride_event_log
  AFTER INSERT OR UPDATE OF status ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.log_ride_event();

-- 6. Enable realtime on ride_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_events;
