-- =============================================================================
-- Add organization_name to support_submissions for pilot email context
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

alter table public.support_submissions
  add column if not exists organization_name text;
