
-- Add fee/earnings columns to rides
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS service_fee_cents integer NOT NULL DEFAULT 99,
  ADD COLUMN IF NOT EXISTS commission_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_earnings_cents integer NOT NULL DEFAULT 0;

-- Add driver_balance_cents to profiles for tracking owed commission (pay_driver)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS driver_balance_cents integer NOT NULL DEFAULT 0;
