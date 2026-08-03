-- =============================================================================
-- HR notifications — notify stakeholders when a public job application is submitted
-- Run in Supabase Dashboard → SQL Editor (after supabase-notifications-migration.sql)
-- =============================================================================

create or replace function public.notify_hr_on_job_application_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_job_title text;
  v_recipient record;
  v_dedupe text;
begin
  select jp.organization_id, jp.title
  into v_org_id, v_job_title
  from public.job_postings jp
  where jp.id = new.job_id;

  v_org_id := coalesce(new.organization_id, v_org_id);
  if v_org_id is null then
    return new;
  end if;

  v_dedupe := 'hr:application:' || new.id::text;

  for v_recipient in
    select distinct up.id as user_id
    from public.user_profiles up
    left join public.hr_employees he
      on he.organization_id = up.organization_id
      and lower(trim(he.email)) = lower(trim(up.email))
    where up.organization_id = v_org_id
      and up.is_active = true
      and (
        up.role in ('owner', 'admin')
        or ('hr' = any(coalesce(he.module_access, array[]::text[])))
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
      v_org_id,
      v_recipient.user_id,
      null,
      'hr',
      'hr_application_received',
      'New job application',
      coalesce(new.anonymous_id, 'New candidate') || ' applied for ' || coalesce(v_job_title, 'open role'),
      '/hr',
      jsonb_build_object(
        'application_id', new.id,
        'job_id', new.job_id,
        'dedupe_key', v_dedupe
      )
    where not exists (
      select 1
      from public.user_notifications un
      where un.recipient_user_id = v_recipient.user_id
        and un.notification_type = 'hr_application_received'
        and un.metadata->>'dedupe_key' = v_dedupe
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_hr_on_job_application_insert on public.job_applications;
create trigger trg_notify_hr_on_job_application_insert
  after insert on public.job_applications
  for each row
  execute function public.notify_hr_on_job_application_insert();
