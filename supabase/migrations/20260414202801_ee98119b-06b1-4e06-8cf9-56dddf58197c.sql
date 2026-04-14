-- Drop the overly broad public SELECT policy on storage.objects for the avatars bucket
-- and replace it with a scoped policy that only allows users to list/read their own files.

-- First, drop any existing broad SELECT policy for the avatars bucket.
-- The default public bucket policy is named "Public Access" or similar.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Allow anyone to READ (download) individual avatar files (needed for displaying avatars),
-- but only within the avatars bucket. This does NOT allow listing all files.
CREATE POLICY "Anyone can read avatar files"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- However, to prevent listing, we need to be more specific.
-- Actually the linter warning is about listing. The fix is to scope SELECT
-- so that authenticated users can only access files in their own folder.

-- Let's drop and redo with proper scoping:
DROP POLICY IF EXISTS "Anyone can read avatar files" ON storage.objects;

-- Public read for individual avatar files (needed to display profile pictures)
-- Scoped: users can only access files in their own user-id folder
CREATE POLICY "Users can read own avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can read all avatars (needed for admin user management)
CREATE POLICY "Admins can read all avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND public.has_role(auth.uid(), 'admin'::public.user_role)
);