-- =============================================================================
-- Pilot hardening: org-scoped RLS for Customers (CS/CRM) + Projects
-- Run in Supabase SQL Editor after get_user_organization_id() exists
-- (see supabase-comms-schema.sql / other org migrations).
--
-- - Ensures organization_id columns exist and are backfilled where possible
-- - Drops permissive "Allow all" / legacy auth-only / user-isolation policies
-- - Creates org_isolation_* policies: organization_id = get_user_organization_id()
-- =============================================================================

-- Ensure helper exists (no-op replace if already defined)
create or replace function public.get_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.user_profiles where id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- 1. Ensure organization_id columns (CS core + CRM + Projects)
-- -----------------------------------------------------------------------------
alter table public.csm_users          add column if not exists organization_id uuid;
alter table public.cs_clients         add column if not exists organization_id uuid;
alter table public.cs_tasks           add column if not exists organization_id uuid;
alter table public.cs_milestones      add column if not exists organization_id uuid;
alter table public.cs_interactions    add column if not exists organization_id uuid;
alter table public.cs_health_history  add column if not exists organization_id uuid;

alter table public.cs_contacts              add column if not exists organization_id uuid;
alter table public.cs_campaigns             add column if not exists organization_id uuid;
alter table public.cs_leads                 add column if not exists organization_id uuid;
alter table public.cs_pipeline_stages       add column if not exists organization_id uuid;
alter table public.cs_deals                 add column if not exists organization_id uuid;
alter table public.cs_quotes                add column if not exists organization_id uuid;
alter table public.cs_invoices              add column if not exists organization_id uuid;
alter table public.cs_contracts             add column if not exists organization_id uuid;
alter table public.cs_integration_settings  add column if not exists organization_id uuid;

alter table public.projects         add column if not exists organization_id uuid;
alter table public.tasks            add column if not exists organization_id uuid;
alter table public.milestones       add column if not exists organization_id uuid;
alter table public.milestone_tasks  add column if not exists organization_id uuid;
alter table public.team_members     add column if not exists organization_id uuid;
alter table public.project_files    add column if not exists organization_id uuid;
alter table public.activities       add column if not exists organization_id uuid;
alter table public.sprints          add column if not exists organization_id uuid;
alter table public.sprint_tasks     add column if not exists organization_id uuid;

-- Helpful indexes
create index if not exists csm_users_organization_id_idx on public.csm_users(organization_id);
create index if not exists cs_clients_organization_id_idx on public.cs_clients(organization_id);
create index if not exists cs_tasks_organization_id_idx on public.cs_tasks(organization_id);
create index if not exists cs_milestones_organization_id_idx on public.cs_milestones(organization_id);
create index if not exists cs_interactions_organization_id_idx on public.cs_interactions(organization_id);
create index if not exists cs_health_history_organization_id_idx on public.cs_health_history(organization_id);
create index if not exists projects_organization_id_idx on public.projects(organization_id);
create index if not exists tasks_organization_id_idx on public.tasks(organization_id);
create index if not exists milestones_organization_id_idx on public.milestones(organization_id);
create index if not exists team_members_organization_id_idx on public.team_members(organization_id);
create index if not exists project_files_organization_id_idx on public.project_files(organization_id);
create index if not exists activities_organization_id_idx on public.activities(organization_id);
create index if not exists sprints_organization_id_idx on public.sprints(organization_id);

-- -----------------------------------------------------------------------------
-- 2. Backfill organization_id from parents / owner profile where missing
-- -----------------------------------------------------------------------------

-- CS child rows ← cs_clients
update public.cs_tasks t
set organization_id = c.organization_id
from public.cs_clients c
where t.client_id = c.id
  and t.organization_id is null
  and c.organization_id is not null;

update public.cs_milestones m
set organization_id = c.organization_id
from public.cs_clients c
where m.client_id = c.id
  and m.organization_id is null
  and c.organization_id is not null;

update public.cs_interactions i
set organization_id = c.organization_id
from public.cs_clients c
where i.client_id = c.id
  and i.organization_id is null
  and c.organization_id is not null;

update public.cs_health_history h
set organization_id = c.organization_id
from public.cs_clients c
where h.client_id = c.id
  and h.organization_id is null
  and c.organization_id is not null;

update public.cs_contacts ct
set organization_id = c.organization_id
from public.cs_clients c
where ct.client_id = c.id
  and ct.organization_id is null
  and c.organization_id is not null;

-- Remaining CS / Projects rows ← user_profiles via user_id (when present)
update public.cs_clients c
set organization_id = up.organization_id
from public.user_profiles up
where c.user_id = up.id
  and c.organization_id is null
  and up.organization_id is not null;

update public.csm_users u
set organization_id = up.organization_id
from public.user_profiles up
where u.user_id = up.id
  and u.organization_id is null
  and up.organization_id is not null;

update public.cs_tasks t
set organization_id = up.organization_id
from public.user_profiles up
where t.user_id = up.id
  and t.organization_id is null
  and up.organization_id is not null;

update public.cs_milestones m
set organization_id = up.organization_id
from public.user_profiles up
where m.user_id = up.id
  and m.organization_id is null
  and up.organization_id is not null;

update public.cs_interactions i
set organization_id = up.organization_id
from public.user_profiles up
where i.user_id = up.id
  and i.organization_id is null
  and up.organization_id is not null;

update public.cs_health_history h
set organization_id = up.organization_id
from public.user_profiles up
where h.user_id = up.id
  and h.organization_id is null
  and up.organization_id is not null;

update public.cs_campaigns g
set organization_id = up.organization_id
from public.user_profiles up
where g.user_id = up.id
  and g.organization_id is null
  and up.organization_id is not null;

update public.cs_leads l
set organization_id = up.organization_id
from public.user_profiles up
where l.user_id = up.id
  and l.organization_id is null
  and up.organization_id is not null;

update public.cs_deals d
set organization_id = up.organization_id
from public.user_profiles up
where d.user_id = up.id
  and d.organization_id is null
  and up.organization_id is not null;

update public.cs_quotes q
set organization_id = up.organization_id
from public.user_profiles up
where q.user_id = up.id
  and q.organization_id is null
  and up.organization_id is not null;

update public.cs_invoices inv
set organization_id = up.organization_id
from public.user_profiles up
where inv.user_id = up.id
  and inv.organization_id is null
  and up.organization_id is not null;

update public.cs_contracts ctr
set organization_id = up.organization_id
from public.user_profiles up
where ctr.user_id = up.id
  and ctr.organization_id is null
  and up.organization_id is not null;

update public.cs_contacts ct
set organization_id = up.organization_id
from public.user_profiles up
where ct.user_id = up.id
  and ct.organization_id is null
  and up.organization_id is not null;

-- Projects child rows ← projects
update public.tasks t
set organization_id = p.organization_id
from public.projects p
where t.project_id = p.id
  and t.organization_id is null
  and p.organization_id is not null;

update public.milestones m
set organization_id = p.organization_id
from public.projects p
where m.project_id = p.id
  and m.organization_id is null
  and p.organization_id is not null;

update public.team_members tm
set organization_id = p.organization_id
from public.projects p
where tm.project_id = p.id
  and tm.organization_id is null
  and p.organization_id is not null;

update public.project_files pf
set organization_id = p.organization_id
from public.projects p
where pf.project_id = p.id
  and pf.organization_id is null
  and p.organization_id is not null;

update public.activities a
set organization_id = p.organization_id
from public.projects p
where a.project_id = p.id
  and a.organization_id is null
  and p.organization_id is not null;

update public.sprints s
set organization_id = p.organization_id
from public.projects p
where s.project_id = p.id
  and s.organization_id is null
  and p.organization_id is not null;

update public.projects p
set organization_id = up.organization_id
from public.user_profiles up
where p.user_id = up.id
  and p.organization_id is null
  and up.organization_id is not null;

update public.tasks t
set organization_id = up.organization_id
from public.user_profiles up
where t.user_id = up.id
  and t.organization_id is null
  and up.organization_id is not null;

update public.milestones m
set organization_id = up.organization_id
from public.user_profiles up
where m.user_id = up.id
  and m.organization_id is null
  and up.organization_id is not null;

update public.milestone_tasks mt
set organization_id = m.organization_id
from public.milestones m
where mt.milestone_id = m.id
  and mt.organization_id is null
  and m.organization_id is not null;

update public.sprint_tasks st
set organization_id = s.organization_id
from public.sprints s
where st.sprint_id = s.id
  and st.organization_id is null
  and s.organization_id is not null;

update public.team_members tm
set organization_id = up.organization_id
from public.user_profiles up
where tm.user_id = up.id
  and tm.organization_id is null
  and up.organization_id is not null;

update public.project_files pf
set organization_id = up.organization_id
from public.user_profiles up
where pf.user_id = up.id
  and pf.organization_id is null
  and up.organization_id is not null;

update public.activities a
set organization_id = up.organization_id
from public.user_profiles up
where a.user_id = up.id
  and a.organization_id is null
  and up.organization_id is not null;

update public.sprints s
set organization_id = up.organization_id
from public.user_profiles up
where s.user_id = up.id
  and s.organization_id is null
  and up.organization_id is not null;

update public.milestone_tasks mt
set organization_id = up.organization_id
from public.user_profiles up
where mt.user_id = up.id
  and mt.organization_id is null
  and up.organization_id is not null;

update public.sprint_tasks st
set organization_id = up.organization_id
from public.user_profiles up
where st.user_id = up.id
  and st.organization_id is null
  and up.organization_id is not null;

-- -----------------------------------------------------------------------------
-- 3. Drop permissive / legacy policies, create org isolation
-- -----------------------------------------------------------------------------
do $$
declare
  tbl text;
  legacy text;
begin
  foreach tbl in array array[
    -- Customers / CS core
    'csm_users', 'cs_clients', 'cs_tasks', 'cs_milestones', 'cs_interactions', 'cs_health_history',
    -- CRM
    'cs_contacts', 'cs_campaigns', 'cs_leads', 'cs_pipeline_stages', 'cs_deals',
    'cs_quotes', 'cs_invoices', 'cs_contracts', 'cs_integration_settings',
    -- Projects
    'projects', 'tasks', 'milestones', 'milestone_tasks', 'team_members',
    'project_files', 'activities', 'sprints', 'sprint_tasks'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);

    -- Known legacy names
    execute format('drop policy if exists %I on public.%I', 'Allow all on ' || tbl, tbl);
    execute format('drop policy if exists %I on public.%I', 'Authenticated only ' || tbl, tbl);
    execute format('drop policy if exists %I on public.%I', 'user_isolation_' || tbl, tbl);
    execute format('drop policy if exists %I on public.%I', 'org_isolation_' || tbl, tbl);

    -- Extra known aliases from older migrations
    if tbl = 'cs_health_history' then
      execute 'drop policy if exists "user_isolation_cs_health" on public.cs_health_history';
      execute 'drop policy if exists "Authenticated only cs_health_history" on public.cs_health_history';
    end if;
    if tbl = 'hr_employees' then
      execute 'drop policy if exists "Allow all for hr_employees" on public.hr_employees';
    end if;

    -- Drop any remaining "Allow all..." policies on the table
    for legacy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = tbl
        and policyname ilike 'Allow all%'
    loop
      execute format('drop policy if exists %I on public.%I', legacy, tbl);
    end loop;

    execute format(
      'create policy %I on public.%I for all using (organization_id = public.get_user_organization_id()) with check (organization_id = public.get_user_organization_id())',
      'org_isolation_' || tbl,
      tbl
    );
  end loop;
end $$;

-- Commerce templates (if present): already org-scoped in newer installs; harden policies
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'cs_commerce_templates'
  ) then
    alter table public.cs_commerce_templates enable row level security;
    drop policy if exists "Allow all on cs_commerce_templates" on public.cs_commerce_templates;
    drop policy if exists "Authenticated only cs_commerce_templates" on public.cs_commerce_templates;
    drop policy if exists "org_isolation_cs_commerce_templates" on public.cs_commerce_templates;
    create policy "org_isolation_cs_commerce_templates" on public.cs_commerce_templates
      for all
      using (organization_id = public.get_user_organization_id())
      with check (organization_id = public.get_user_organization_id());
  end if;
end $$;
