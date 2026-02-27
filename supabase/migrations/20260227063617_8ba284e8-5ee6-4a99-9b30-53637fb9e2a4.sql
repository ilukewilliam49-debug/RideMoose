
-- Create a security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Fix profiles policies to use the function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role));

-- Fix rides policies
DROP POLICY IF EXISTS "Admins can view all rides" ON public.rides;
CREATE POLICY "Admins can view all rides" ON public.rides FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can update all rides" ON public.rides;
CREATE POLICY "Admins can update all rides" ON public.rides FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role));

-- Fix verifications policies
DROP POLICY IF EXISTS "Admins can view all verifications" ON public.verifications;
CREATE POLICY "Admins can view all verifications" ON public.verifications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role));

DROP POLICY IF EXISTS "Admins can update verifications" ON public.verifications;
CREATE POLICY "Admins can update verifications" ON public.verifications FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role));
