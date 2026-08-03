-- =============================================================================
-- Katana Support — issue reporting & feedback collection
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

create extension if not exists "uuid-ossp";

-- =============================================================================
-- SUPPORT SUBMISSIONS (unified table for issues + feedback)
-- =============================================================================

create table if not exists public.support_submissions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submitter_user_id uuid not null references auth.users(id) on delete cascade,
  submitter_name text not null,
  submitter_email text not null,
  organization_name text,
  submission_type text not null check (submission_type in ('issue', 'feedback')),
  category text not null check (category in ('bug', 'feature', 'question', 'general', 'ux', 'performance')),
  subject text not null,
  description text not null,
  module_context text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  admin_notes text,
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  assigned_to_name text,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_submissions_org on public.support_submissions(organization_id);
create index if not exists idx_support_submissions_submitter on public.support_submissions(submitter_user_id);
create index if not exists idx_support_submissions_status on public.support_submissions(status);
create index if not exists idx_support_submissions_type on public.support_submissions(submission_type);
create index if not exists idx_support_submissions_created on public.support_submissions(created_at desc);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.support_submissions enable row level security;

drop policy if exists "Support: submitters can view own" on public.support_submissions;
create policy "Support: submitters can view own"
  on public.support_submissions for select
  using (submitter_user_id = auth.uid());

drop policy if exists "Support: org admins can view all" on public.support_submissions;
create policy "Support: org admins can view all"
  on public.support_submissions for select
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

drop policy if exists "Support: authenticated users can insert own" on public.support_submissions;
create policy "Support: authenticated users can insert own"
  on public.support_submissions for insert
  with check (
    submitter_user_id = auth.uid()
    and user_id = auth.uid()
    and organization_id = (
      select organization_id from public.user_profiles where id = auth.uid()
    )
  );

drop policy if exists "Support: org admins can update" on public.support_submissions;
create policy "Support: org admins can update"
  on public.support_submissions for update
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

drop policy if exists "Support: submitters can delete own" on public.support_submissions;
create policy "Support: submitters can delete own"
  on public.support_submissions for delete
  using (submitter_user_id = auth.uid());

drop policy if exists "Support: org admins can delete" on public.support_submissions;
create policy "Support: org admins can delete"
  on public.support_submissions for delete
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

-- Platform operators (Katana team) — cross-tenant access; see supabase-support-platform-operator-migration.sql
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

drop policy if exists "Support: platform operators can view all" on public.support_submissions;
create policy "Support: platform operators can view all"
  on public.support_submissions for select
  using (public.is_katana_platform_operator());

drop policy if exists "Support: platform operators can update all" on public.support_submissions;
create policy "Support: platform operators can update all"
  on public.support_submissions for update
  using (public.is_katana_platform_operator());

drop policy if exists "Support: platform operators can delete all" on public.support_submissions;
create policy "Support: platform operators can delete all"
  on public.support_submissions for delete
  using (public.is_katana_platform_operator());

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

create or replace function public.support_submissions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_submissions_updated_at on public.support_submissions;
create trigger support_submissions_updated_at
  before update on public.support_submissions
  for each row execute function public.support_submissions_set_updated_at();
