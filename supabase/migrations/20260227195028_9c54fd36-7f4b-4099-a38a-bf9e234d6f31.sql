
-- Add new payment tracking columns
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS captured_amount_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_amount_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_reason text,
  ADD COLUMN IF NOT EXISTS driver_collected_outstanding_at timestamptz;

-- Update payment_status validator to include 'partial'
CREATE OR REPLACE FUNCTION public.validate_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.payment_status NOT IN ('unpaid', 'authorized', 'partial', 'paid', 'failed', 'refunded') THEN
    RAISE EXCEPTION 'payment_status must be unpaid, authorized, partial, paid, failed, or refunded';
  END IF;
  RETURN NEW;
END;
$function$;
