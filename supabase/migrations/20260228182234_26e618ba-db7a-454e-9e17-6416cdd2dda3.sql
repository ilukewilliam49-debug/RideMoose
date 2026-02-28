
-- Create delivery_bids table
CREATE TABLE public.delivery_bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id),
  offer_amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_bid_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'bid status must be pending, accepted, or rejected';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_bid_status_trigger
BEFORE INSERT OR UPDATE ON public.delivery_bids
FOR EACH ROW EXECUTE FUNCTION public.validate_bid_status();

-- Validation trigger for minimum bid amount (3000 cents)
CREATE OR REPLACE FUNCTION public.validate_bid_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.offer_amount_cents < 3000 THEN
    RAISE EXCEPTION 'Minimum bid amount is 3000 cents ($30.00)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_bid_amount_trigger
BEFORE INSERT ON public.delivery_bids
FOR EACH ROW EXECUTE FUNCTION public.validate_bid_amount();

-- Enable RLS
ALTER TABLE public.delivery_bids ENABLE ROW LEVEL SECURITY;

-- RLS: Drivers can insert their own bids
CREATE POLICY "Drivers can insert own bids"
ON public.delivery_bids FOR INSERT
WITH CHECK (driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS: Drivers can view their own bids
CREATE POLICY "Drivers can view own bids"
ON public.delivery_bids FOR SELECT
USING (driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS: Riders can view bids on their rides
CREATE POLICY "Riders can view bids on own rides"
ON public.delivery_bids FOR SELECT
USING (ride_id IN (SELECT id FROM public.rides WHERE rider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

-- RLS: Riders can update bids on their rides (accept/reject)
CREATE POLICY "Riders can update bids on own rides"
ON public.delivery_bids FOR UPDATE
USING (ride_id IN (SELECT id FROM public.rides WHERE rider_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

-- RLS: Admins full access
CREATE POLICY "Admins can manage all bids"
ON public.delivery_bids FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Enable realtime for bids
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_bids;
