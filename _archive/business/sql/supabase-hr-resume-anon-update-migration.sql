-- Allow public Careers applicants to backfill resume_url / resume_profile after upload.
-- Inserts use anon_insert_job_applications; without this, storage upload succeeds but
-- the row never gets resume_url or blind_storage_path (HR download then fails).
--
-- Run in Supabase SQL editor after supabase-hr-full-schema.sql.

drop policy if exists "anon_update_job_application_resume" on public.job_applications;
create policy "anon_update_job_application_resume" on public.job_applications
  for update to anon
  using (organization_id is null)
  with check (organization_id is null);
