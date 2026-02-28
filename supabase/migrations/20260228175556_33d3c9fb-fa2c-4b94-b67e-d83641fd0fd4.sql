
-- Add courier-specific fields to rides
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS package_size text,
  ADD COLUMN IF NOT EXISTS pickup_notes text,
  ADD COLUMN IF NOT EXISTS dropoff_notes text,
  ADD COLUMN IF NOT EXISTS proof_photo_url text,
  ADD COLUMN IF NOT EXISTS proof_photo_required boolean NOT NULL DEFAULT false;

-- Validate package_size
CREATE OR REPLACE FUNCTION public.validate_package_size()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.service_type = 'courier' AND NEW.package_size IS NOT NULL 
     AND NEW.package_size NOT IN ('small', 'medium', 'large') THEN
    RAISE EXCEPTION 'package_size must be small, medium, or large';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_package_size_trigger
  BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_package_size();

-- Insert courier pricing
INSERT INTO public.service_pricing (service_type, base_fare, per_km_rate, per_min_rate, minimum_fare, is_active, is_flat_rate)
VALUES ('courier', 8.00, 1.50, 0, 12.00, true, false);
