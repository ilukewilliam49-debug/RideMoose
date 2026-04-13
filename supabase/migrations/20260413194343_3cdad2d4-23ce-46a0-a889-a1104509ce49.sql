
-- =============================================================
-- FIX 1: Remove profiles and rides from Realtime publication
-- =============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rides'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.rides;
  END IF;
END $$;

-- =============================================================
-- FIX 2: Lock down password_reset_attempts writes
-- =============================================================
CREATE POLICY "No direct insert access"
  ON public.password_reset_attempts
  FOR INSERT
  TO public
  WITH CHECK (false);

CREATE POLICY "No direct update access"
  ON public.password_reset_attempts
  FOR UPDATE
  TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No direct delete access"
  ON public.password_reset_attempts
  FOR DELETE
  TO public
  USING (false);
