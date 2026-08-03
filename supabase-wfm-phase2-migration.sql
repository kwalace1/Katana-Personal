-- =============================================================================
-- Katana Workforce Phase 2 — HR employee link for team roster sync
-- Run after supabase-wfm-schema.sql and supabase-hr-schema.sql
-- =============================================================================

ALTER TABLE public.wfm_technicians
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wfm_technicians_employee_id_idx ON public.wfm_technicians(employee_id);

COMMENT ON COLUMN public.wfm_technicians.employee_id IS
  'Optional link to HR employee — populated by Sync from HR in Workforce Team tab';
