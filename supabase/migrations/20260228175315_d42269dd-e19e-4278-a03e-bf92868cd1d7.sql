
-- Storage bucket for proof photos
INSERT INTO storage.buckets (id, name, public) VALUES ('proof-photos', 'proof-photos', true);

CREATE POLICY "Drivers can upload proof photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'proof-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone authenticated can view proof photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'proof-photos' AND auth.uid() IS NOT NULL);
