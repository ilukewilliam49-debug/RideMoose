
-- 1. Create organizations table first
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  billing_email text NOT NULL,
  credit_limit_cents integer NOT NULL DEFAULT 500000,
  current_balance_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_terms_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_org_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'suspended') THEN
    RAISE EXCEPTION 'organization status must be pending, approved, or suspended';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_org_status BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.validate_org_status();

CREATE POLICY "Admins can manage organizations"
  ON public.organizations FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 2. Add columns to profiles (org table now exists for FK)
ALTER TABLE public.profiles
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id),
  ADD COLUMN role_in_org text;

-- 3. Now create the member-read policy (profiles.organization_id exists)
CREATE POLICY "Org members can view their organization"
  ON public.organizations FOR SELECT
  USING (id IN (
    SELECT organization_id FROM public.profiles
    WHERE user_id = auth.uid() AND organization_id IS NOT NULL
  ));

-- 4. Add columns to rides
ALTER TABLE public.rides
  ADD COLUMN billed_to text NOT NULL DEFAULT 'individual',
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id),
  ADD COLUMN invoiced boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.validate_billed_to()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.billed_to NOT IN ('individual', 'organization') THEN
    RAISE EXCEPTION 'billed_to must be individual or organization';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_billed_to BEFORE INSERT OR UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.validate_billed_to();

-- 5. Update payment_status validator
CREATE OR REPLACE FUNCTION public.validate_payment_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.payment_status NOT IN ('unpaid', 'authorized', 'partial', 'paid', 'failed', 'refunded', 'invoiced_pending') THEN
    RAISE EXCEPTION 'payment_status must be unpaid, authorized, partial, paid, failed, refunded, or invoiced_pending';
  END IF;
  RETURN NEW;
END;
$$;
