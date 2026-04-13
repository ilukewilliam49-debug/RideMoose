
-- Notification logs table for tracking all notification delivery attempts
CREATE TABLE public.notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID REFERENCES public.rides(id),
  target_profile_id UUID REFERENCES public.profiles(id),
  event TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'push',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  onesignal_id TEXT,
  recipients INTEGER DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for dashboard queries
CREATE INDEX idx_notification_logs_created_at ON public.notification_logs(created_at DESC);
CREATE INDEX idx_notification_logs_status ON public.notification_logs(status);
CREATE INDEX idx_notification_logs_ride_id ON public.notification_logs(ride_id);

-- Retry queue: pending items that need re-processing
CREATE INDEX idx_notification_logs_retry ON public.notification_logs(status, retry_count) WHERE status = 'failed' AND retry_count < 3;

-- RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notification logs"
  ON public.notification_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Rate limiting table
CREATE TABLE public.notification_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(key)
);

ALTER TABLE public.notification_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.notification_rate_limits FOR ALL
  USING (false);

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_notification_rate_limit(
  _key TEXT,
  _max_requests INTEGER DEFAULT 30,
  _window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _count INTEGER;
BEGIN
  -- Clean expired windows
  DELETE FROM notification_rate_limits 
  WHERE window_start < now() - (_window_seconds || ' seconds')::interval;
  
  -- Upsert counter
  INSERT INTO notification_rate_limits (key, request_count, window_start)
  VALUES (_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    request_count = CASE
      WHEN notification_rate_limits.window_start < now() - (_window_seconds || ' seconds')::interval
      THEN 1
      ELSE notification_rate_limits.request_count + 1
    END,
    window_start = CASE
      WHEN notification_rate_limits.window_start < now() - (_window_seconds || ' seconds')::interval
      THEN now()
      ELSE notification_rate_limits.window_start
    END
  RETURNING request_count INTO _count;
  
  RETURN _count <= _max_requests;
END;
$$;

-- Enable realtime for notification_logs so admin dashboard can live-update
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_logs;
