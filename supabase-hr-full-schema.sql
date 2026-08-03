-- =============================================================================
-- Katana HR — full module schema
-- Creates the HR sub-tables that hr-api.ts has always assumed exist
-- (hr_goals, hr_performance_reviews, hr_learning_paths, hr_recognitions,
--  hr_360_feedback, hr_goal_comments, hr_career_paths, hr_mentorships,
--  hr_activities, job_postings, job_applications). hr_employees and hr_notices
--  are assumed already created by their own files.
--
-- RLS uses the existing get_user_organization_id() function for org isolation,
-- matching the swap_rls_user_to_org_isolation pattern already in use.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- hr_performance_reviews
-- -----------------------------------------------------------------------------
create table if not exists public.hr_performance_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  review_period text not null,
  review_format text not null default 'standard' check (review_format in ('standard', 'self_assessment')),
  review_type text not null check (review_type in ('quarterly', 'annual', 'probation', 'promotion')),
  review_date date not null,
  collaboration numeric not null default 0,
  accountability numeric not null default 0,
  trustworthy numeric not null default 0,
  leadership numeric not null default 0,
  strengths text,
  improvements text,
  goals text,
  reviewer_id uuid references public.hr_employees(id) on delete set null,
  trend text not null default 'stable' check (trend in ('up', 'down', 'stable')),
  status text not null default 'on-time' check (status in ('on-time', 'overdue', 'upcoming')),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_perf_reviews_employee_idx on public.hr_performance_reviews(employee_id);
create index if not exists hr_perf_reviews_org_idx on public.hr_performance_reviews(organization_id);

alter table public.hr_performance_reviews enable row level security;
drop policy if exists "org_isolation_hr_perf_reviews" on public.hr_performance_reviews;
create policy "org_isolation_hr_perf_reviews" on public.hr_performance_reviews
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- -----------------------------------------------------------------------------
-- hr_goals
-- -----------------------------------------------------------------------------
create table if not exists public.hr_goals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  goal text not null,
  category text not null,
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'On Track' check (status in ('On Track', 'Behind', 'Complete', 'Cancelled')),
  due_date date not null,
  created_date date not null default current_date,
  description text,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_goals_employee_idx on public.hr_goals(employee_id);
create index if not exists hr_goals_org_idx on public.hr_goals(organization_id);

alter table public.hr_goals enable row level security;
drop policy if exists "org_isolation_hr_goals" on public.hr_goals;
create policy "org_isolation_hr_goals" on public.hr_goals
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- -----------------------------------------------------------------------------
-- hr_goal_comments
-- -----------------------------------------------------------------------------
create table if not exists public.hr_goal_comments (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.hr_goals(id) on delete cascade,
  author_id uuid references public.hr_employees(id) on delete set null,
  author_name text not null,
  comment text not null,
  comment_type text not null default 'general' check (comment_type in ('general', 'feedback', 'milestone', 'concern')),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists hr_goal_comments_goal_idx on public.hr_goal_comments(goal_id);

alter table public.hr_goal_comments enable row level security;
drop policy if exists "org_isolation_hr_goal_comments" on public.hr_goal_comments;
create policy "org_isolation_hr_goal_comments" on public.hr_goal_comments
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- -----------------------------------------------------------------------------
-- hr_360_feedback
-- -----------------------------------------------------------------------------
create table if not exists public.hr_360_feedback (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  self_rating numeric,
  manager_rating numeric,
  peer_rating numeric,
  direct_report_rating numeric,
  overall_score numeric,
  feedback_count integer not null default 0,
  status text not null default 'in-progress' check (status in ('in-progress', 'complete')),
  period text not null,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_360_employee_idx on public.hr_360_feedback(employee_id);

alter table public.hr_360_feedback enable row level security;
drop policy if exists "org_isolation_hr_360_feedback" on public.hr_360_feedback;
create policy "org_isolation_hr_360_feedback" on public.hr_360_feedback
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- -----------------------------------------------------------------------------
-- hr_mentorships
-- -----------------------------------------------------------------------------
create table if not exists public.hr_mentorships (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.hr_employees(id) on delete cascade,
  mentee_id uuid not null references public.hr_employees(id) on delete cascade,
  focus text not null,
  match_score numeric not null default 0,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hr_mentorships enable row level security;
drop policy if exists "org_isolation_hr_mentorships" on public.hr_mentorships;
create policy "org_isolation_hr_mentorships" on public.hr_mentorships
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- -----------------------------------------------------------------------------
-- hr_recognitions
-- -----------------------------------------------------------------------------
create table if not exists public.hr_recognitions (
  id uuid primary key default gen_random_uuid(),
  from_id uuid references public.hr_employees(id) on delete set null,
  from_name text not null,
  to_id uuid not null references public.hr_employees(id) on delete cascade,
  to_name text not null,
  type text not null check (type in ('Peer Recognition', 'Manager Recognition')),
  category text not null,
  message text not null,
  recognition_date date not null default current_date,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists hr_recognitions_to_idx on public.hr_recognitions(to_id);

alter table public.hr_recognitions enable row level security;
drop policy if exists "org_isolation_hr_recognitions" on public.hr_recognitions;
create policy "org_isolation_hr_recognitions" on public.hr_recognitions
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- -----------------------------------------------------------------------------
-- hr_learning_paths
-- -----------------------------------------------------------------------------
create table if not exists public.hr_learning_paths (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  course text not null,
  progress integer not null default 0 check (progress between 0 and 100),
  due_date date not null,
  status text not null default 'not-started' check (status in ('in-progress', 'completed', 'not-started')),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_learning_employee_idx on public.hr_learning_paths(employee_id);

alter table public.hr_learning_paths enable row level security;
drop policy if exists "org_isolation_hr_learning" on public.hr_learning_paths;
create policy "org_isolation_hr_learning" on public.hr_learning_paths
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- -----------------------------------------------------------------------------
-- hr_career_paths
-- -----------------------------------------------------------------------------
create table if not exists public.hr_career_paths (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  current_role_name text not null,
  next_role text not null,
  time_to_promotion text not null,
  readiness numeric not null default 0,
  required_skills text[] not null default '{}',
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_career_employee_idx on public.hr_career_paths(employee_id);

alter table public.hr_career_paths enable row level security;
drop policy if exists "org_isolation_hr_career" on public.hr_career_paths;
create policy "org_isolation_hr_career" on public.hr_career_paths
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- -----------------------------------------------------------------------------
-- hr_activities (event log shown on HR dashboard / Recent Activity)
-- -----------------------------------------------------------------------------
create table if not exists public.hr_activities (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'employee_added', 'review_completed', 'goal_added', 'goal_completed',
    'recognition_given', 'interview_scheduled', 'employee_updated'
  )),
  description text not null,
  employee_id uuid references public.hr_employees(id) on delete set null,
  employee_name text,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists hr_activities_org_created_idx on public.hr_activities(organization_id, created_at desc);

alter table public.hr_activities enable row level security;
drop policy if exists "org_isolation_hr_activities" on public.hr_activities;
create policy "org_isolation_hr_activities" on public.hr_activities
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- -----------------------------------------------------------------------------
-- job_postings (recruitment)
-- -----------------------------------------------------------------------------
create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text not null,
  location text not null,
  type text not null check (type in ('full-time', 'part-time', 'contract', 'internship')),
  level text not null check (level in ('entry', 'mid', 'senior', 'lead')),
  salary text not null default '',
  posted_date date not null default current_date,
  description text not null default '',
  responsibilities text[] not null default '{}',
  qualifications text[] not null default '{}',
  benefits text[] not null default '{}',
  is_active boolean not null default true,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_postings_active_idx on public.job_postings(is_active, posted_date desc);

alter table public.job_postings enable row level security;
drop policy if exists "org_isolation_job_postings" on public.job_postings;
create policy "org_isolation_job_postings" on public.job_postings
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- Public Careers page needs anonymous read of active postings
drop policy if exists "anon_read_active_job_postings" on public.job_postings;
create policy "anon_read_active_job_postings" on public.job_postings
  for select using (is_active = true);

-- -----------------------------------------------------------------------------
-- job_applications (recruitment pipeline)
-- -----------------------------------------------------------------------------
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  anonymous_id text,
  job_id uuid references public.job_postings(id) on delete set null,
  status text not null default 'new' check (status in (
    'new', 'reviewing', 'interview-scheduled', 'interviewed',
    'offer', 'rejected', 'withdrawn'
  )),
  applied_date timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null default '',
  location text not null default '',
  resume_file_name text,
  resume_url text,
  cover_letter text not null default '',
  linkedin text,
  portfolio text,
  is_revealed boolean not null default false,
  revealed_at timestamptz,
  revealed_by uuid references auth.users(id) on delete set null,
  notes text,
  rating numeric,
  interview_date timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_applications_job_idx on public.job_applications(job_id);
create index if not exists job_applications_org_status_idx on public.job_applications(organization_id, status);

alter table public.job_applications enable row level security;
drop policy if exists "org_isolation_job_applications" on public.job_applications;
create policy "org_isolation_job_applications" on public.job_applications
  for all using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

-- Anonymous candidate submissions: anyone can INSERT (public Careers form)
drop policy if exists "anon_insert_job_applications" on public.job_applications;
create policy "anon_insert_job_applications" on public.job_applications
  for insert with check (true);

-- -----------------------------------------------------------------------------
-- updated_at triggers (lightweight; one shared function)
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'hr_performance_reviews','hr_goals','hr_360_feedback','hr_mentorships',
    'hr_learning_paths','hr_career_paths','job_postings','job_applications'
  ]) loop
    execute format('drop trigger if exists trg_touch_%I on public.%I;', t, t);
    execute format('create trigger trg_touch_%I before update on public.%I
                    for each row execute function public.touch_updated_at();', t, t);
  end loop;
end$$;
