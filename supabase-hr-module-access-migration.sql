-- =============================================================================
-- Add module_access to hr_employees (if table was created before this column existed)
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================================================

ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS module_access text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.hr_employees.module_access IS 'Module IDs this employee can access (e.g. hub, projects, workforce, employee, kyi). Empty array: Katana UI allows Employee Portal only until HR assigns modules.';
