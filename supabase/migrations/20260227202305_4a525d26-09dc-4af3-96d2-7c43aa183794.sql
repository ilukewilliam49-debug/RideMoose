-- Update the organizations RLS policy to also allow org_members to view their organization
DROP POLICY IF EXISTS "Org members can view their organization" ON public.organizations;

CREATE POLICY "Org members can view their organization"
ON public.organizations
FOR SELECT
USING (
  id IN (
    SELECT om.organization_id
    FROM org_members om
    WHERE om.user_id = auth.uid()
  )
  OR
  id IN (
    SELECT p.organization_id
    FROM profiles p
    WHERE p.user_id = auth.uid() AND p.organization_id IS NOT NULL
  )
);