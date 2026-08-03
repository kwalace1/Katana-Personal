-- =============================================================================
-- USER ISOLATION: Add user_id to all module tables + per-user RLS
-- Run in Supabase Dashboard → SQL Editor AFTER all module schemas exist.
--
-- After running this migration, backfill existing rows:
--   UPDATE public.projects SET user_id = '<YOUR_AUTH_USER_UUID>' WHERE user_id IS NULL;
--   ... repeat for every table ...
-- Then make user_id NOT NULL:
--   ALTER TABLE public.projects ALTER COLUMN user_id SET NOT NULL;
--   ... repeat for every table ...
-- =============================================================================

-- ===================== 1. ADD user_id COLUMNS =====================

-- Projects module
ALTER TABLE public.projects        ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.tasks           ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.milestones      ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.milestone_tasks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.team_members    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.project_files   ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.activities      ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.sprints         ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.sprint_tasks    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- HR module
ALTER TABLE public.hr_employees          ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.hr_performance_reviews ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.hr_goals              ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.hr_goal_comments      ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.hr_360_feedback       ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.hr_mentorships        ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.hr_recognitions       ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.hr_learning_paths     ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.hr_career_paths       ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.hr_activities         ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- WFM module
ALTER TABLE public.wfm_technicians ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.wfm_jobs        ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.wfm_schedules   ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.wfm_timesheets  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.wfm_job_notes   ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Inventory module
ALTER TABLE public.inventory_items        ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.inventory_movements    ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.purchase_orders        ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.po_line_items          ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.suppliers              ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Customer Success module
ALTER TABLE public.csm_users         ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cs_clients        ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cs_tasks          ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cs_milestones     ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cs_interactions   ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cs_health_history ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- KYI module (user-owned tables only; leads + type_profiles remain shared)
ALTER TABLE public.kyi_companies            ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.kyi_investors            ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.kyi_client_geo_settings  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.kyi_investor_geo_settings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- ===================== 2. CREATE INDEXES =====================

CREATE INDEX IF NOT EXISTS idx_projects_user_id        ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id           ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_user_id      ON public.milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id    ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_files_user_id   ON public.project_files(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id      ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_sprints_user_id         ON public.sprints(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_user_id    ON public.hr_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_reviews_user_id      ON public.hr_performance_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_goals_user_id        ON public.hr_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_wfm_technicians_user_id ON public.wfm_technicians(user_id);
CREATE INDEX IF NOT EXISTS idx_wfm_jobs_user_id        ON public.wfm_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_user_id       ON public.inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON public.purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id       ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_csm_users_user_id       ON public.csm_users(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_clients_user_id      ON public.cs_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_kyi_companies_user_id   ON public.kyi_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_kyi_investors_user_id   ON public.kyi_investors(user_id);

-- ===================== 3. DROP OLD RLS POLICIES =====================

DO $$
BEGIN
  -- Projects
  DROP POLICY IF EXISTS "Authenticated only projects"       ON public.projects;
  DROP POLICY IF EXISTS "Authenticated only tasks"          ON public.tasks;
  DROP POLICY IF EXISTS "Authenticated only milestones"     ON public.milestones;
  DROP POLICY IF EXISTS "Authenticated only milestone_tasks" ON public.milestone_tasks;
  DROP POLICY IF EXISTS "Authenticated only team_members"   ON public.team_members;
  DROP POLICY IF EXISTS "Authenticated only project_files"  ON public.project_files;
  DROP POLICY IF EXISTS "Authenticated only activities"     ON public.activities;
  DROP POLICY IF EXISTS "Authenticated only sprints"        ON public.sprints;
  DROP POLICY IF EXISTS "Authenticated only sprint_tasks"   ON public.sprint_tasks;
  DROP POLICY IF EXISTS "Allow all on projects"             ON public.projects;
  DROP POLICY IF EXISTS "Allow all on tasks"                ON public.tasks;
  DROP POLICY IF EXISTS "Allow all on milestones"           ON public.milestones;
  DROP POLICY IF EXISTS "Allow all on milestone_tasks"      ON public.milestone_tasks;
  DROP POLICY IF EXISTS "Allow all on team_members"         ON public.team_members;
  DROP POLICY IF EXISTS "Allow all on project_files"        ON public.project_files;
  DROP POLICY IF EXISTS "Allow all on activities"           ON public.activities;
  DROP POLICY IF EXISTS "Allow all on sprints"              ON public.sprints;
  DROP POLICY IF EXISTS "Allow all on sprint_tasks"         ON public.sprint_tasks;

  -- HR
  DROP POLICY IF EXISTS "Authenticated only hr_employees"   ON public.hr_employees;
  DROP POLICY IF EXISTS "Allow all for hr_employees"        ON public.hr_employees;

  -- WFM
  DROP POLICY IF EXISTS "Authenticated only wfm_technicians" ON public.wfm_technicians;
  DROP POLICY IF EXISTS "Authenticated only wfm_jobs"        ON public.wfm_jobs;
  DROP POLICY IF EXISTS "Authenticated only wfm_schedules"   ON public.wfm_schedules;
  DROP POLICY IF EXISTS "Authenticated only wfm_timesheets"  ON public.wfm_timesheets;
  DROP POLICY IF EXISTS "Authenticated only wfm_job_notes"   ON public.wfm_job_notes;
  DROP POLICY IF EXISTS "Allow all on wfm_technicians"       ON public.wfm_technicians;
  DROP POLICY IF EXISTS "Allow all on wfm_jobs"              ON public.wfm_jobs;
  DROP POLICY IF EXISTS "Allow all on wfm_schedules"         ON public.wfm_schedules;
  DROP POLICY IF EXISTS "Allow all on wfm_timesheets"        ON public.wfm_timesheets;
  DROP POLICY IF EXISTS "Allow all on wfm_job_notes"         ON public.wfm_job_notes;

  -- Inventory
  DROP POLICY IF EXISTS "Authenticated only purchase_orders" ON public.purchase_orders;
  DROP POLICY IF EXISTS "Authenticated only po_line_items"   ON public.po_line_items;
  DROP POLICY IF EXISTS "Allow all on purchase_orders"       ON public.purchase_orders;
  DROP POLICY IF EXISTS "Allow all on po_line_items"         ON public.po_line_items;

  -- Customer Success
  DROP POLICY IF EXISTS "Authenticated only csm_users"       ON public.csm_users;
  DROP POLICY IF EXISTS "Authenticated only cs_clients"      ON public.cs_clients;
  DROP POLICY IF EXISTS "Authenticated only cs_tasks"        ON public.cs_tasks;
  DROP POLICY IF EXISTS "Authenticated only cs_milestones"   ON public.cs_milestones;
  DROP POLICY IF EXISTS "Authenticated only cs_interactions" ON public.cs_interactions;
  DROP POLICY IF EXISTS "Authenticated only cs_health_history" ON public.cs_health_history;
  DROP POLICY IF EXISTS "Allow all on csm_users"             ON public.csm_users;
  DROP POLICY IF EXISTS "Allow all on cs_clients"            ON public.cs_clients;
  DROP POLICY IF EXISTS "Allow all on cs_tasks"              ON public.cs_tasks;
  DROP POLICY IF EXISTS "Allow all on cs_milestones"         ON public.cs_milestones;
  DROP POLICY IF EXISTS "Allow all on cs_interactions"       ON public.cs_interactions;
  DROP POLICY IF EXISTS "Allow all on cs_health_history"     ON public.cs_health_history;

  -- KYI
  DROP POLICY IF EXISTS "Allow all on kyi_companies"         ON public.kyi_companies;
  DROP POLICY IF EXISTS "Allow all on kyi_investors"         ON public.kyi_investors;
  DROP POLICY IF EXISTS "Allow all on kyi_client_geo_settings" ON public.kyi_client_geo_settings;
  DROP POLICY IF EXISTS "Allow all on kyi_investor_geo_settings" ON public.kyi_investor_geo_settings;
END $$;

-- ===================== 4. CREATE PER-USER RLS POLICIES =====================

-- Projects module
CREATE POLICY "user_isolation_projects"       ON public.projects       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_tasks"          ON public.tasks          FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_milestones"     ON public.milestones     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_milestone_tasks" ON public.milestone_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_team_members"   ON public.team_members   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_project_files"  ON public.project_files  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_activities"     ON public.activities     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_sprints"        ON public.sprints        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_sprint_tasks"   ON public.sprint_tasks   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- HR module
CREATE POLICY "user_isolation_hr_employees"   ON public.hr_employees          FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_hr_reviews"     ON public.hr_performance_reviews FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_hr_goals"       ON public.hr_goals              FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_hr_comments"    ON public.hr_goal_comments      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_hr_360"         ON public.hr_360_feedback       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_hr_mentorships" ON public.hr_mentorships        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_hr_recognitions" ON public.hr_recognitions      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_hr_learning"    ON public.hr_learning_paths     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_hr_career"      ON public.hr_career_paths       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_hr_activities"  ON public.hr_activities         FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- WFM module
CREATE POLICY "user_isolation_wfm_technicians" ON public.wfm_technicians FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_wfm_jobs"        ON public.wfm_jobs        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_wfm_schedules"   ON public.wfm_schedules   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_wfm_timesheets"  ON public.wfm_timesheets  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_wfm_job_notes"   ON public.wfm_job_notes   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Inventory module
CREATE POLICY "user_isolation_inv_items"        ON public.inventory_items        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_inv_movements"    ON public.inventory_movements    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_purchase_orders"  ON public.purchase_orders        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_po_line_items"    ON public.po_line_items          FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_suppliers"        ON public.suppliers              FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_inv_transactions" ON public.inventory_transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Customer Success module
CREATE POLICY "user_isolation_csm_users"       ON public.csm_users         FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_cs_clients"      ON public.cs_clients        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_cs_tasks"        ON public.cs_tasks          FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_cs_milestones"   ON public.cs_milestones     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_cs_interactions" ON public.cs_interactions   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_cs_health"       ON public.cs_health_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- KYI module (user-owned tables)
CREATE POLICY "user_isolation_kyi_companies"    ON public.kyi_companies            FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_kyi_investors"    ON public.kyi_investors            FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_kyi_client_geo"   ON public.kyi_client_geo_settings  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_isolation_kyi_investor_geo" ON public.kyi_investor_geo_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- KYI shared tables: leads + type_profiles remain authenticated-only (all users see same pool)
-- These policies should already exist; recreate if missing:
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyi_investor_leads' AND policyname = 'authenticated_kyi_leads') THEN
    CREATE POLICY "authenticated_kyi_leads" ON public.kyi_investor_leads FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kyi_investor_type_profiles' AND policyname = 'authenticated_kyi_type_profiles') THEN
    CREATE POLICY "authenticated_kyi_type_profiles" ON public.kyi_investor_type_profiles FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ===================== 5. UPDATE kyi_companies_with_counts VIEW =====================
-- Recreate view to include user_id so RLS on the underlying table works correctly.
-- NOTE: If this view doesn't exist yet in your Supabase project, skip this section.

DROP VIEW IF EXISTS public.kyi_companies_with_counts;
CREATE VIEW public.kyi_companies_with_counts AS
  SELECT
    c.id,
    c.name,
    c.location,
    c.industry,
    c.website,
    c.logo_url,
    c.description,
    c.created_at,
    c.user_id,
    COALESCE(counts.investor_count, 0) AS investor_count
  FROM public.kyi_companies c
  LEFT JOIN (
    SELECT company_id, COUNT(*)::int AS investor_count
    FROM public.kyi_investors
    GROUP BY company_id
  ) counts ON counts.company_id = c.id;

-- ===================== 6. ENABLE RLS (idempotent) =====================
-- Ensures RLS is enabled on every table (no-op if already enabled).

ALTER TABLE public.projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_goals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_goal_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_360_feedback       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_mentorships        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_recognitions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_learning_paths     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_career_paths       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_activities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_technicians       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_schedules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_timesheets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wfm_job_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_line_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csm_users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_milestones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_interactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_health_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyi_companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyi_investors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyi_client_geo_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyi_investor_geo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyi_investor_leads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyi_investor_type_profiles ENABLE ROW LEVEL SECURITY;
