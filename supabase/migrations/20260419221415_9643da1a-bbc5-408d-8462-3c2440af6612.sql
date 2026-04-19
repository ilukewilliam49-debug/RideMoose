-- 1) Prevent revoking the last admin
CREATE OR REPLACE FUNCTION public.prevent_last_admin_revoke()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining integer;
BEGIN
  IF OLD.role = 'admin' THEN
    SELECT count(*) INTO _remaining
      FROM public.user_roles
     WHERE role = 'admin'
       AND id <> OLD.id;
    IF _remaining = 0 THEN
      RAISE EXCEPTION 'Cannot revoke the last administrator. Promote another user to admin first.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_last_admin_revoke_trg ON public.user_roles;
CREATE TRIGGER prevent_last_admin_revoke_trg
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_revoke();

-- 2) Helper to determine whether a driver is "live" (online and recently seen)
CREATE OR REPLACE FUNCTION public.is_driver_live(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _profile_id
      AND is_driver = true
      AND is_available = true
      AND last_seen_at IS NOT NULL
      AND last_seen_at > now() - interval '60 seconds'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_driver_live(uuid) TO authenticated;