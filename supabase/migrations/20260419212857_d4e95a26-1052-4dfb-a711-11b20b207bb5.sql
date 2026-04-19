
CREATE OR REPLACE FUNCTION public.ensure_ride_track_token(_ride_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token text;
  _profile_id uuid;
  _rider_id uuid;
BEGIN
  SELECT id INTO _profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT rider_id, guest_track_token INTO _rider_id, _token
  FROM public.rides WHERE id = _ride_id;

  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Ride not found';
  END IF;

  IF _rider_id <> _profile_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF _token IS NULL OR length(_token) = 0 THEN
    _token := encode(gen_random_bytes(18), 'base64');
    _token := replace(replace(replace(_token, '+', ''), '/', ''), '=', '');
    UPDATE public.rides SET guest_track_token = _token WHERE id = _ride_id;
  END IF;

  RETURN _token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_ride_track_token(uuid) TO authenticated;
