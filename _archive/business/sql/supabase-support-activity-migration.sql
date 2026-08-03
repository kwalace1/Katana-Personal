-- =============================================================================
-- Support submission activity log — who changed status / notes / priority
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- Required helper (also used by Pilot Queue). Safe to re-run.
create or replace function public.is_katana_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and up.role in ('owner', 'admin')
      and lower(split_part(up.email, '@', 2)) in (
        'dwgrowthcapital.onmicrosoft.com',
        'dwgrowth.onmicrosoft.com'
      )
  );
$$;

create table if not exists public.support_submission_activity (
  id uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references public.support_submissions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_name text not null,
  actor_email text not null,
  action_type text not null check (
    action_type in ('status_changed', 'priority_changed', 'notes_updated')
  ),
  from_status text,
  to_status text,
  from_priority text,
  to_priority text,
  admin_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_activity_submission
  on public.support_submission_activity(submission_id, created_at desc);

alter table public.support_submission_activity enable row level security;

drop policy if exists "Support activity: platform operators can view" on public.support_submission_activity;
create policy "Support activity: platform operators can view"
  on public.support_submission_activity for select
  using (public.is_katana_platform_operator());

drop policy if exists "Support activity: org admins can view" on public.support_submission_activity;
create policy "Support activity: org admins can view"
  on public.support_submission_activity for select
  using (
    organization_id = (
      select organization_id from public.user_profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

drop policy if exists "Support activity: platform operators can insert" on public.support_submission_activity;
create policy "Support activity: platform operators can insert"
  on public.support_submission_activity for insert
  with check (public.is_katana_platform_operator());

drop policy if exists "Support activity: org admins can insert" on public.support_submission_activity;
create policy "Support activity: org admins can insert"
  on public.support_submission_activity for insert
  with check (
    organization_id = (
      select organization_id from public.user_profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid()
      and role in ('owner', 'admin')
    )
  );

-- Optional denormalized columns (not required by the app)
alter table public.support_submissions
  add column if not exists last_updated_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists last_updated_by_name text,
  add column if not exists last_updated_by_email text;
