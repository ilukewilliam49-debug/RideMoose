
-- Validation trigger for pet fields
CREATE OR REPLACE FUNCTION public.validate_pet_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.service_type::text = 'pet_transport' THEN
    IF NEW.pet_mode IS NULL OR NEW.pet_mode NOT IN ('pet_with_owner', 'pet_only_transport') THEN
      RAISE EXCEPTION 'pet_mode must be pet_with_owner or pet_only_transport';
    END IF;
    IF NEW.pet_type IS NULL OR NEW.pet_type NOT IN ('dog', 'cat', 'other') THEN
      RAISE EXCEPTION 'pet_type must be dog, cat, or other';
    END IF;
    IF NEW.crate_confirmed IS NOT TRUE THEN
      RAISE EXCEPTION 'crate_confirmed must be true for pet transport';
    END IF;
    IF NEW.destination_type IS NULL OR NEW.destination_type NOT IN ('vet', 'grooming', 'boarding', 'airport') THEN
      RAISE EXCEPTION 'destination_type must be vet, grooming, boarding, or airport';
    END IF;
    IF NEW.emergency_contact_phone IS NULL OR length(trim(NEW.emergency_contact_phone)) < 7 THEN
      RAISE EXCEPTION 'emergency_contact_phone is required for pet transport';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_pet_fields_trigger
  BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pet_fields();

-- Update driver_can_serve to handle pet_transport
CREATE OR REPLACE FUNCTION public.driver_can_serve(_user_id uuid, _service service_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND CASE _service::text
        WHEN 'taxi' THEN can_taxi
        WHEN 'private_hire' THEN can_private_hire
        WHEN 'courier' THEN can_courier
        WHEN 'retail_delivery' THEN can_courier
        WHEN 'personal_shopper' THEN can_courier
        WHEN 'food_delivery' THEN can_food_delivery
        WHEN 'pet_transport' THEN pet_approved
        WHEN 'large_delivery' THEN (vehicle_type IN ('SUV', 'truck', 'van'))
        ELSE can_shuttle
      END
  )
$function$;
