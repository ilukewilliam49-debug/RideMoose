
-- Create private_hire_zones table
CREATE TABLE public.private_hire_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_name TEXT NOT NULL,
  pickup_zone TEXT NOT NULL,
  dropoff_zone TEXT NOT NULL,
  flat_fare_cents INT4 NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.private_hire_zones ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read active zones
CREATE POLICY "Anyone can read active zones"
  ON public.private_hire_zones FOR SELECT
  USING (active = true);

-- Admins can manage zones
CREATE POLICY "Admins can manage zones"
  ON public.private_hire_zones FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Seed zone data
INSERT INTO public.private_hire_zones (zone_name, pickup_zone, dropoff_zone, flat_fare_cents) VALUES
  ('City Ride', 'city', 'city', 5000),
  ('Airport Transfer (to Airport)', 'city', 'airport', 6500),
  ('Airport Transfer (from Airport)', 'airport', 'city', 6500),
  ('Aurora Route (to Ingraham Trail)', 'city', 'ingraham_trail', 15000),
  ('Aurora Route (from Ingraham Trail)', 'ingraham_trail', 'city', 15000);
