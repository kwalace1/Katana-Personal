-- =============================================================================
-- PM: multiple task assignees (JSON array on tasks)
-- Run in Supabase SQL Editor after supabase-pm-hr-link-migration.sql
-- =============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignees jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tasks.assignees IS
  'Array of { employeeId, name, avatar }; primary assignee_* columns mirror the first entry for legacy queries.';

-- Optional backfill from existing single assignee
UPDATE public.tasks
SET assignees = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'employeeId', assignee_employee_id,
      'name', assignee_name,
      'avatar', assignee_avatar
    )
  )
)
WHERE (assignees IS NULL OR assignees = '[]'::jsonb)
  AND coalesce(trim(assignee_name), '') <> ''
  AND lower(trim(assignee_name)) <> 'unassigned';
