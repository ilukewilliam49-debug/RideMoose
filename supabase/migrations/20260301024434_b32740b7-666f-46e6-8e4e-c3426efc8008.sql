
-- 1. Add personal_shopper to service_type enum
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'personal_shopper';

-- 2. Add new columns to rides table
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS estimated_item_cost_cents integer,
  ADD COLUMN IF NOT EXISTS final_item_cost_cents integer,
  ADD COLUMN IF NOT EXISTS receipt_photo_url text,
  ADD COLUMN IF NOT EXISTS delivery_fee_cents integer,
  ADD COLUMN IF NOT EXISTS shopper_fee_cents integer;
