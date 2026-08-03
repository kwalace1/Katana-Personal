-- =============================================================================
-- BACKFILL: Assign existing rows to your user_id
-- =============================================================================
-- Replace 'YOUR_AUTH_USER_UUID_HERE' with your actual auth.users.id from Supabase.
--
-- To find your UUID:
--   SELECT id, email FROM auth.users WHERE email ILIKE '%etomlinson%';
--
-- Then run this script with your UUID substituted.
-- After backfill, you can optionally make user_id NOT NULL (see bottom).
-- =============================================================================

DO $$
DECLARE
  owner_id uuid := 'YOUR_AUTH_USER_UUID_HERE';  -- <-- REPLACE THIS
BEGIN
  -- Projects module
  UPDATE public.projects        SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.tasks           SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.milestones      SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.milestone_tasks SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.team_members    SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.project_files   SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.activities      SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.sprints         SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.sprint_tasks    SET user_id = owner_id WHERE user_id IS NULL;

  -- HR module
  UPDATE public.hr_employees          SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.hr_performance_reviews SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.hr_goals              SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.hr_goal_comments      SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.hr_360_feedback       SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.hr_mentorships        SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.hr_recognitions       SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.hr_learning_paths     SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.hr_career_paths       SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.hr_activities         SET user_id = owner_id WHERE user_id IS NULL;

  -- WFM module
  UPDATE public.wfm_technicians SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.wfm_jobs        SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.wfm_schedules   SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.wfm_timesheets  SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.wfm_job_notes   SET user_id = owner_id WHERE user_id IS NULL;

  -- Inventory module
  UPDATE public.inventory_items        SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.inventory_movements    SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.purchase_orders        SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.po_line_items          SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.suppliers              SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.inventory_transactions SET user_id = owner_id WHERE user_id IS NULL;

  -- Customer Success module
  UPDATE public.csm_users         SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.cs_clients        SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.cs_tasks          SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.cs_milestones     SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.cs_interactions   SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.cs_health_history SET user_id = owner_id WHERE user_id IS NULL;

  -- KYI module (user-owned tables only)
  UPDATE public.kyi_companies            SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.kyi_investors            SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.kyi_client_geo_settings  SET user_id = owner_id WHERE user_id IS NULL;
  UPDATE public.kyi_investor_geo_settings SET user_id = owner_id WHERE user_id IS NULL;

  RAISE NOTICE 'Backfill complete — all NULL user_id rows assigned to %', owner_id;
END $$;

-- =============================================================================
-- OPTIONAL: Make user_id NOT NULL after backfill (run AFTER verifying backfill)
-- =============================================================================
-- Uncomment and run these after confirming no NULL user_id rows remain:
--
-- ALTER TABLE public.projects        ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.tasks           ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.milestones      ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.milestone_tasks ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.team_members    ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.project_files   ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.activities      ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.sprints         ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.sprint_tasks    ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.hr_employees          ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.hr_performance_reviews ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.hr_goals              ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.hr_goal_comments      ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.hr_360_feedback       ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.hr_mentorships        ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.hr_recognitions       ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.hr_learning_paths     ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.hr_career_paths       ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.hr_activities         ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.wfm_technicians ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.wfm_jobs        ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.wfm_schedules   ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.wfm_timesheets  ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.wfm_job_notes   ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.inventory_items        ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.inventory_movements    ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.purchase_orders        ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.po_line_items          ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.suppliers              ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.inventory_transactions ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.csm_users         ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.cs_clients        ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.cs_tasks          ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.cs_milestones     ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.cs_interactions   ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.cs_health_history ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.kyi_companies            ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.kyi_investors            ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.kyi_client_geo_settings  ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.kyi_investor_geo_settings ALTER COLUMN user_id SET NOT NULL;
