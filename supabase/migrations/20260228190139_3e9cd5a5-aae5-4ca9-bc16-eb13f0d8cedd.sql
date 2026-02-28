CREATE TRIGGER notify_large_delivery_drivers_trigger
AFTER INSERT ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.notify_large_delivery_drivers();