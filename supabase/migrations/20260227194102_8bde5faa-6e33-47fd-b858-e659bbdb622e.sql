-- Add column to store overage payment info for the rider to pick up
ALTER TABLE public.rides
  ADD COLUMN overage_client_secret text,
  ADD COLUMN overage_cents integer;
