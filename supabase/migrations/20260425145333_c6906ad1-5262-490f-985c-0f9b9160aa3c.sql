
CREATE TABLE public.fare_estimate_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  service_type text,
  pickup_address text,
  dropoff_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  stop_count integer NOT NULL DEFAULT 0,
  distance_km numeric,
  estimated_fare_cents integer,
  fare_inputs_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fare_estimate_audit_rider ON public.fare_estimate_audit_log(rider_profile_id, created_at DESC);
CREATE INDEX idx_fare_estimate_audit_event ON public.fare_estimate_audit_log(event_type, created_at DESC);
CREATE INDEX idx_fare_estimate_audit_created ON public.fare_estimate_audit_log(created_at DESC);

ALTER TABLE public.fare_estimate_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_fare_estimate_event_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.event_type NOT IN ('estimate_changed', 'submit_blocked_stale') THEN
    RAISE EXCEPTION 'fare estimate event_type must be estimate_changed or submit_blocked_stale';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_fare_estimate_event_type
BEFORE INSERT OR UPDATE ON public.fare_estimate_audit_log
FOR EACH ROW EXECUTE FUNCTION public.validate_fare_estimate_event_type();

CREATE POLICY "Admins can view all fare estimate logs"
ON public.fare_estimate_audit_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Riders can view own fare estimate logs"
ON public.fare_estimate_audit_log
FOR SELECT
TO authenticated
USING (
  rider_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Riders can insert own fare estimate logs"
ON public.fare_estimate_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  rider_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);
