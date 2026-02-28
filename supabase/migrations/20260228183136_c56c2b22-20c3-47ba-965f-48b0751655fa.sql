
-- Replace overly permissive insert policy with a more specific one
DROP POLICY "System can insert notifications" ON public.notifications;

-- Only allow inserts where user_id matches the authenticated user's profile
-- (The trigger uses SECURITY DEFINER so it bypasses RLS anyway)
CREATE POLICY "Users can receive notifications"
ON public.notifications FOR INSERT
WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
