-- Talent pool: interviewed candidates not hired for one role, kept for future openings.
-- Run after supabase-hr-full-schema.sql and supabase-hr-recruitment-matching-migration.sql.

create table if not exists public.recruitment_talent_pool (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source_application_id uuid references public.job_applications(id) on delete set null,
  anonymous_id text,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null default '',
  location text not null default '',
  linkedin text,
  portfolio text,
  resume_profile jsonb,
  resume_url text,
  resume_file_name text,
  source_job_id uuid references public.job_postings(id) on delete set null,
  source_job_title text,
  source_department text,
  interviewed_at timestamptz,
  interview_notes text,
  rating numeric,
  pool_status text not null default 'active' check (pool_status in ('active', 'archived', 'contacted', 'hired')),
  recruiter_notes text,
  tags jsonb not null default '[]'::jsonb,
  availability_notes text,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id) on delete set null,
  added_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recruitment_talent_pool_application_uidx
  on public.recruitment_talent_pool (source_application_id)
  where source_application_id is not null;

create index if not exists recruitment_talent_pool_org_status_idx
  on public.recruitment_talent_pool (organization_id, pool_status);

alter table public.recruitment_talent_pool enable row level security;

drop policy if exists "org_isolation_recruitment_talent_pool" on public.recruitment_talent_pool;
create policy "org_isolation_recruitment_talent_pool" on public.recruitment_talent_pool
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

drop trigger if exists trg_touch_recruitment_talent_pool on public.recruitment_talent_pool;
create trigger trg_touch_recruitment_talent_pool before update on public.recruitment_talent_pool
  for each row execute function public.touch_updated_at();

comment on table public.recruitment_talent_pool is
  'Interviewed candidates saved for future roles when not hired for the original posting.';
