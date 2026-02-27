-- Add po_number and cost_center to rides
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS cost_center text;

-- Add invoice_number to invoices (unique)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number text UNIQUE;