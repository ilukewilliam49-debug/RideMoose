-- Add guest booking support
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS booking_for text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_phone text;

-- Validation trigger: enforce values
CREATE OR REPLACE FUNCTION public.validate_booking_for()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.booking_for NOT IN ('self', 'guest') THEN
    RAISE EXCEPTION 'booking_for must be self or guest';
  END IF;
  IF NEW.booking_for = 'guest' THEN
    IF NEW.guest_name IS NULL OR length(trim(NEW.guest_name)) = 0 THEN
      RAISE EXCEPTION 'guest_name is required when booking for someone else';
    END IF;
    IF NEW.guest_phone IS NULL OR length(trim(NEW.guest_phone)) = 0 THEN
      RAISE EXCEPTION 'guest_phone is required when booking for someone else';
    END IF;
  ELSE
    -- Clear guest fields when booking for self
    NEW.guest_name := NULL;
    NEW.guest_phone := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_booking_for ON public.rides;
CREATE TRIGGER trg_validate_booking_for
  BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_for();

CREATE INDEX IF NOT EXISTS idx_rides_booking_for ON public.rides(booking_for) WHERE booking_for = 'guest';