-- 1. Fix mutable search_path on email queue functions
ALTER FUNCTION public.enqueue_email SET search_path = public;
ALTER FUNCTION public.read_email_batch SET search_path = public;
ALTER FUNCTION public.move_to_dlq SET search_path = public;
ALTER FUNCTION public.delete_email SET search_path = public;

-- 2. Remove overly permissive proof-photos storage policy
DROP POLICY IF EXISTS "Drivers can upload proof photos" ON storage.objects;

-- 3. Restrict notification_logs inserts to service_role only
CREATE POLICY "Only service role can insert notification logs"
ON public.notification_logs FOR INSERT
WITH CHECK (auth.role() = 'service_role');