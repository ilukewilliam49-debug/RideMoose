
CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE INDEX idx_audit_log_admin ON public.admin_audit_log (admin_profile_id);
CREATE INDEX idx_audit_log_target ON public.admin_audit_log (target_type, target_id);
CREATE INDEX idx_audit_log_created ON public.admin_audit_log (created_at DESC);
