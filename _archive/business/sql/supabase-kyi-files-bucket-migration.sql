-- =============================================================================
-- KYI private document storage bucket (NDAs / deal docs)
-- Org-scoped paths: {organization_id}/{investor_id}/{filename}
-- Run in Supabase SQL Editor. Idempotent.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyi-files',
  'kyi-files',
  false,
  26214400, -- 25 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = false;

-- Path convention: first folder = organization_id (uuid)
DROP POLICY IF EXISTS "kyi_files_insert" ON storage.objects;
CREATE POLICY "kyi_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyi-files'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
  );

DROP POLICY IF EXISTS "kyi_files_select" ON storage.objects;
CREATE POLICY "kyi_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyi-files'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
  );

DROP POLICY IF EXISTS "kyi_files_update" ON storage.objects;
CREATE POLICY "kyi_files_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'kyi-files'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
  );

DROP POLICY IF EXISTS "kyi_files_delete" ON storage.objects;
CREATE POLICY "kyi_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'kyi-files'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
  );

-- Optional storage_path on documents table (additive)
ALTER TABLE public.kyi_investor_documents
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_size bigint;
