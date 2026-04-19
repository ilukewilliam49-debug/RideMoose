-- ============================================================
-- P0 Hardening: Server-side capability provisioning
-- ============================================================
-- 1. Create a SECURITY DEFINER RPC that only allows flipping
--    is_driver / is_rider for the calling user. is_business is
--    explicitly excluded (admin-approval gated via /business/apply).
-- 2. Tighten the profiles UPDATE RLS to also freeze is_driver
--    and is_rider, so they can ONLY be flipped via the RPC or
--    the handle_new_user trigger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.provision_capability(_intent text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _normalized text := lower(coalesce(_intent, ''));
  _column text;
  _changed boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF _normalized NOT IN ('rider', 'driver') THEN
    -- business and unknown intents are no-ops by design.
    RETURN jsonb_build_object('ok', true, 'changed', false, 'reason', 'noop');
  END IF;

  IF _normalized = 'driver' THEN
    UPDATE public.profiles
       SET is_driver = true,
           updated_at = now()
     WHERE user_id = _uid
       AND is_driver = false;
    GET DIAGNOSTICS _changed = ROW_COUNT;
  ELSIF _normalized = 'rider' THEN
    UPDATE public.profiles
       SET is_rider = true,
           updated_at = now()
     WHERE user_id = _uid
       AND is_rider = false;
    GET DIAGNOSTICS _changed = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('ok', true, 'changed', _changed > 0, 'intent', _normalized);
END;
$$;

REVOKE ALL ON FUNCTION public.provision_capability(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_capability(text) TO authenticated;

-- ------------------------------------------------------------
-- Lock down profiles UPDATE: freeze is_driver and is_rider too.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND commission_rate = (SELECT p.commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
  AND driver_balance_cents = (SELECT p.driver_balance_cents FROM public.profiles p WHERE p.user_id = auth.uid())
  AND standard_commission_rate = (SELECT p.standard_commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
  AND promo_commission_rate = (SELECT p.promo_commission_rate FROM public.profiles p WHERE p.user_id = auth.uid())
  AND driver_onboarding_complete = (SELECT p.driver_onboarding_complete FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_business = (SELECT p.is_business FROM public.profiles p WHERE p.user_id = auth.uid())
  AND business_onboarding_complete = (SELECT p.business_onboarding_complete FROM public.profiles p WHERE p.user_id = auth.uid())
  AND rider_onboarding_complete = (SELECT p.rider_onboarding_complete FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_driver = (SELECT p.is_driver FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_rider = (SELECT p.is_rider FROM public.profiles p WHERE p.user_id = auth.uid())
);