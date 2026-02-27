
-- Insert private_hire pricing
INSERT INTO public.service_pricing (service_type, base_fare, per_km_rate, per_min_rate, minimum_fare, is_flat_rate, flat_rate, per_seat_rate)
VALUES ('private_hire', 5.00, 2.00, 0.50, 10.00, true, 25.00, NULL);

-- Update driver_can_serve to handle private_hire
CREATE OR REPLACE FUNCTION public.driver_can_serve(_user_id uuid, _service service_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND CASE
        WHEN _service = 'taxi' THEN can_taxi
        WHEN _service = 'private_hire' THEN can_private_hire
        ELSE can_shuttle
      END
  )
$function$;
