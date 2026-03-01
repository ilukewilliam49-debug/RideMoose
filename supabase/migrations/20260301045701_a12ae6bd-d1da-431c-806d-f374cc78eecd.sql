
-- Add pet_approved to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pet_approved boolean NOT NULL DEFAULT false;
