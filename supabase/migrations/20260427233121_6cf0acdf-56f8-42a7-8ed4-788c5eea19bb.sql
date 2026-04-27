CREATE TABLE public.driver_application_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_user_id UUID NOT NULL UNIQUE,
  step SMALLINT NOT NULL DEFAULT 0,
  form JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_names JSONB NOT NULL DEFAULT '{}'::jsonb,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_application_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own driver draft"
  ON public.driver_application_drafts FOR SELECT
  TO authenticated
  USING (applicant_user_id = auth.uid());

CREATE POLICY "Users can insert own driver draft"
  ON public.driver_application_drafts FOR INSERT
  TO authenticated
  WITH CHECK (applicant_user_id = auth.uid());

CREATE POLICY "Users can update own driver draft"
  ON public.driver_application_drafts FOR UPDATE
  TO authenticated
  USING (applicant_user_id = auth.uid())
  WITH CHECK (applicant_user_id = auth.uid());

CREATE POLICY "Users can delete own driver draft"
  ON public.driver_application_drafts FOR DELETE
  TO authenticated
  USING (applicant_user_id = auth.uid());

CREATE POLICY "Admins can view all driver drafts"
  ON public.driver_application_drafts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_driver_application_drafts_updated_at
  BEFORE UPDATE ON public.driver_application_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();