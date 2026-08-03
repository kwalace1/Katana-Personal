-- =============================================================================
-- KYI notifications — source module + batch lead-pool alerts for all KYI stakeholders
-- Run in Supabase Dashboard → SQL Editor (after supabase-notifications-migration.sql)
-- =============================================================================

alter table public.user_notifications
  drop constraint if exists user_notifications_source_module_check;

alter table public.user_notifications
  add constraint user_notifications_source_module_check
  check (
    source_module in (
      'comms',
      'projects',
      'inventory',
      'customer_success',
      'hr',
      'workforce',
      'hub',
      'general',
      'support',
      'kyi'
    )
  );

create or replace function public.notify_kyi_module_stakeholders(
  p_notification_type text,
  p_title text,
  p_body text,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_link_path text default '/kyi'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient record;
  v_inserted integer := 0;
  v_meta jsonb;
begin
  v_meta := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('dedupe_key', p_dedupe_key);

  for v_recipient in
    select distinct up.id as user_id, up.organization_id as org_id
    from public.user_profiles up
    left join public.hr_employees he
      on he.organization_id = up.organization_id
      and lower(trim(he.email)) = lower(trim(up.email))
    where up.is_active = true
      and (
        up.role in ('owner', 'admin')
        or ('kyi' = any(coalesce(he.module_access, array[]::text[])))
      )
  loop
    insert into public.user_notifications (
      organization_id,
      recipient_user_id,
      actor_user_id,
      source_module,
      notification_type,
      title,
      body,
      link_path,
      metadata
    )
    select
      v_recipient.org_id,
      v_recipient.user_id,
      null,
      'kyi',
      p_notification_type,
      p_title,
      p_body,
      p_link_path,
      v_meta
    where not exists (
      select 1
      from public.user_notifications un
      where un.recipient_user_id = v_recipient.user_id
        and un.notification_type = p_notification_type
        and un.metadata->>'dedupe_key' = p_dedupe_key
    );

    if found then
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return v_inserted;
end;
$$;

create or replace function public.notify_kyi_leads_imported(
  p_lead_count integer,
  p_needs_geocode_count integer default null,
  p_import_batch_key text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := greatest(coalesce(p_lead_count, 0), 0);
  v_dedupe text;
  v_body text;
begin
  if v_count <= 0 then
    return 0;
  end if;

  v_dedupe := coalesce(
    nullif(trim(p_import_batch_key), ''),
    'kyi:leads:import:' || to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI')
  );

  v_body := v_count::text || ' new lead' || case when v_count = 1 then '' else 's' end
    || ' added to the pool. Review and geocode unmapped leads in Know Your Investor.';

  if p_needs_geocode_count is not null and p_needs_geocode_count > 0 then
    v_body := v_body || ' ' || p_needs_geocode_count::text || ' need geocoding.';
  end if;

  return public.notify_kyi_module_stakeholders(
    'kyi_leads_added',
    'New leads in the pool',
    v_body,
    v_dedupe,
    jsonb_build_object(
      'lead_count', v_count,
      'needs_geocode_count', p_needs_geocode_count
    ),
    '/kyi'
  );
end;
$$;

grant execute on function public.notify_kyi_module_stakeholders(text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.notify_kyi_module_stakeholders(text, text, text, text, jsonb, text) to service_role;
grant execute on function public.notify_kyi_leads_imported(integer, integer, text) to authenticated;
grant execute on function public.notify_kyi_leads_imported(integer, integer, text) to service_role;
