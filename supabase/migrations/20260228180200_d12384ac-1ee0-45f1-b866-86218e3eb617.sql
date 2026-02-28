
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
        ELSE can_shuttle
      END
  )
$$;
