-- Driver shift events: regulatory log of online / offline / auto-cap events.
-- Admins can view all events; drivers can only insert/view their own rows.
-- The auto_offline_overdue_shifts() reaper writes 'auto_capped' rows server-side
-- so the audit trail is complete even when no client is connected.

CREATE TABLE IF NOT EXISTS public.driver_shift_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('online','offline','auto_capped')),
  shift_session_id uuid REFERENCES public.shift_sessions(id) ON DELETE SET NULL,
  shift_started_at timestamptz,
  shift_duration_minutes integer,
  source text NOT NULL DEFAULT 'driver_app',  -- driver_app | system_reaper | client_cap
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_shift_events_driver_id
  ON public.driver_shift_events (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_shift_events_event_type
  ON public.driver_shift_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_shift_events_created_at
  ON public.driver_shift_events (created_at DESC);

ALTER TABLE public.driver_shift_events ENABLE ROW LEVEL SECURITY;

-- Admins: full visibility
CREATE POLICY "Admins can view all shift events"
  ON public.driver_shift_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Drivers: can read their own history (Earnings / shift summary use cases)
CREATE POLICY "Drivers can view own shift events"
  ON public.driver_shift_events
  FOR SELECT
  TO authenticated
  USING (
    driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Drivers: can insert their own online/offline events (NOT auto_capped — only the
-- server-side reaper or the client cap watcher should flag a 12h breach, but in
-- practice the client may also write 'auto_capped' as a safety net so we allow it).
CREATE POLICY "Drivers can insert own shift events"
  ON public.driver_shift_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Service role / SECURITY DEFINER functions can always write (bypasses RLS),
-- so no extra policy is needed for the reaper.

-- ─── Update reaper to log 'auto_capped' events for every closed shift ───
CREATE OR REPLACE FUNCTION public.auto_offline_overdue_shifts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _affected integer := 0;
  _row record;
BEGIN
  FOR _row IN
    UPDATE public.shift_sessions s
       SET ended_at = now()
     WHERE s.ended_at IS NULL
       AND s.started_at < now() - interval '12 hours'
    RETURNING s.id, s.driver_id, s.started_at
  LOOP
    -- Take the driver offline
    UPDATE public.profiles
       SET is_available = false,
           went_online_at = NULL
     WHERE id = _row.driver_id
       AND is_driver = true;

    -- Log the auto-cap event for admin visibility
    INSERT INTO public.driver_shift_events (
      driver_id, event_type, shift_session_id,
      shift_started_at, shift_duration_minutes,
      source, metadata
    ) VALUES (
      _row.driver_id,
      'auto_capped',
      _row.id,
      _row.started_at,
      EXTRACT(EPOCH FROM (now() - _row.started_at))::integer / 60,
      'system_reaper',
      jsonb_build_object('limit_hours', 12, 'reason', 'hos_12h_cap')
    );

    _affected := _affected + 1;
  END LOOP;

  RETURN _affected;
END;
$function$;