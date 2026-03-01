-- Add pet_transport to service_type enum
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'pet_transport';