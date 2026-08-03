-- Customer Success / CRM files bucket (commerce logos, attachments)
-- Run in Supabase SQL Editor if logo uploads fail with bucket-not-found.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cs-files',
  'cs-files',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cs_files_insert" ON storage.objects;
CREATE POLICY "cs_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cs-files');

DROP POLICY IF EXISTS "cs_files_select" ON storage.objects;
CREATE POLICY "cs_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cs-files');

DROP POLICY IF EXISTS "cs_files_public_select" ON storage.objects;
CREATE POLICY "cs_files_public_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'cs-files');

DROP POLICY IF EXISTS "cs_files_delete" ON storage.objects;
CREATE POLICY "cs_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cs-files');
