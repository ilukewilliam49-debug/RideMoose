
-- Add cached rider rating columns to profiles
ALTER TABLE public.profiles
ADD COLUMN rider_average_rating numeric(2,1) DEFAULT NULL,
ADD COLUMN rider_total_ratings integer DEFAULT 0;

-- Create function to recalculate rider average rating
-- This works alongside the existing driver rating trigger:
-- When rated_user is a rider, update rider columns; when driver, update driver columns.
-- Replace the existing trigger function to handle both directions.
CREATE OR REPLACE FUNCTION public.recalculate_driver_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _avg numeric;
  _count integer;
  _role user_role;
BEGIN
  -- Determine the role of the rated user
  SELECT role INTO _role FROM profiles WHERE id = NEW.rated_user;

  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(*)
  INTO _avg, _count
  FROM ride_ratings
  WHERE rated_user = NEW.rated_user;

  IF _role = 'driver' THEN
    UPDATE profiles
    SET average_rating = _avg,
        total_ratings = _count
    WHERE id = NEW.rated_user;
  ELSE
    UPDATE profiles
    SET rider_average_rating = _avg,
        rider_total_ratings = _count
    WHERE id = NEW.rated_user;
  END IF;

  RETURN NEW;
END;
$$;
