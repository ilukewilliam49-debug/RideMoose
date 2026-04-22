CREATE OR REPLACE FUNCTION public._test_find_other_driver()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _self_profile uuid;
  _other uuid;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL OR _email <> 'testdriver@pickyou.test' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO _self_profile FROM public.profiles WHERE user_id = auth.uid();

  SELECT id INTO _other
    FROM public.profiles
   WHERE is_driver = true
     AND id <> _self_profile
   LIMIT 1;

  IF _other IS NULL THEN
    RAISE EXCEPTION 'No other driver available';
  END IF;

  RETURN _other;
END;
$$;

REVOKE ALL ON FUNCTION public._test_find_other_driver() FROM public;
GRANT EXECUTE ON FUNCTION public._test_find_other_driver() TO authenticated;