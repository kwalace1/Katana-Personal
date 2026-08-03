-- =============================================================================
-- RLS: Restrict access to authenticated users only
-- Run this in Supabase Dashboard → SQL Editor AFTER your tables and RLS exist.
-- This replaces "allow all" policies so only signed-in users (auth.uid() not null)
-- can read/write. Anonymous requests get no rows.
-- =============================================================================

-- Helper: drop policy if exists (PostgreSQL 10+)
do $$
begin
  -- HR
  drop policy if exists "Allow all for hr_employees" on public.hr_employees;
  -- Projects
  drop policy if exists "Allow all on projects" on public.projects;
  drop policy if exists "Allow all on tasks" on public.tasks;
  drop policy if exists "Allow all on milestones" on public.milestones;
  drop policy if exists "Allow all on milestone_tasks" on public.milestone_tasks;
  drop policy if exists "Allow all on team_members" on public.team_members;
  drop policy if exists "Allow all on project_files" on public.project_files;
  drop policy if exists "Allow all on activities" on public.activities;
  drop policy if exists "Allow all on sprints" on public.sprints;
  drop policy if exists "Allow all on sprint_tasks" on public.sprint_tasks;
  -- Inventory
  drop policy if exists "Allow all on purchase_orders" on public.purchase_orders;
  drop policy if exists "Allow all on po_line_items" on public.po_line_items;
  -- WFM
  drop policy if exists "Allow all on wfm_technicians" on public.wfm_technicians;
  drop policy if exists "Allow all on wfm_jobs" on public.wfm_jobs;
  drop policy if exists "Allow all on wfm_schedules" on public.wfm_schedules;
  drop policy if exists "Allow all on wfm_timesheets" on public.wfm_timesheets;
  drop policy if exists "Allow all on wfm_job_notes" on public.wfm_job_notes;
  -- Customer Success
  drop policy if exists "Allow all on csm_users" on public.csm_users;
  drop policy if exists "Allow all on cs_clients" on public.cs_clients;
  drop policy if exists "Allow all on cs_tasks" on public.cs_tasks;
  drop policy if exists "Allow all on cs_milestones" on public.cs_milestones;
  drop policy if exists "Allow all on cs_interactions" on public.cs_interactions;
  drop policy if exists "Allow all on cs_health_history" on public.cs_health_history;
end $$;

-- HR
create policy "Authenticated only hr_employees"
  on public.hr_employees for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Projects
create policy "Authenticated only projects" on public.projects for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only tasks" on public.tasks for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only milestones" on public.milestones for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only milestone_tasks" on public.milestone_tasks for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only team_members" on public.team_members for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only project_files" on public.project_files for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only activities" on public.activities for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only sprints" on public.sprints for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only sprint_tasks" on public.sprint_tasks for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Inventory
create policy "Authenticated only purchase_orders" on public.purchase_orders for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only po_line_items" on public.po_line_items for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- WFM
create policy "Authenticated only wfm_technicians" on public.wfm_technicians for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only wfm_jobs" on public.wfm_jobs for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only wfm_schedules" on public.wfm_schedules for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only wfm_timesheets" on public.wfm_timesheets for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only wfm_job_notes" on public.wfm_job_notes for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Customer Success
create policy "Authenticated only csm_users" on public.csm_users for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only cs_clients" on public.cs_clients for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only cs_tasks" on public.cs_tasks for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only cs_milestones" on public.cs_milestones for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only cs_interactions" on public.cs_interactions for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated only cs_health_history" on public.cs_health_history for all using (auth.uid() is not null) with check (auth.uid() is not null);
