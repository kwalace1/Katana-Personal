-- =============================================================================
-- Katana Projects – Supabase schema
-- Run this in Supabase Dashboard → SQL Editor to create the project tables.
-- =============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status text not null check (status in ('active', 'completed', 'on-hold')),
  progress integer not null default 0,
  deadline date not null,
  total_tasks integer not null default 0,
  completed_tasks integer not null default 0,
  starred boolean not null default false,
  created_by_name text default '',
  created_by_avatar text default '',
  owner_name text default '',
  owner_avatar text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  status text not null check (status in ('backlog', 'todo', 'in-progress', 'review', 'blocked', 'done')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  assignee_name text not null default '',
  assignee_avatar text not null default '',
  start_date date,
  deadline date not null,
  progress integer not null default 0,
  description text,
  milestone_id uuid,
  order_index integer not null default 0,
  subtasks jsonb not null default '[]',
  assignees jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_project_id_idx on public.tasks(project_id);
comment on column public.tasks.subtasks is 'Array of { id, title, completed }; when non-empty, task progress = (completed count / total) * 100';
comment on column public.tasks.assignees is 'Array of { employeeId, name, avatar }; primary assignee_* columns mirror the first entry for legacy queries.';

-- -----------------------------------------------------------------------------
-- milestones
-- -----------------------------------------------------------------------------
create table if not exists public.milestones (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  date date not null,
  status text not null check (status in ('completed', 'in-progress', 'upcoming')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists milestones_project_id_idx on public.milestones(project_id);

-- -----------------------------------------------------------------------------
-- milestone_tasks (join table)
-- -----------------------------------------------------------------------------
create table if not exists public.milestone_tasks (
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (milestone_id, task_id)
);

-- -----------------------------------------------------------------------------
-- team_members
-- -----------------------------------------------------------------------------
create table if not exists public.team_members (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  role text not null default '',
  avatar text not null default '',
  capacity integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_members_project_id_idx on public.team_members(project_id);

-- -----------------------------------------------------------------------------
-- project_files
-- -----------------------------------------------------------------------------
create table if not exists public.project_files (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null default '',
  uploaded_by text not null default '',
  uploaded_at timestamptz not null default now(),
  size text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_files_project_id_idx on public.project_files(project_id);

-- -----------------------------------------------------------------------------
-- activities
-- -----------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null default '',
  description text not null default '',
  "user" text not null default '',
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_project_id_idx on public.activities(project_id);

-- -----------------------------------------------------------------------------
-- sprints
-- -----------------------------------------------------------------------------
create table if not exists public.sprints (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  goal text not null default '',
  start_date date not null,
  end_date date not null,
  status text not null check (status in ('planned', 'active', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sprints_project_id_idx on public.sprints(project_id);

-- -----------------------------------------------------------------------------
-- sprint_tasks (join table)
-- -----------------------------------------------------------------------------
create table if not exists public.sprint_tasks (
  sprint_id uuid not null references public.sprints(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sprint_id, task_id)
);

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- Allow read/write for authenticated and anon so the app can create projects.
-- Tighten these policies later (e.g. by user/org).
-- -----------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.milestones enable row level security;
alter table public.milestone_tasks enable row level security;
alter table public.team_members enable row level security;
alter table public.project_files enable row level security;
alter table public.activities enable row level security;
alter table public.sprints enable row level security;
alter table public.sprint_tasks enable row level security;

-- Policies: allow all for authenticated and anon (so create project works with anon key)
create policy "Allow all on projects" on public.projects for all using (true) with check (true);
create policy "Allow all on tasks" on public.tasks for all using (true) with check (true);
create policy "Allow all on milestones" on public.milestones for all using (true) with check (true);
create policy "Allow all on milestone_tasks" on public.milestone_tasks for all using (true) with check (true);
create policy "Allow all on team_members" on public.team_members for all using (true) with check (true);
create policy "Allow all on project_files" on public.project_files for all using (true) with check (true);
create policy "Allow all on activities" on public.activities for all using (true) with check (true);
create policy "Allow all on sprints" on public.sprints for all using (true) with check (true);
create policy "Allow all on sprint_tasks" on public.sprint_tasks for all using (true) with check (true);
