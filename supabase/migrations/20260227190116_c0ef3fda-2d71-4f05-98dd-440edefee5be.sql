-- Add free_waiting_min column and remove per_min_cents from taxi_rates
ALTER TABLE public.taxi_rates ADD COLUMN free_waiting_min integer NOT NULL DEFAULT 3;
ALTER TABLE public.taxi_rates DROP COLUMN per_min_cents;