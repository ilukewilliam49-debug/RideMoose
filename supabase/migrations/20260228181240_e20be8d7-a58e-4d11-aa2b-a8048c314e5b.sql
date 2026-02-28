
-- Step 1: Add enum value and columns (enum must be committed before use in functions)
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'large_delivery';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_type text;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS requires_loading_help boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stairs_involved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weight_estimate_kg integer;
