
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS item_description text,
  ADD COLUMN IF NOT EXISTS marketplace_delivery boolean NOT NULL DEFAULT false;
