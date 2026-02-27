-- Create organization_applications table
CREATE TABLE public.organization_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id uuid NOT NULL,
  company_name text NOT NULL,
  registration_number text,
  billing_email text NOT NULL,
  accounts_payable_email text,
  phone text,
  address text,
  contact_person_name text NOT NULL,
  contact_person_email text NOT NULL,
  estimated_monthly_spend_cents integer NOT NULL DEFAULT 0,
  requested_credit_limit_cents integer NOT NULL DEFAULT 500000,
  payment_terms_requested integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_org_application_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'needs_info') THEN
    RAISE EXCEPTION 'organization application status must be pending, approved, rejected, or needs_info';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_org_application_status_trigger
BEFORE INSERT OR UPDATE ON public.organization_applications
FOR EACH ROW EXECUTE FUNCTION public.validate_org_application_status();

-- Updated_at trigger
CREATE TRIGGER update_org_applications_updated_at
BEFORE UPDATE ON public.organization_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS
ALTER TABLE public.organization_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own applications"
ON public.organization_applications
FOR SELECT
USING (applicant_user_id = auth.uid());

-- Users can create applications
CREATE POLICY "Users can create applications"
ON public.organization_applications
FOR INSERT
WITH CHECK (applicant_user_id = auth.uid());

-- Admins can manage all applications
CREATE POLICY "Admins can manage applications"
ON public.organization_applications
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Add accounts_payable_email to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS accounts_payable_email text;