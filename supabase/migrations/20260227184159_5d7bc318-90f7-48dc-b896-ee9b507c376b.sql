
-- 1. Create taxi_rates table
CREATE TABLE public.taxi_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_fare_cents int4 NOT NULL DEFAULT 470,
  per_km_cents int4 NOT NULL DEFAULT 300,
  per_min_cents int4 NOT NULL DEFAULT 50,
  waiting_per_min_cents int4 NOT NULL DEFAULT 75,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.taxi_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active taxi rates"
  ON public.taxi_rates FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage taxi rates"
  ON public.taxi_rates FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Insert default rates
INSERT INTO public.taxi_rates (base_fare_cents, per_km_cents, per_min_cents, waiting_per_min_cents)
VALUES (470, 300, 50, 75);

-- 2. Add meter columns to rides
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS meter_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS meter_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS meter_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_min float8 NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS waiting_min float8 NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_fare_cents int4;
