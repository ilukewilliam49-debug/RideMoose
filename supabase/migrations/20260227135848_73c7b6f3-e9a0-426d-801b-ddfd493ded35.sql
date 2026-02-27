
-- Service type enum
CREATE TYPE public.service_type AS ENUM ('taxi', 'shuttle');

-- Add service_type and passenger_count to rides
ALTER TABLE public.rides
  ADD COLUMN service_type public.service_type NOT NULL DEFAULT 'taxi',
  ADD COLUMN passenger_count smallint NOT NULL DEFAULT 1;

-- Add driver capability flags and seat capacity to profiles
ALTER TABLE public.profiles
  ADD COLUMN can_taxi boolean NOT NULL DEFAULT true,
  ADD COLUMN can_shuttle boolean NOT NULL DEFAULT false,
  ADD COLUMN seat_capacity smallint;

-- Service pricing table
CREATE TABLE public.service_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type public.service_type NOT NULL UNIQUE,
  base_fare numeric NOT NULL DEFAULT 2.50,
  per_km_rate numeric NOT NULL DEFAULT 1.20,
  per_min_rate numeric NOT NULL DEFAULT 0.30,
  minimum_fare numeric NOT NULL DEFAULT 5.00,
  per_seat_rate numeric,
  is_flat_rate boolean NOT NULL DEFAULT false,
  flat_rate numeric,
  surge_multiplier numeric NOT NULL DEFAULT 1.0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active service pricing"
ON public.service_pricing FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage service pricing"
ON public.service_pricing FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Default pricing rows
INSERT INTO public.service_pricing (service_type, base_fare, per_km_rate, per_min_rate, minimum_fare, is_flat_rate)
VALUES ('taxi', 2.50, 1.20, 0.30, 5.00, false);

INSERT INTO public.service_pricing (service_type, base_fare, per_km_rate, per_min_rate, minimum_fare, is_flat_rate, per_seat_rate)
VALUES ('shuttle', 1.50, 0.80, 0.15, 3.00, false, 1.00);

-- Updated_at trigger
CREATE TRIGGER update_service_pricing_updated_at
BEFORE UPDATE ON public.service_pricing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS helper: check if driver can serve a service type
CREATE OR REPLACE FUNCTION public.driver_can_serve(_user_id uuid, _service service_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND CASE WHEN _service = 'taxi' THEN can_taxi ELSE can_shuttle END
  )
$$;
