-- ============================================================
-- Multi-stop rides: add intermediate stops support
-- ============================================================
-- Stores up to 3 intermediate waypoints between pickup and dropoff.
-- Each stop is an object: { address: text, lat: number, lng: number, notes?: text }
-- The pickup is implicit (pickup_address/pickup_lat/pickup_lng) and the
-- dropoff is implicit (dropoff_address/dropoff_lat/dropoff_lng). Stops are
-- traversed in array order between them.
-- ============================================================

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS stops jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Enforce a max of 3 intermediate stops and basic shape validation.
CREATE OR REPLACE FUNCTION public.validate_ride_stops()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _stop jsonb;
  _count integer;
BEGIN
  IF NEW.stops IS NULL THEN
    NEW.stops := '[]'::jsonb;
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.stops) <> 'array' THEN
    RAISE EXCEPTION 'stops must be a JSON array';
  END IF;

  _count := jsonb_array_length(NEW.stops);
  IF _count > 3 THEN
    RAISE EXCEPTION 'A ride can have at most 3 intermediate stops (got %)', _count;
  END IF;

  -- Validate each stop has address + numeric coords
  FOR _stop IN SELECT * FROM jsonb_array_elements(NEW.stops)
  LOOP
    IF jsonb_typeof(_stop) <> 'object'
       OR _stop->>'address' IS NULL
       OR length(trim(_stop->>'address')) = 0
       OR (_stop->>'lat') IS NULL
       OR (_stop->>'lng') IS NULL THEN
      RAISE EXCEPTION 'Each stop must have address, lat, and lng';
    END IF;
    -- Ensure lat/lng are numeric and within range
    BEGIN
      IF (_stop->>'lat')::numeric NOT BETWEEN -90 AND 90 THEN
        RAISE EXCEPTION 'stop lat out of range';
      END IF;
      IF (_stop->>'lng')::numeric NOT BETWEEN -180 AND 180 THEN
        RAISE EXCEPTION 'stop lng out of range';
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'stop lat/lng must be numeric';
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_ride_stops_trigger ON public.rides;
CREATE TRIGGER validate_ride_stops_trigger
  BEFORE INSERT OR UPDATE OF stops ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ride_stops();