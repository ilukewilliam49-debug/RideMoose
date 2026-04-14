-- Make the avatars bucket private so listing is fully blocked.
-- Access is now controlled by the scoped RLS policies.
UPDATE storage.buckets SET public = false WHERE id = 'avatars';