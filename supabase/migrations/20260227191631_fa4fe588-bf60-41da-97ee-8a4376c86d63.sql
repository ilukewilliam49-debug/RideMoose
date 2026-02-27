
-- Add payment columns to rides
ALTER TABLE public.rides
  ADD COLUMN payment_option text NOT NULL DEFAULT 'in_app',
  ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN stripe_payment_intent_id text,
  ADD COLUMN authorized_amount_cents integer,
  ADD COLUMN paid_at timestamptz;

-- Validate payment_option values
CREATE OR REPLACE FUNCTION public.validate_payment_option()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.payment_option NOT IN ('in_app', 'pay_driver') THEN
    RAISE EXCEPTION 'payment_option must be in_app or pay_driver';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_payment_option
  BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_option();

-- Validate payment_status values
CREATE OR REPLACE FUNCTION public.validate_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.payment_status NOT IN ('unpaid', 'authorized', 'paid', 'failed', 'refunded') THEN
    RAISE EXCEPTION 'payment_status must be unpaid, authorized, paid, failed, or refunded';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_payment_status
  BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_status();
