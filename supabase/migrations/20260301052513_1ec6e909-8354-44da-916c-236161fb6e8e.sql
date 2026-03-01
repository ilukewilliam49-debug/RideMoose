-- Function to notify pet-approved drivers on new pet_transport ride
CREATE OR REPLACE FUNCTION public.notify_pet_transport_drivers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.service_type = 'pet_transport' AND NEW.status = 'requested' THEN
    INSERT INTO public.notifications (user_id, title, body, type, ride_id)
    SELECT p.id,
           'New Pet Transport Request',
           'A new pet transport from ' || NEW.pickup_address || ' is available.',
           'pet_transport',
           NEW.id
    FROM public.profiles p
    WHERE p.role = 'driver'
      AND p.is_available = true
      AND p.pet_approved = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER notify_pet_transport_drivers_trigger
AFTER INSERT ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.notify_pet_transport_drivers();