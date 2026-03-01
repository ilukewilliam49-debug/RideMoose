
-- 2. Add new columns to rides table
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS store_id text,
  ADD COLUMN IF NOT EXISTS order_value_cents integer,
  ADD COLUMN IF NOT EXISTS signature_required boolean NOT NULL DEFAULT false;

-- 3. Insert service pricing for retail_delivery
INSERT INTO public.service_pricing (service_type, base_fare, per_km_rate, per_min_rate, minimum_fare, surge_multiplier, is_active, is_flat_rate)
VALUES ('retail_delivery', 10.00, 1.50, 0, 12.00, 1.0, true, false);

-- 4. Update driver_can_serve function to handle retail_delivery (same as courier eligibility)
CREATE OR REPLACE FUNCTION public.driver_can_serve(_user_id uuid, _service service_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND CASE
        WHEN _service = 'taxi' THEN can_taxi
        WHEN _service = 'private_hire' THEN can_private_hire
        WHEN _service = 'courier' THEN can_courier
        WHEN _service = 'retail_delivery' THEN can_courier
        WHEN _service = 'large_delivery' THEN (vehicle_type IN ('SUV', 'truck', 'van'))
        ELSE can_shuttle
      END
  )
$$;
