-- Add bidding_ends_at to rides (auto-set to 5 minutes after creation for large_delivery)
ALTER TABLE public.rides ADD COLUMN bidding_ends_at timestamp with time zone;

-- Trigger to auto-set bidding_ends_at when a large_delivery ride is created
CREATE OR REPLACE FUNCTION public.set_bidding_window()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.service_type = 'large_delivery' AND NEW.status = 'requested' THEN
    NEW.bidding_ends_at = now() + interval '5 minutes';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_bidding_window_trigger
BEFORE INSERT ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.set_bidding_window();

-- Update bid validation: new bids must be >= 100 cents lower than current lowest
CREATE OR REPLACE FUNCTION public.validate_bid_undercut()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  current_lowest integer;
  bidding_end timestamp with time zone;
BEGIN
  -- Check bidding window
  SELECT r.bidding_ends_at INTO bidding_end
  FROM public.rides r WHERE r.id = NEW.ride_id;
  
  IF bidding_end IS NOT NULL AND now() > bidding_end THEN
    RAISE EXCEPTION 'Bidding window has closed';
  END IF;

  -- Check undercut rule (only for new bids, not updates to own bid)
  SELECT MIN(offer_amount_cents) INTO current_lowest
  FROM public.delivery_bids
  WHERE ride_id = NEW.ride_id AND status = 'pending' AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF current_lowest IS NOT NULL AND NEW.offer_amount_cents > (current_lowest - 100) THEN
    RAISE EXCEPTION 'Bid must be at least $1.00 lower than current lowest bid ($%)', (current_lowest / 100.0);
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_bid_undercut_trigger
BEFORE INSERT OR UPDATE ON public.delivery_bids
FOR EACH ROW
EXECUTE FUNCTION public.validate_bid_undercut();