
-- Step 1: Add private_hire to service_type enum
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'private_hire';

-- Add can_private_hire flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_private_hire boolean NOT NULL DEFAULT false;

-- Add scheduled_at and pricing_model to rides
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'metered';
