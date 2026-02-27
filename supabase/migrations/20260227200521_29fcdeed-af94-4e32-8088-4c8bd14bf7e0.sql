
-- 1. org_members table (separate from profiles for clean role management)
CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'booker',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Validation for org member role
CREATE OR REPLACE FUNCTION public.validate_org_member_role()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.role NOT IN ('admin', 'booker', 'viewer') THEN
    RAISE EXCEPTION 'org member role must be admin, booker, or viewer';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_org_member_role BEFORE INSERT OR UPDATE ON public.org_members
FOR EACH ROW EXECUTE FUNCTION public.validate_org_member_role();

-- RLS for org_members
CREATE POLICY "Admins can manage org members"
  ON public.org_members FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view own memberships"
  ON public.org_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Org admins can manage members"
  ON public.org_members FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.org_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin'
    )
  );

-- 2. invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  total_cents integer NOT NULL DEFAULT 0,
  ride_count integer NOT NULL DEFAULT 0,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Invoice status validation
CREATE OR REPLACE FUNCTION public.validate_invoice_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('issued', 'paid', 'overdue', 'void') THEN
    RAISE EXCEPTION 'invoice status must be issued, paid, overdue, or void';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_invoice_status BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.validate_invoice_status();

-- RLS for invoices
CREATE POLICY "Admins can manage invoices"
  ON public.invoices FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Org members can view their invoices"
  ON public.invoices FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.org_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- 3. Add invoice_id to rides
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id);

-- 4. Enable extensions for cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
