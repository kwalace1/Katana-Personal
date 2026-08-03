-- =============================================================================
-- KYI: fix org-as-company ownership (run in Supabase SQL Editor)
-- Prerequisite: supabase-pilot-org-rls-kyi-migration.sql
--
-- Goals:
-- 1. Detach leaked demo companies (Katana Business Solutions, Swing) from
--    DW Growth & Capital (and clear null-org demos when a platform org exists).
-- 2. Ensure every organization has a default kyi_companies row named after it.
-- =============================================================================

do $$
declare
  platform_org uuid;
  r record;
  existing_id integer;
begin
  select id into platform_org
  from public.organizations
  where name ilike '%katana business%'
     or name ilike '%katana tech%'
     or slug ilike '%katana%'
  order by created_at asc
  limit 1;

  -- Detach Katana demo from DW; assign to platform org when known.
  update public.kyi_companies c
  set organization_id = platform_org
  where lower(trim(c.name)) = 'katana business solutions'
    and (
      c.organization_id is null
      or exists (
        select 1
        from public.organizations o
        where o.id = c.organization_id
          and lower(o.name) like '%dw growth%'
          and lower(o.name) like '%capital%'
      )
    );

  -- Detach Swing from DW (do not invent an owner — leave null so RLS hides it).
  update public.kyi_companies c
  set organization_id = null
  where lower(trim(c.name)) = 'swing'
    and exists (
      select 1
      from public.organizations o
      where o.id = c.organization_id
        and lower(o.name) like '%dw growth%'
        and lower(o.name) like '%capital%'
    );

  -- Ensure each org has a company named after the organization.
  for r in
    select o.id, o.name
    from public.organizations o
    where o.name is not null
      and length(trim(o.name)) > 0
    order by
      case
        when lower(o.name) like '%dw growth%' and lower(o.name) like '%capital%' then 0
        else 1
      end,
      o.created_at
  loop
    select c.id into existing_id
    from public.kyi_companies c
    where c.organization_id = r.id
      and lower(trim(c.name)) = lower(trim(r.name))
    limit 1;

    if existing_id is null then
      insert into public.kyi_companies (name, organization_id, description, created_at)
      values (
        trim(r.name),
        r.id,
        trim(r.name) || ' — Know Your Investor workspace',
        now()
      );
    end if;
  end loop;
end $$;

-- Sanity check (optional):
-- select c.id, c.name, o.name as org_name
-- from public.kyi_companies c
-- join public.organizations o on o.id = c.organization_id
-- where lower(o.name) like '%dw growth%' and lower(o.name) like '%capital%';
