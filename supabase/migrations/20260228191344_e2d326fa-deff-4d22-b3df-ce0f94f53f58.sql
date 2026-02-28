-- Track how many times the customer has increased the price
ALTER TABLE public.rides ADD COLUMN price_increase_count integer NOT NULL DEFAULT 0;
