
CREATE TABLE public.platform_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value numeric NOT NULL DEFAULT 0,
  label text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read config"
ON public.platform_config FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage config"
ON public.platform_config FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

INSERT INTO public.platform_config (key, value, label)
VALUES ('commission_rate', 0, 'Platform Commission Rate (%)');
