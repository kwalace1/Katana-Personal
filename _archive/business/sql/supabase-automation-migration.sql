-- Automation module: storage bucket + job history for Dashboard / Browser Tools / Documents.
-- Run in Supabase SQL Editor.
-- Also run: supabase-automation-documents-migration.sql (text index + agent search views).

-- ---------------------------------------------------------------------------
-- Bucket for Automation document uploads
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'automation-files',
  'automation-files',
  true,
  26214400,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/json',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/zip'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "automation_files_insert" ON storage.objects;
CREATE POLICY "automation_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'automation-files');

DROP POLICY IF EXISTS "automation_files_select" ON storage.objects;
CREATE POLICY "automation_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'automation-files');

DROP POLICY IF EXISTS "automation_files_public_select" ON storage.objects;
CREATE POLICY "automation_files_public_select" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'automation-files');

DROP POLICY IF EXISTS "automation_files_delete" ON storage.objects;
CREATE POLICY "automation_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'automation-files');

-- ---------------------------------------------------------------------------
-- Job / activity log (browser tools + document events for Dashboard)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  job_type text NOT NULL CHECK (
    job_type IN (
      'screenshot',
      'extract_text',
      'fill_form',
      'click',
      'download',
      'document_upload'
    )
  ),
  status text NOT NULL DEFAULT 'completed' CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  ),
  title text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS automation_jobs_org_created_idx
  ON public.automation_jobs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS automation_jobs_org_type_idx
  ON public.automation_jobs (organization_id, job_type);

ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation_automation_jobs" ON public.automation_jobs;
CREATE POLICY "org_isolation_automation_jobs" ON public.automation_jobs
  FOR ALL
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

COMMENT ON TABLE public.automation_jobs IS
  'Automation module job history for browser tools and document activity.';
