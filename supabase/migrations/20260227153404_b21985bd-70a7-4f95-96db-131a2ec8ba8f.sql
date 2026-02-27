
-- Create geo_zones table with polygon boundaries
CREATE TABLE public.geo_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_key TEXT NOT NULL UNIQUE,
  zone_name TEXT NOT NULL,
  polygon JSONB NOT NULL DEFAULT '[]'::jsonb,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.geo_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read geo zones"
  ON public.geo_zones FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage geo zones"
  ON public.geo_zones FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Seed Yellowknife geo zones with approximate polygon boundaries
-- polygon is an array of [lat, lng] coordinate pairs forming a closed polygon

-- City / Downtown Yellowknife
INSERT INTO public.geo_zones (zone_key, zone_name, polygon, color) VALUES
('city', 'Downtown Yellowknife', '[
  [62.4610, -114.3880],
  [62.4610, -114.3500],
  [62.4460, -114.3500],
  [62.4460, -114.3880]
]'::jsonb, '#3b82f6');

-- Yellowknife Airport
INSERT INTO public.geo_zones (zone_key, zone_name, polygon, color) VALUES
('airport', 'Yellowknife Airport', '[
  [62.4700, -114.4500],
  [62.4700, -114.4250],
  [62.4550, -114.4250],
  [62.4550, -114.4500]
]'::jsonb, '#ef4444');

-- Ingraham Trail corridor
INSERT INTO public.geo_zones (zone_key, zone_name, polygon, color) VALUES
('ingraham_trail', 'Ingraham Trail', '[
  [62.4800, -114.3200],
  [62.4800, -114.2000],
  [62.4400, -114.2000],
  [62.4400, -114.3200]
]'::jsonb, '#22c55e');
