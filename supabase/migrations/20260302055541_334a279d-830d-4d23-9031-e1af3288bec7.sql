
-- Bookings table to store synced Bókun bookings
CREATE TABLE public.bokun_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bokun_booking_id text NOT NULL UNIQUE,
  confirmation_code text,
  status text NOT NULL DEFAULT 'CONFIRMED',
  product_title text,
  product_id text,
  customer_name text,
  customer_email text,
  customer_phone text,
  booking_date date,
  start_time text,
  total_price_cents integer DEFAULT 0,
  currency text DEFAULT 'ISK',
  participants integer DEFAULT 1,
  seller_name text,
  notes text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  synced_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Sync status tracking table
CREATE TABLE public.bokun_sync_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type text NOT NULL UNIQUE DEFAULT 'bookings',
  last_cursor text,
  last_synced_at timestamp with time zone,
  total_synced integer DEFAULT 0,
  status text DEFAULT 'idle',
  error_message text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert initial sync status row
INSERT INTO public.bokun_sync_status (resource_type, status) VALUES ('bookings', 'idle');

-- Enable RLS
ALTER TABLE public.bokun_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bokun_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can manage bookings
CREATE POLICY "Admins can manage bokun bookings"
  ON public.bokun_bookings FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can view bokun bookings"
  ON public.bokun_bookings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS: Only admins can manage sync status
CREATE POLICY "Admins can manage sync status"
  ON public.bokun_sync_status FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can view sync status"
  ON public.bokun_sync_status FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Trigger for updated_at
CREATE TRIGGER update_bokun_bookings_updated_at
  BEFORE UPDATE ON public.bokun_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_bokun_sync_status_updated_at
  BEFORE UPDATE ON public.bokun_sync_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
