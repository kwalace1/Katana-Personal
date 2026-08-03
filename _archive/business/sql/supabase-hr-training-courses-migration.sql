-- =============================================================================
-- HR Training: course catalog + assignment metadata on learning paths
-- Run in Supabase SQL Editor after supabase-hr-full-schema.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- hr_training_courses (org course catalog)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text DEFAULT 'General',
  level text DEFAULT 'intermediate' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  duration_hours numeric DEFAULT 0,
  skills text[] NOT NULL DEFAULT '{}',
  certifications text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_training_courses_org_idx ON public.hr_training_courses(organization_id);

ALTER TABLE public.hr_training_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation_hr_training_courses" ON public.hr_training_courses;
CREATE POLICY "org_isolation_hr_training_courses" ON public.hr_training_courses
  FOR ALL USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- Employees can read active courses in their org (for catalog)
DROP POLICY IF EXISTS "hr_training_courses_select_org_member" ON public.hr_training_courses;
CREATE POLICY "hr_training_courses_select_org_member" ON public.hr_training_courses
  FOR SELECT USING (organization_id = get_user_organization_id());

-- -----------------------------------------------------------------------------
-- Extend hr_learning_paths
-- -----------------------------------------------------------------------------
ALTER TABLE public.hr_learning_paths
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.hr_training_courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS notes text;

-- -----------------------------------------------------------------------------
-- Portal: employees can update their own learning path progress
-- -----------------------------------------------------------------------------
CREATE POLICY "hr_learning_update_subject"
  ON public.hr_learning_paths FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.hr_employees e
      INNER JOIN auth.users u ON lower(trim(both from u.email::text)) = lower(trim(both from e.email::text))
      WHERE e.id = hr_learning_paths.employee_id AND u.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.hr_employees e
      INNER JOIN auth.users u ON lower(trim(both from u.email::text)) = lower(trim(both from e.email::text))
      WHERE e.id = hr_learning_paths.employee_id AND u.id = auth.uid()
    )
  );
