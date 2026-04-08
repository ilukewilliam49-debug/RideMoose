
CREATE TABLE public.payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own payout requests
CREATE POLICY "Drivers can view own payout requests"
  ON public.payout_requests FOR SELECT
  USING (driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Drivers can create payout requests
CREATE POLICY "Drivers can insert own payout requests"
  ON public.payout_requests FOR INSERT
  WITH CHECK (driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Admins can manage all payout requests
CREATE POLICY "Admins can manage all payout requests"
  ON public.payout_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Validate status
CREATE OR REPLACE FUNCTION public.validate_payout_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'paid') THEN
    RAISE EXCEPTION 'payout status must be pending, approved, rejected, or paid';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_payout_status_trigger
  BEFORE INSERT OR UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_payout_status();
