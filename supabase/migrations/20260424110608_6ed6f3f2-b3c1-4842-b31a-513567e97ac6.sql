-- Per-user recent pickup/dropoff history that syncs across devices
CREATE TABLE public.recent_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  description text NOT NULL,
  lat double precision,
  lng double precision,
  kind text NOT NULL DEFAULT 'either',
  last_used_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enforce kind values via a trigger (avoid CHECK constraint per project conventions)
CREATE OR REPLACE FUNCTION public.validate_recent_location_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.kind NOT IN ('pickup', 'dropoff', 'either') THEN
    RAISE EXCEPTION 'recent_locations.kind must be pickup, dropoff, or either';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_recent_location_kind_trg
BEFORE INSERT OR UPDATE ON public.recent_locations
FOR EACH ROW EXECUTE FUNCTION public.validate_recent_location_kind();

-- Dedupe per (user, description, kind) — case-insensitive on description
CREATE UNIQUE INDEX recent_locations_user_desc_kind_uidx
  ON public.recent_locations (user_id, lower(description), kind);

-- Fast load of latest entries per user
CREATE INDEX recent_locations_user_last_used_idx
  ON public.recent_locations (user_id, last_used_at DESC);

-- RLS
ALTER TABLE public.recent_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recent locations"
ON public.recent_locations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recent locations"
ON public.recent_locations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recent locations"
ON public.recent_locations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recent locations"
ON public.recent_locations
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
