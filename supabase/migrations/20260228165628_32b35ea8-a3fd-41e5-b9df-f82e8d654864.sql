
-- Add driver commission and promo columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_rate numeric NOT NULL DEFAULT 0.049,
  ADD COLUMN IF NOT EXISTS promo_commission_rate numeric NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS promo_end_date timestamptz;
