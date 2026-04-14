
-- Trigger: prevent duplicate active rides per rider
CREATE OR REPLACE FUNCTION public.prevent_duplicate_active_rides()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status IN ('requested', 'accepted', 'in_progress') THEN
    IF EXISTS (
      SELECT 1 FROM public.rides
      WHERE rider_id = NEW.rider_id
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND status IN ('requested', 'accepted', 'in_progress')
    ) THEN
      RAISE EXCEPTION 'Rider already has an active ride';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_duplicate_active_rides
BEFORE INSERT ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_active_rides();

-- Clean driver_can_serve: remove food_delivery and pet_transport branches
CREATE OR REPLACE FUNCTION public.driver_can_serve(_user_id uuid, _service service_type)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND CASE _service::text
        WHEN 'taxi' THEN can_taxi
        WHEN 'private_hire' THEN can_private_hire
        WHEN 'courier' THEN can_courier
        WHEN 'retail_delivery' THEN can_courier
        WHEN 'personal_shopper' THEN can_courier
        WHEN 'large_delivery' THEN (vehicle_type IN ('SUV', 'truck', 'van'))
        ELSE can_shuttle
      END
  )
$$;
