
-- 1. Add retail_delivery to service_type enum
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'retail_delivery';
