
-- Create a SECURITY DEFINER function to check if user is an org admin
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id
      AND organization_id = _organization_id
      AND role = 'admin'
  )
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Org admins can manage members" ON public.org_members;

-- Recreate it using the SECURITY DEFINER function
CREATE POLICY "Org admins can manage members"
ON public.org_members
FOR ALL
USING (public.is_org_admin(auth.uid(), organization_id));
