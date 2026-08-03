-- =============================================================================
-- PM ↔ HR link: task assignee and project team roster tied to hr_employees
-- Run in Supabase SQL Editor after hr_employees exists.
-- =============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_employee_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS hr_employee_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_employee_id ON public.tasks(assignee_employee_id);
CREATE INDEX IF NOT EXISTS idx_team_members_hr_employee_id ON public.team_members(hr_employee_id);

COMMENT ON COLUMN public.tasks.assignee_employee_id IS 'HR employee assigned to this task; stable join for Employee Portal.';
COMMENT ON COLUMN public.team_members.hr_employee_id IS 'HR employee linked to this roster row; enables org-wide assignees.';

-- Optional backfill: match team member display name to hr_employees.name (first match per org)
-- UPDATE public.team_members tm
-- SET hr_employee_id = e.id
-- FROM public.hr_employees e
-- WHERE tm.hr_employee_id IS NULL
--   AND trim(lower(tm.name)) = trim(lower(e.name))
--   AND tm.organization_id = e.organization_id;
