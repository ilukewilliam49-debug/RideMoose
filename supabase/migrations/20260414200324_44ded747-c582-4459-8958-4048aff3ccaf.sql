
CREATE OR REPLACE FUNCTION public.get_ride_stats(
  _date_from timestamptz DEFAULT NULL,
  _date_to timestamptz DEFAULT NULL,
  _status text DEFAULT NULL,
  _service_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_rides', COUNT(*),
    'completed_rides', COUNT(*) FILTER (WHERE status = 'completed'),
    'cancelled_rides', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'total_revenue', COALESCE(SUM(COALESCE(final_price, 0)) FILTER (WHERE status = 'completed'), 0),
    'avg_fare', COALESCE(AVG(COALESCE(final_price, estimated_price)) FILTER (WHERE status = 'completed'), 0),
    'completion_rate', CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE status = 'completed'))::numeric / COUNT(*) * 100, 1)
      ELSE 0 END,
    'scheduled_count', COUNT(*) FILTER (WHERE scheduled_at IS NOT NULL)
  )
  FROM public.rides
  WHERE (_date_from IS NULL OR created_at >= _date_from)
    AND (_date_to IS NULL OR created_at <= _date_to + interval '1 day')
    AND (_status IS NULL OR status::text = _status)
    AND (_service_type IS NULL OR service_type::text = _service_type)
$$;
