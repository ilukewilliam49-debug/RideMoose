
-- Drop overly broad proof-photos SELECT (scoped policies already exist)
DROP POLICY IF EXISTS "Anyone authenticated can view proof photos" ON storage.objects;

-- Drop overly broad voice-messages INSERT (scoped policy already exists)
DROP POLICY IF EXISTS "Authenticated users can upload voice messages" ON storage.objects;

-- Drop overly broad chat-images INSERT (scoped policy already exists)
DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
