-- Create employee-photos storage bucket for profile photos and HR employee images.
-- The project-files bucket already exists; this adds the missing employee-photos bucket
-- that profile-edit-dialog.tsx and add-employee-dialog.tsx upload to.
--
-- Note: PostgreSQL does not support CREATE POLICY IF NOT EXISTS; we drop then recreate.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-photos',
  'employee-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "employee_photos_insert" ON storage.objects;
CREATE POLICY "employee_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-photos');

DROP POLICY IF EXISTS "employee_photos_select" ON storage.objects;
CREATE POLICY "employee_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'employee-photos');

DROP POLICY IF EXISTS "employee_photos_delete" ON storage.objects;
CREATE POLICY "employee_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'employee-photos');

-- Private resumes for job applications (HR access only; not shown until identity reveal).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'application-resumes',
  'application-resumes',
  false,
  10485760,
  ARRAY['application/pdf', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "application_resumes_insert" ON storage.objects;
CREATE POLICY "application_resumes_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'application-resumes');

DROP POLICY IF EXISTS "application_resumes_select" ON storage.objects;
CREATE POLICY "application_resumes_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'application-resumes');

-- Public careers apply: upload into applications/{application_id}/ only
DROP POLICY IF EXISTS "application_resumes_anon_insert" ON storage.objects;
CREATE POLICY "application_resumes_anon_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'application-resumes'
    AND (storage.foldername(name))[1] = 'applications'
  );

DROP POLICY IF EXISTS "application_resumes_anon_select" ON storage.objects;
CREATE POLICY "application_resumes_anon_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'application-resumes'
    AND (storage.foldername(name))[1] = 'applications'
  );
