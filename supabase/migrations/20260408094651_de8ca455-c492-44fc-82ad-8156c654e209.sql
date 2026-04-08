
-- 1. Lock down password_reset_attempts: drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view their own reset attempts" ON public.password_reset_attempts;

-- Replace with a restrictive policy (no one reads directly; the security-definer function handles it)
CREATE POLICY "No direct read access" ON public.password_reset_attempts
  FOR SELECT TO public USING (false);

-- 2. Make chat-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-images';

-- 3. Make voice-messages bucket private
UPDATE storage.buckets SET public = false WHERE id = 'voice-messages';

-- 4. Scope proof-photos uploads to user's own folder
-- First make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'proof-photos';

-- Drop any existing overly permissive storage policies on proof-photos
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read" ON storage.objects;

-- Create scoped upload policy: users can only upload to their own folder
CREATE POLICY "Users upload to own folder in proof-photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proof-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own files in proof-photos
CREATE POLICY "Users read own proof-photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'proof-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all proof-photos
CREATE POLICY "Admins read all proof-photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'proof-photos'
    AND has_role(auth.uid(), 'admin'::user_role)
  );

-- Storage policies for chat-images: only ride participants
CREATE POLICY "Ride participants upload chat-images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Ride participants read chat-images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins read all chat-images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-images'
    AND has_role(auth.uid(), 'admin'::user_role)
  );

-- Storage policies for voice-messages
CREATE POLICY "Users upload own voice-messages"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-messages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own voice-messages"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins read all voice-messages"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND has_role(auth.uid(), 'admin'::user_role)
  );

-- 5. Create a Realtime authorization function for channel-level access control
CREATE OR REPLACE FUNCTION public.authorize_realtime_channel(_channel text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Admin can subscribe to any channel
    WHEN has_role(_user_id, 'admin'::user_role) THEN true
    -- Ride channels: only rider or driver of the ride
    WHEN _channel LIKE 'ride-%' THEN EXISTS (
      SELECT 1 FROM rides r
      WHERE r.id::text = substring(_channel from 'ride-(.+)')
        AND (
          r.rider_id IN (SELECT id FROM profiles WHERE user_id = _user_id)
          OR r.driver_id IN (SELECT id FROM profiles WHERE user_id = _user_id)
        )
    )
    -- Notification channels: only the user themselves
    WHEN _channel LIKE 'notifications-%' THEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = _user_id
        AND p.id::text = substring(_channel from 'notifications-(.+)')
    )
    ELSE false
  END
$$;
