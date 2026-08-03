-- =============================================================================
-- Pilot hardening: org-scoped RLS for Know Your Investor (KYI)
-- Run in Supabase SQL Editor after get_user_organization_id() exists
-- (see supabase-comms-schema.sql / other org migrations).
--
-- - Ensures organization_id columns exist and are backfilled where possible
-- - Drops permissive "Allow all" / authenticated_kyi_* / user_isolation_* policies
-- - Creates org_isolation_* policies: organization_id = get_user_organization_id()
-- - kyi_investor_leads: null organization_id = read-only platform catalog
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
-- 1. Ensure organization_id columns on primary KYI tables
-- -----------------------------------------------------------------------------
alter table public.kyi_companies
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.kyi_investors
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.kyi_investor_leads
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.kyi_client_geo_settings
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.kyi_investor_geo_settings
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

alter table public.kyi_company_geo_targets
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

-- kyi_data_categories comes from supabase-system-update-migrations.sql (optional on older DBs)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_data_categories'
  ) then
    alter table public.kyi_data_categories
      add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
    execute 'create index if not exists kyi_data_categories_org_idx on public.kyi_data_categories(organization_id)';
  end if;
end $$;

-- Helpful indexes
create index if not exists kyi_companies_organization_id_idx on public.kyi_companies(organization_id);
create index if not exists kyi_investors_organization_id_idx on public.kyi_investors(organization_id);
create index if not exists kyi_investor_leads_organization_id_idx on public.kyi_investor_leads(organization_id);
create index if not exists kyi_client_geo_settings_organization_id_idx on public.kyi_client_geo_settings(organization_id);
create index if not exists kyi_investor_geo_settings_organization_id_idx on public.kyi_investor_geo_settings(organization_id);
create index if not exists kyi_company_geo_targets_organization_id_idx on public.kyi_company_geo_targets(organization_id);

-- -----------------------------------------------------------------------------
-- 2. Backfill organization_id
-- Companies / investors ← user_profiles via user_id
-- Child rows ← parent company
-- Leads with null org stay as platform catalog (intentionally not backfilled)
-- -----------------------------------------------------------------------------

update public.kyi_companies c
set organization_id = up.organization_id
from public.user_profiles up
where c.user_id = up.id
  and c.organization_id is null
  and up.organization_id is not null;

update public.kyi_investors i
set organization_id = up.organization_id
from public.user_profiles up
where i.user_id = up.id
  and i.organization_id is null
  and up.organization_id is not null;

-- Investors ← parent company when still null
update public.kyi_investors i
set organization_id = c.organization_id
from public.kyi_companies c
where i.company_id = c.id
  and i.organization_id is null
  and c.organization_id is not null;

-- Geo settings ← parent company / investor
update public.kyi_client_geo_settings g
set organization_id = c.organization_id
from public.kyi_companies c
where g.client_id = c.id
  and g.organization_id is null
  and c.organization_id is not null;

update public.kyi_client_geo_settings g
set organization_id = up.organization_id
from public.user_profiles up
where g.user_id = up.id
  and g.organization_id is null
  and up.organization_id is not null;

update public.kyi_investor_geo_settings g
set organization_id = i.organization_id
from public.kyi_investors i
where g.investor_id = i.id
  and g.organization_id is null
  and i.organization_id is not null;

update public.kyi_investor_geo_settings g
set organization_id = up.organization_id
from public.user_profiles up
where g.user_id = up.id
  and g.organization_id is null
  and up.organization_id is not null;

update public.kyi_company_geo_targets t
set organization_id = c.organization_id
from public.kyi_companies c
where t.company_id = c.id
  and t.organization_id is null
  and c.organization_id is not null;

-- kyi_investor_leads has no user_id column. Leave organization_id null for existing
-- rows = read-only platform catalog. New tenant imports set organization_id in the app.

-- -----------------------------------------------------------------------------
-- 3. Views: security_invoker + expose organization_id on companies_with_counts
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'kyi_companies_with_counts'
  ) then
    drop view if exists public.kyi_companies_with_counts;
  end if;
end $$;

create or replace view public.kyi_companies_with_counts as
  select
    c.id,
    c.name,
    c.location,
    c.industry,
    c.website,
    c.logo_url,
    c.description,
    c.created_at,
    c.user_id,
    c.organization_id,
    coalesce(counts.investor_count, 0)::int as investor_count
  from public.kyi_companies c
  left join (
    select company_id, count(*)::int as investor_count
    from public.kyi_investors
    group by company_id
  ) counts on counts.company_id = c.id;

alter view public.kyi_companies_with_counts set (security_invoker = true);

do $$
begin
  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'kyi_leads_for_client'
  ) then
    execute 'alter view public.kyi_leads_for_client set (security_invoker = true)';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Drop permissive / legacy policies, create org isolation
-- -----------------------------------------------------------------------------
do $$
declare
  tbl text;
  legacy text;
  extra text;
begin
  foreach tbl in array array[
    'kyi_companies',
    'kyi_investors',
    'kyi_investor_leads',
    'kyi_client_geo_settings',
    'kyi_investor_geo_settings',
    'kyi_company_geo_targets',
    'kyi_data_categories',
    'kyi_northstar_config',
    'kyi_investor_meetings',
    'kyi_company_investor_categories',
    'kyi_lead_notes',
    'kyi_lead_profile_intel',
    'kyi_geocode_cache',
    'kyi_geocode_jobs',
    'kyi_entities',
    'kyi_location_claims',
    'kyi_claim_geocode_jobs',
    'kyi_platform_metadata',
    'kyi_investor_type_profiles'
  ]
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = tbl
    ) then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', tbl);

    -- Known legacy / permissive names
    execute format('drop policy if exists %I on public.%I', 'Allow all on ' || tbl, tbl);
    execute format('drop policy if exists %I on public.%I', 'user_isolation_' || tbl, tbl);
    execute format('drop policy if exists %I on public.%I', 'org_isolation_' || tbl, tbl);

    -- Abbreviated user_isolation names from supabase-user-isolation-migration.sql
    if tbl = 'kyi_client_geo_settings' then
      execute 'drop policy if exists "user_isolation_kyi_client_geo" on public.kyi_client_geo_settings';
    end if;
    if tbl = 'kyi_investor_geo_settings' then
      execute 'drop policy if exists "user_isolation_kyi_investor_geo" on public.kyi_investor_geo_settings';
    end if;

    -- authenticated_kyi_* policies (exact names from schema / migrations)
    for extra in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = tbl
        and (
          policyname ilike 'authenticated_kyi_%'
          or policyname ilike 'user_isolation_kyi_%'
          or policyname ilike 'Allow all%'
        )
    loop
      execute format('drop policy if exists %I on public.%I', extra, tbl);
    end loop;
  end loop;
end $$;

-- Direct org-column tables
drop policy if exists "org_isolation_kyi_companies" on public.kyi_companies;
create policy "org_isolation_kyi_companies" on public.kyi_companies
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

drop policy if exists "org_isolation_kyi_investors" on public.kyi_investors;
create policy "org_isolation_kyi_investors" on public.kyi_investors
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

drop policy if exists "org_isolation_kyi_client_geo_settings" on public.kyi_client_geo_settings;
create policy "org_isolation_kyi_client_geo_settings" on public.kyi_client_geo_settings
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

drop policy if exists "org_isolation_kyi_investor_geo_settings" on public.kyi_investor_geo_settings;
create policy "org_isolation_kyi_investor_geo_settings" on public.kyi_investor_geo_settings
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

drop policy if exists "org_isolation_kyi_company_geo_targets" on public.kyi_company_geo_targets;
create policy "org_isolation_kyi_company_geo_targets" on public.kyi_company_geo_targets
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_data_categories'
  ) then
    drop policy if exists "org_isolation_kyi_data_categories" on public.kyi_data_categories;
    create policy "org_isolation_kyi_data_categories" on public.kyi_data_categories
      for all
      using (organization_id = public.get_user_organization_id())
      with check (organization_id = public.get_user_organization_id());
  end if;
end $$;

-- Leads: org-owned + read-only platform catalog (organization_id IS NULL)
drop policy if exists "org_isolation_kyi_investor_leads_select" on public.kyi_investor_leads;
drop policy if exists "org_isolation_kyi_investor_leads_write" on public.kyi_investor_leads;
drop policy if exists "org_isolation_kyi_investor_leads_update" on public.kyi_investor_leads;
drop policy if exists "org_isolation_kyi_investor_leads_delete" on public.kyi_investor_leads;
drop policy if exists "org_isolation_kyi_investor_leads" on public.kyi_investor_leads;

create policy "org_isolation_kyi_investor_leads_select" on public.kyi_investor_leads
  for select
  using (
    organization_id = public.get_user_organization_id()
    or organization_id is null
  );

create policy "org_isolation_kyi_investor_leads_write" on public.kyi_investor_leads
  for insert
  with check (organization_id = public.get_user_organization_id());

create policy "org_isolation_kyi_investor_leads_update" on public.kyi_investor_leads
  for update
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

create policy "org_isolation_kyi_investor_leads_delete" on public.kyi_investor_leads
  for delete
  using (organization_id = public.get_user_organization_id());

-- Child tables without organization_id: join to kyi_companies
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_northstar_config'
  ) then
    drop policy if exists "org_isolation_kyi_northstar_config" on public.kyi_northstar_config;
    create policy "org_isolation_kyi_northstar_config" on public.kyi_northstar_config
      for all
      using (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_northstar_config.company_id
            and c.organization_id = public.get_user_organization_id()
        )
      )
      with check (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_northstar_config.company_id
            and c.organization_id = public.get_user_organization_id()
        )
      );
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_investor_meetings'
  ) then
    drop policy if exists "org_isolation_kyi_investor_meetings" on public.kyi_investor_meetings;
    create policy "org_isolation_kyi_investor_meetings" on public.kyi_investor_meetings
      for all
      using (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_investor_meetings.company_id
            and c.organization_id = public.get_user_organization_id()
        )
      )
      with check (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_investor_meetings.company_id
            and c.organization_id = public.get_user_organization_id()
        )
      );
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_company_investor_categories'
  ) then
    drop policy if exists "org_isolation_kyi_company_investor_categories" on public.kyi_company_investor_categories;
    create policy "org_isolation_kyi_company_investor_categories" on public.kyi_company_investor_categories
      for all
      using (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_company_investor_categories.company_id
            and c.organization_id = public.get_user_organization_id()
        )
      )
      with check (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_company_investor_categories.company_id
            and c.organization_id = public.get_user_organization_id()
        )
      );
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_lead_profile_intel'
  ) then
    drop policy if exists "org_isolation_kyi_lead_profile_intel" on public.kyi_lead_profile_intel;
    create policy "org_isolation_kyi_lead_profile_intel" on public.kyi_lead_profile_intel
      for all
      using (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_lead_profile_intel.client_id
            and c.organization_id = public.get_user_organization_id()
        )
      )
      with check (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_lead_profile_intel.client_id
            and c.organization_id = public.get_user_organization_id()
        )
      );
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_lead_notes'
  ) then
    drop policy if exists "kyi_lead_notes_investor_owner" on public.kyi_lead_notes;
    drop policy if exists "org_isolation_kyi_lead_notes" on public.kyi_lead_notes;
    create policy "org_isolation_kyi_lead_notes" on public.kyi_lead_notes
      for all
      using (
        exists (
          select 1 from public.kyi_investors i
          where i.id = kyi_lead_notes.investor_id
            and i.organization_id = public.get_user_organization_id()
        )
      )
      with check (
        exists (
          select 1 from public.kyi_investors i
          where i.id = kyi_lead_notes.investor_id
            and i.organization_id = public.get_user_organization_id()
        )
      );
  end if;

  -- Geocode jobs / entities / claims: join via client company
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_geocode_jobs'
  ) then
    drop policy if exists "org_isolation_kyi_geocode_jobs" on public.kyi_geocode_jobs;
    create policy "org_isolation_kyi_geocode_jobs" on public.kyi_geocode_jobs
      for all
      using (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_geocode_jobs.client_id
            and c.organization_id = public.get_user_organization_id()
        )
      )
      with check (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_geocode_jobs.client_id
            and c.organization_id = public.get_user_organization_id()
        )
      );
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_entities'
  ) then
    drop policy if exists "org_isolation_kyi_entities" on public.kyi_entities;
    create policy "org_isolation_kyi_entities" on public.kyi_entities
      for all
      using (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_entities.client_id
            and c.organization_id = public.get_user_organization_id()
        )
      )
      with check (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_entities.client_id
            and c.organization_id = public.get_user_organization_id()
        )
      );
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_location_claims'
  ) then
    drop policy if exists "org_isolation_kyi_location_claims" on public.kyi_location_claims;
    create policy "org_isolation_kyi_location_claims" on public.kyi_location_claims
      for all
      using (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_location_claims.client_id
            and c.organization_id = public.get_user_organization_id()
        )
      )
      with check (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_location_claims.client_id
            and c.organization_id = public.get_user_organization_id()
        )
      );
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_claim_geocode_jobs'
  ) then
    drop policy if exists "org_isolation_kyi_claim_geocode_jobs" on public.kyi_claim_geocode_jobs;
    create policy "org_isolation_kyi_claim_geocode_jobs" on public.kyi_claim_geocode_jobs
      for all
      using (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_claim_geocode_jobs.client_id
            and c.organization_id = public.get_user_organization_id()
        )
      )
      with check (
        exists (
          select 1 from public.kyi_companies c
          where c.id = kyi_claim_geocode_jobs.client_id
            and c.organization_id = public.get_user_organization_id()
        )
      );
  end if;

  -- Shared geocode cache + platform metadata: authenticated read only (not org-tenant data)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_geocode_cache'
  ) then
    drop policy if exists "kyi_geocode_cache_authenticated_select" on public.kyi_geocode_cache;
    create policy "kyi_geocode_cache_authenticated_select" on public.kyi_geocode_cache
      for select using (auth.uid() is not null);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_platform_metadata'
  ) then
    drop policy if exists "kyi_platform_metadata_authenticated_select" on public.kyi_platform_metadata;
    drop policy if exists "service_kyi_platform_metadata_write" on public.kyi_platform_metadata;
    create policy "kyi_platform_metadata_authenticated_select" on public.kyi_platform_metadata
      for select using (auth.uid() is not null);
    create policy "service_kyi_platform_metadata_write" on public.kyi_platform_metadata
      for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;

  -- Global type profile templates (read-only for authenticated)
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'kyi_investor_type_profiles'
  ) then
    drop policy if exists "kyi_type_profiles_authenticated_select" on public.kyi_investor_type_profiles;
    create policy "kyi_type_profiles_authenticated_select" on public.kyi_investor_type_profiles
      for select using (auth.uid() is not null);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Revoke anon execute on notify_kyi_* (if present)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'notify_kyi_module_stakeholders'
  ) then
    revoke execute on function public.notify_kyi_module_stakeholders(text, text, text, text, jsonb, text) from anon;
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'notify_kyi_leads_imported'
  ) then
    revoke execute on function public.notify_kyi_leads_imported(integer, integer, text) from anon;
  end if;
end $$;
