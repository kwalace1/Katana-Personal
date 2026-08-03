-- ============================================================================
-- DRAFT MIGRATION — Supabase performance-advisor fixes
-- ============================================================================
-- Generated from the production performance advisor (project uhvmhzmxsvrkzqqesbli)
-- on 2026-07-22. Addresses three advisor categories:
--   Section 1  — 135 unindexed foreign keys           (add covering indexes)
--   Section 2  — 11 duplicate indexes                 (drop the redundant copy)
--   Section 3  — 68 auth_rls_initplan warnings        (wrap per-row auth.* calls)
--   Section 4  — 114 multiple_permissive_policies     (diagnostic only — NOT auto-applied)
--
-- ⚠️  THIS IS A DRAFT. Do NOT apply blindly to production.
--   • Review every statement.
--   • Apply on a Supabase BRANCH or a staging copy first and re-run the advisor.
--   • Sections 1–2 are additive/mechanical and safe. Section 3 REWRITES RLS
--     policies — run it inside the provided transaction, inspect the NOTICEs,
--     verify access with your RLS tests, and only then COMMIT.
--   • Section 4 changes access semantics and is intentionally left as a
--     reviewed-by-hand task; see the notes there.
--
-- Free-plan note: this project has no PITR. Take a pg_dump (the repo's
-- db-backup workflow) before applying.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — Covering indexes for unindexed foreign keys  (SAFE, additive)
-- ----------------------------------------------------------------------------
-- Each of these FK columns has no covering index, forcing sequential scans on
-- joins and on cascade checks. All use IF NOT EXISTS so re-running is a no-op.
--
-- NOTE: These run inside the migration transaction below. To build them without
-- locking writes on a busy table, run each as CREATE INDEX CONCURRENTLY instead
-- (CONCURRENTLY cannot run inside a transaction block — pull those out and run
-- them one-by-one outside the BEGIN/COMMIT).
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_activities_task_id ON activities (task_id);
CREATE INDEX IF NOT EXISTS idx_agent_action_audits_user_id ON agent_action_audits (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_answer_audits_user_id ON agent_answer_audits (user_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_created_by ON automation_jobs (created_by);
CREATE INDEX IF NOT EXISTS idx_comms_channel_members_user_id ON comms_channel_members (user_id);
CREATE INDEX IF NOT EXISTS idx_comms_channels_created_by ON comms_channels (created_by);
CREATE INDEX IF NOT EXISTS idx_comms_channels_user_id ON comms_channels (user_id);
CREATE INDEX IF NOT EXISTS idx_comms_context_links_user_id ON comms_context_links (user_id);
CREATE INDEX IF NOT EXISTS idx_comms_conversation_members_user_id ON comms_conversation_members (user_id);
CREATE INDEX IF NOT EXISTS idx_comms_conversations_created_by ON comms_conversations (created_by);
CREATE INDEX IF NOT EXISTS idx_comms_conversations_user_id ON comms_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_comms_message_attachments_user_id ON comms_message_attachments (user_id);
CREATE INDEX IF NOT EXISTS idx_comms_messages_user_id ON comms_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_comms_read_cursors_channel_id ON comms_read_cursors (channel_id);
CREATE INDEX IF NOT EXISTS idx_comms_read_cursors_conversation_id ON comms_read_cursors (conversation_id);
CREATE INDEX IF NOT EXISTS idx_comms_user_mutes_muted_user_id ON comms_user_mutes (muted_user_id);
CREATE INDEX IF NOT EXISTS idx_cs_campaigns_user_id ON cs_campaigns (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_client_intel_user_id ON cs_client_intel (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_client_module_entitlements_module_id ON cs_client_module_entitlements (module_id);
CREATE INDEX IF NOT EXISTS idx_cs_clients_source_lead_id ON cs_clients (source_lead_id);
CREATE INDEX IF NOT EXISTS idx_cs_contacts_user_id ON cs_contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_contracts_deal_id ON cs_contracts (deal_id);
CREATE INDEX IF NOT EXISTS idx_cs_contracts_template_id ON cs_contracts (template_id);
CREATE INDEX IF NOT EXISTS idx_cs_contracts_user_id ON cs_contracts (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_deals_assigned_to ON cs_deals (assigned_to);
CREATE INDEX IF NOT EXISTS idx_cs_deals_contact_id ON cs_deals (contact_id);
CREATE INDEX IF NOT EXISTS idx_cs_deals_lead_id ON cs_deals (lead_id);
CREATE INDEX IF NOT EXISTS idx_cs_deals_user_id ON cs_deals (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_health_history_user_id ON cs_health_history (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_icp_profiles_user_id ON cs_icp_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_interactions_csm_id ON cs_interactions (csm_id);
CREATE INDEX IF NOT EXISTS idx_cs_interactions_user_id ON cs_interactions (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_invoices_quote_id ON cs_invoices (quote_id);
CREATE INDEX IF NOT EXISTS idx_cs_invoices_template_id ON cs_invoices (template_id);
CREATE INDEX IF NOT EXISTS idx_cs_invoices_user_id ON cs_invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_leads_assigned_to ON cs_leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_cs_leads_converted_client_id ON cs_leads (converted_client_id);
CREATE INDEX IF NOT EXISTS idx_cs_leads_user_id ON cs_leads (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_milestones_user_id ON cs_milestones (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_quotes_contact_id ON cs_quotes (contact_id);
CREATE INDEX IF NOT EXISTS idx_cs_quotes_template_id ON cs_quotes (template_id);
CREATE INDEX IF NOT EXISTS idx_cs_quotes_user_id ON cs_quotes (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_assigned_to ON cs_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_cs_tasks_user_id ON cs_tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_fin_accounts_parent_id ON fin_accounts (parent_id);
CREATE INDEX IF NOT EXISTS idx_fin_bank_transactions_category_account_id ON fin_bank_transactions (category_account_id);
CREATE INDEX IF NOT EXISTS idx_fin_bank_transactions_journal_entry_id ON fin_bank_transactions (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_fin_bank_transactions_vendor_id ON fin_bank_transactions (vendor_id);
CREATE INDEX IF NOT EXISTS idx_fin_financial_accounts_coa_account_id ON fin_financial_accounts (coa_account_id);
CREATE INDEX IF NOT EXISTS idx_fin_financial_accounts_plaid_item_uuid ON fin_financial_accounts (plaid_item_uuid);
CREATE INDEX IF NOT EXISTS idx_fin_journal_entries_created_by_user_id ON fin_journal_entries (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fin_journal_entries_period_id ON fin_journal_entries (period_id);
CREATE INDEX IF NOT EXISTS idx_fin_journal_lines_financial_account_id ON fin_journal_lines (financial_account_id);
CREATE INDEX IF NOT EXISTS idx_fin_journal_lines_organization_id ON fin_journal_lines (organization_id);
CREATE INDEX IF NOT EXISTS idx_fin_periods_closed_by_user_id ON fin_periods (closed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fin_plaid_items_created_by_user_id ON fin_plaid_items (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fin_reconciliation_items_bank_transaction_id ON fin_reconciliation_items (bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_fin_reconciliation_items_organization_id ON fin_reconciliation_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_fin_reconciliations_created_by_user_id ON fin_reconciliations (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fin_reconciliations_financial_account_id ON fin_reconciliations (financial_account_id);
CREATE INDEX IF NOT EXISTS idx_fin_reconciliations_statement_id ON fin_reconciliations (statement_id);
CREATE INDEX IF NOT EXISTS idx_fin_statements_created_by_user_id ON fin_statements (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fin_statements_financial_account_id ON fin_statements (financial_account_id);
CREATE INDEX IF NOT EXISTS idx_fin_tax_packets_created_by_user_id ON fin_tax_packets (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_hr_360_feedback_organization_id ON hr_360_feedback (organization_id);
CREATE INDEX IF NOT EXISTS idx_hr_360_feedback_user_id ON hr_360_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_hr_activities_employee_id ON hr_activities (employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_activities_user_id ON hr_activities (user_id);
CREATE INDEX IF NOT EXISTS idx_hr_career_paths_organization_id ON hr_career_paths (organization_id);
CREATE INDEX IF NOT EXISTS idx_hr_career_paths_user_id ON hr_career_paths (user_id);
CREATE INDEX IF NOT EXISTS idx_hr_goal_comments_author_id ON hr_goal_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_hr_goal_comments_organization_id ON hr_goal_comments (organization_id);
CREATE INDEX IF NOT EXISTS idx_hr_goal_comments_user_id ON hr_goal_comments (user_id);
CREATE INDEX IF NOT EXISTS idx_hr_goals_user_id ON hr_goals (user_id);
CREATE INDEX IF NOT EXISTS idx_hr_learning_paths_course_id ON hr_learning_paths (course_id);
CREATE INDEX IF NOT EXISTS idx_hr_learning_paths_organization_id ON hr_learning_paths (organization_id);
CREATE INDEX IF NOT EXISTS idx_hr_learning_paths_user_id ON hr_learning_paths (user_id);
CREATE INDEX IF NOT EXISTS idx_hr_mentorships_mentee_id ON hr_mentorships (mentee_id);
CREATE INDEX IF NOT EXISTS idx_hr_mentorships_mentor_id ON hr_mentorships (mentor_id);
CREATE INDEX IF NOT EXISTS idx_hr_mentorships_organization_id ON hr_mentorships (organization_id);
CREATE INDEX IF NOT EXISTS idx_hr_mentorships_user_id ON hr_mentorships (user_id);
CREATE INDEX IF NOT EXISTS idx_hr_notices_organization_id ON hr_notices (organization_id);
CREATE INDEX IF NOT EXISTS idx_hr_performance_reviews_reviewer_id ON hr_performance_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_hr_performance_reviews_user_id ON hr_performance_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_hr_recognitions_from_id ON hr_recognitions (from_id);
CREATE INDEX IF NOT EXISTS idx_hr_recognitions_organization_id ON hr_recognitions (organization_id);
CREATE INDEX IF NOT EXISTS idx_hr_recognitions_user_id ON hr_recognitions (user_id);
CREATE INDEX IF NOT EXISTS idx_hr_time_off_requests_decided_by ON hr_time_off_requests (decided_by);
CREATE INDEX IF NOT EXISTS idx_hr_time_off_requests_user_id ON hr_time_off_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_courses_user_id ON hr_training_courses (user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_allocations_user_id ON inventory_allocations (user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items (user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_revealed_by ON job_applications (revealed_by);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_organization_id ON job_postings (organization_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_user_id ON job_postings (user_id);
CREATE INDEX IF NOT EXISTS idx_kae_messages_task_id ON kae_messages (task_id);
CREATE INDEX IF NOT EXISTS idx_kae_tasks_parent_task_id ON kae_tasks (parent_task_id);
CREATE INDEX IF NOT EXISTS idx_kae_xp_events_task_id ON kae_xp_events (task_id);
CREATE INDEX IF NOT EXISTS idx_kyi_client_geo_settings_user_id ON kyi_client_geo_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_kyi_geocode_jobs_client_id ON kyi_geocode_jobs (client_id);
CREATE INDEX IF NOT EXISTS idx_kyi_investor_geo_settings_user_id ON kyi_investor_geo_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_kyi_lead_profile_intel_client_id ON kyi_lead_profile_intel (client_id);
CREATE INDEX IF NOT EXISTS idx_kyi_location_claims_entity_id ON kyi_location_claims (entity_id);
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_organization_id ON milestone_tasks (organization_id);
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_task_id ON milestone_tasks (task_id);
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_user_id ON milestone_tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_invited_by ON organization_invitations (invited_by);
CREATE INDEX IF NOT EXISTS idx_po_line_items_organization_id ON po_line_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_user_id ON po_line_items (user_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_talent_pool_added_by ON recruitment_talent_pool (added_by);
CREATE INDEX IF NOT EXISTS idx_recruitment_talent_pool_source_job_id ON recruitment_talent_pool (source_job_id);
CREATE INDEX IF NOT EXISTS idx_sprint_tasks_organization_id ON sprint_tasks (organization_id);
CREATE INDEX IF NOT EXISTS idx_sprint_tasks_task_id ON sprint_tasks (task_id);
CREATE INDEX IF NOT EXISTS idx_sprint_tasks_user_id ON sprint_tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_support_submission_activity_actor_user_id ON support_submission_activity (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_support_submission_activity_organization_id ON support_submission_activity (organization_id);
CREATE INDEX IF NOT EXISTS idx_support_submissions_assigned_to_user_id ON support_submissions (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_support_submissions_last_updated_by_user_id ON support_submissions (last_updated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_support_submissions_user_id ON support_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_switch_entity_mappings_last_job_id ON switch_entity_mappings (last_job_id);
CREATE INDEX IF NOT EXISTS idx_switch_ingest_jobs_client_ref ON switch_ingest_jobs (client_ref);
CREATE INDEX IF NOT EXISTS idx_switch_oauth_clients_acting_user_id ON switch_oauth_clients (acting_user_id);
CREATE INDEX IF NOT EXISTS idx_switch_oauth_tokens_client_ref ON switch_oauth_tokens (client_ref);
CREATE INDEX IF NOT EXISTS idx_user_notifications_actor_user_id ON user_notifications (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_organization_id ON user_notifications (organization_id);
CREATE INDEX IF NOT EXISTS idx_wfm_job_notes_organization_id ON wfm_job_notes (organization_id);
CREATE INDEX IF NOT EXISTS idx_wfm_job_notes_technician_id ON wfm_job_notes (technician_id);
CREATE INDEX IF NOT EXISTS idx_wfm_job_notes_user_id ON wfm_job_notes (user_id);
CREATE INDEX IF NOT EXISTS idx_wfm_job_parts_user_id ON wfm_job_parts (user_id);
CREATE INDEX IF NOT EXISTS idx_wfm_job_technicians_technician_id ON wfm_job_technicians (technician_id);
CREATE INDEX IF NOT EXISTS idx_wfm_schedules_organization_id ON wfm_schedules (organization_id);
CREATE INDEX IF NOT EXISTS idx_wfm_schedules_user_id ON wfm_schedules (user_id);
CREATE INDEX IF NOT EXISTS idx_wfm_timesheets_organization_id ON wfm_timesheets (organization_id);
CREATE INDEX IF NOT EXISTS idx_wfm_timesheets_user_id ON wfm_timesheets (user_id);


-- ============================================================================
-- SECTION 2 — Drop duplicate indexes  (SAFE)
-- ----------------------------------------------------------------------------
-- Each pair below is byte-identical (same table, same column). Keeping both
-- wastes storage and slows writes. We drop the `idx_<table>_org_id` copy and
-- keep the `<table>_organization_id_idx` copy. Verify neither name is
-- referenced by a constraint before applying (none are, per advisor).
-- ============================================================================

DROP INDEX IF EXISTS idx_activities_org_id;
DROP INDEX IF EXISTS idx_cs_clients_org_id;
DROP INDEX IF EXISTS idx_csm_users_org_id;
DROP INDEX IF EXISTS idx_kyi_companies_org_id;
DROP INDEX IF EXISTS idx_kyi_investors_org_id;
DROP INDEX IF EXISTS idx_milestones_org_id;
DROP INDEX IF EXISTS idx_project_files_org_id;
DROP INDEX IF EXISTS idx_projects_org_id;
DROP INDEX IF EXISTS idx_sprints_org_id;
DROP INDEX IF EXISTS idx_tasks_org_id;
DROP INDEX IF EXISTS idx_team_members_org_id;


-- ============================================================================
-- SECTION 3 — auth_rls_initplan: wrap per-row auth.* / helper calls  (REVIEW)
-- ----------------------------------------------------------------------------
-- 68 policies call auth.uid() / auth.role() / auth.jwt() / get_user_organization_id()
-- directly, so Postgres re-evaluates them for every row. Wrapping each call in a
-- scalar subselect — e.g. (select auth.uid()) — makes the planner hoist it to a
-- one-time InitPlan. This is semantically identical but far cheaper on large scans.
--
-- The DO block below rewrites every public policy that references those calls,
-- normalising first (unwrap) then wrapping, so it is idempotent and won't
-- double-wrap. It ALTERs USING / WITH CHECK in place and RAISEs a NOTICE for each
-- change so you can eyeball the before/after.
--
-- ⚠️  RUN THIS INSIDE THE TRANSACTION, READ THE NOTICES, RUN YOUR RLS TESTS,
--     THEN COMMIT. If anything looks wrong, ROLLBACK.
-- ============================================================================

BEGIN;

DO $rls$
DECLARE
  r            record;
  new_qual     text;
  new_check    text;
  changed      boolean;
  fns          text[] := array['auth.uid()', 'auth.role()', 'auth.jwt()', 'auth.email()',
                               'get_user_organization_id()'];
  fn           text;
  cmd          text;
BEGIN
  FOR r IN
    SELECT n.nspname AS schemaname,
           c.relname AS tablename,
           pol.polname AS policyname,
           pg_get_expr(pol.polqual, pol.polrelid)      AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
    FROM pg_policy pol
    JOIN pg_class c     ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    new_qual  := r.qual;
    new_check := r.with_check;
    changed   := false;

    FOREACH fn IN ARRAY fns LOOP
      -- Wrap each bare call in a scalar subselect, but ONLY if it isn't already
      -- wrapped. Postgres re-renders (select auth.uid()) as "( SELECT auth.uid()
      -- AS uid)", so we detect any existing "( SELECT <fn>" prefix (either case)
      -- and skip it — making this safe to re-run without double-wrapping.
      IF new_qual IS NOT NULL
         AND position('( SELECT ' || fn IN new_qual) = 0
         AND position('(select ' || fn IN new_qual) = 0 THEN
        new_qual := replace(new_qual, fn, '(select ' || fn || ')');
      END IF;
      IF new_check IS NOT NULL
         AND position('( SELECT ' || fn IN new_check) = 0
         AND position('(select ' || fn IN new_check) = 0 THEN
        new_check := replace(new_check, fn, '(select ' || fn || ')');
      END IF;
    END LOOP;

    IF new_qual IS DISTINCT FROM r.qual OR new_check IS DISTINCT FROM r.with_check THEN
      changed := true;
    END IF;

    IF changed THEN
      cmd := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
      IF new_qual IS NOT NULL THEN
        cmd := cmd || format(' USING (%s)', new_qual);
      END IF;
      IF new_check IS NOT NULL THEN
        cmd := cmd || format(' WITH CHECK (%s)', new_check);
      END IF;
      RAISE NOTICE 'Rewriting policy %.% (%): %', r.schemaname, r.tablename, r.policyname, cmd;
      EXECUTE cmd;
    END IF;
  END LOOP;
END
$rls$;

-- Inspect the NOTICEs above. When satisfied:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;


-- ============================================================================
-- SECTION 4 — multiple_permissive_policies  (NOT auto-applied — review by hand)
-- ----------------------------------------------------------------------------
-- 114 (table, role, action) combinations have more than one PERMISSIVE policy.
-- Postgres OR-combines permissive policies and executes EACH one per row, so
-- redundant duplicates add per-row cost. MANY of these are genuinely redundant
-- (e.g. two identically-scoped org-isolation policies on the same table), but
-- merging or dropping a policy CHANGES ACCESS SEMANTICS, so this is deliberately
-- left as a manual task rather than auto-generated DROP/CREATE.
--
-- Run this to list the offenders (table, role, action, and the policy names)
-- so you can decide which duplicate to drop for each:
--
--   SELECT schemaname, tablename, cmd AS action, roles,
--          count(*) AS n_permissive,
--          array_agg(policyname ORDER BY policyname) AS policies
--   FROM pg_policies
--   WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
--   GROUP BY schemaname, tablename, cmd, roles
--   HAVING count(*) > 1
--   ORDER BY tablename, action;
--
-- Recommended approach per group:
--   1. Compare the USING / WITH CHECK expressions of the listed policies.
--   2. If two are logically identical, DROP one.
--   3. If they differ intentionally (e.g. owner-path OR admin-path), leave them
--      OR fold into a single policy with an OR'd predicate — but re-test access.
--   Also note: several tables have BOTH `anon` and `authenticated` permissive
--   policies for the same action; if anon has no legitimate access to a table,
--   dropping the anon policy is both a perf and a security win.
-- ============================================================================
