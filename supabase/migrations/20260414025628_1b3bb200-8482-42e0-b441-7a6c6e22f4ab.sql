
-- Add feedback_tags to ride_ratings
ALTER TABLE public.ride_ratings
ADD COLUMN feedback_tags text[] DEFAULT '{}';

-- Add cached average rating columns to profiles
ALTER TABLE public.profiles
ADD COLUMN average_rating numeric(2,1) DEFAULT NULL,
ADD COLUMN total_ratings integer DEFAULT 0;

-- Create function to recalculate driver average rating
CREATE OR REPLACE FUNCTION public.recalculate_driver_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _avg numeric;
  _count integer;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(*)
  INTO _avg, _count
  FROM ride_ratings
  WHERE rated_user = NEW.rated_user;

  UPDATE profiles
  SET average_rating = _avg,
      total_ratings = _count
  WHERE id = NEW.rated_user;

  RETURN NEW;
END;
$$;

-- Create trigger on ride_ratings insert
CREATE TRIGGER trg_recalculate_driver_rating
AFTER INSERT ON public.ride_ratings
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_driver_rating();

-- Backfill existing ratings
UPDATE profiles p
SET average_rating = sub.avg_rating,
    total_ratings = sub.cnt
FROM (
  SELECT rated_user, ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*) as cnt
  FROM ride_ratings
  GROUP BY rated_user
) sub
WHERE p.id = sub.rated_user;
