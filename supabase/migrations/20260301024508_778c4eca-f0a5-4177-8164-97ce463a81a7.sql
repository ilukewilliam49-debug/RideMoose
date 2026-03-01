
-- Insert service_pricing for personal_shopper
INSERT INTO public.service_pricing (service_type, base_fare, per_km_rate, per_min_rate, minimum_fare, is_active)
VALUES ('personal_shopper', 12.00, 1.50, 0, 15.00, true);

-- Update driver_can_serve to allow can_courier drivers for personal_shopper
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
        WHEN _service = 'personal_shopper' THEN can_courier
        WHEN _service = 'large_delivery' THEN (vehicle_type IN ('SUV', 'truck', 'van'))
        ELSE can_shuttle
      END
  )
$$;
