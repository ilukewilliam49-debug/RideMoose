
-- Pricing configuration table
CREATE TABLE public.pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_fare numeric NOT NULL DEFAULT 2.50,
  per_km_rate numeric NOT NULL DEFAULT 1.20,
  per_min_rate numeric NOT NULL DEFAULT 0.30,
  minimum_fare numeric NOT NULL DEFAULT 5.00,
  surge_multiplier numeric NOT NULL DEFAULT 1.0,
  surge_threshold_pending integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active config"
ON public.pricing_config FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage pricing config"
ON public.pricing_config FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Insert default pricing
INSERT INTO public.pricing_config (base_fare, per_km_rate, per_min_rate, minimum_fare, surge_multiplier, surge_threshold_pending)
VALUES (2.50, 1.20, 0.30, 5.00, 1.0, 10);

-- Ride ratings table
CREATE TABLE public.ride_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  rated_by uuid NOT NULL REFERENCES public.profiles(id),
  rated_user uuid NOT NULL REFERENCES public.profiles(id),
  rating smallint NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ride_id, rated_by)
);

-- Validation trigger for rating range
CREATE OR REPLACE FUNCTION public.validate_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_rating_range
BEFORE INSERT OR UPDATE ON public.ride_ratings
FOR EACH ROW EXECUTE FUNCTION public.validate_rating();

ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;

-- Users can rate rides they participated in
CREATE POLICY "Users can insert own ratings"
ON public.ride_ratings FOR INSERT
WITH CHECK (rated_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Users can view ratings they gave or received
CREATE POLICY "Users can view own ratings"
ON public.ride_ratings FOR SELECT
USING (
  rated_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR rated_user IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Admins can view all ratings
CREATE POLICY "Admins can view all ratings"
ON public.ride_ratings FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- Updated_at trigger for pricing_config
CREATE TRIGGER update_pricing_config_updated_at
BEFORE UPDATE ON public.pricing_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
