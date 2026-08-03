-- =============================================================================
-- Katana Customer Success Platform – Supabase schema
-- Run this in Supabase Dashboard → SQL Editor before running the data migration.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- csm_users (Customer Success Managers)
-- -----------------------------------------------------------------------------
create table if not exists public.csm_users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null,
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists csm_users_email_idx on public.csm_users(email);

-- -----------------------------------------------------------------------------
-- cs_clients
-- -----------------------------------------------------------------------------
create table if not exists public.cs_clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  industry text not null default '',
  health_score integer not null default 0 check (health_score >= 0 and health_score <= 100),
  status text not null default 'healthy' check (status in ('healthy', 'moderate', 'at-risk')),
  last_contact_date timestamptz,
  churn_risk integer not null default 0 check (churn_risk >= 0 and churn_risk <= 100),
  churn_trend text not null default 'stable' check (churn_trend in ('up', 'down', 'stable')),
  nps_score integer not null default 0 check (nps_score >= 0 and nps_score <= 10),
  arr numeric not null default 0,
  renewal_date date not null default (current_date + interval '1 year'),
  csm_id uuid references public.csm_users(id) on delete set null,
  engagement_score integer not null default 0 check (engagement_score >= 0 and engagement_score <= 100),
  portal_logins integer not null default 0,
  feature_usage text not null default 'Low',
  support_tickets integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cs_clients_csm_id_idx on public.cs_clients(csm_id);
create index if not exists cs_clients_status_idx on public.cs_clients(status);
create index if not exists cs_clients_health_score_idx on public.cs_clients(health_score);
create index if not exists cs_clients_renewal_date_idx on public.cs_clients(renewal_date);

-- -----------------------------------------------------------------------------
-- cs_tasks
-- -----------------------------------------------------------------------------
create table if not exists public.cs_tasks (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.cs_clients(id) on delete cascade,
  title text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'overdue')),
  due_date date not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assigned_to uuid references public.csm_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cs_tasks_client_id_idx on public.cs_tasks(client_id);
create index if not exists cs_tasks_due_date_idx on public.cs_tasks(due_date);
create index if not exists cs_tasks_status_idx on public.cs_tasks(status);

-- -----------------------------------------------------------------------------
-- cs_milestones
-- -----------------------------------------------------------------------------
create table if not exists public.cs_milestones (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.cs_clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'upcoming' check (status in ('completed', 'in-progress', 'upcoming')),
  target_date date not null,
  completed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cs_milestones_client_id_idx on public.cs_milestones(client_id);
create index if not exists cs_milestones_target_date_idx on public.cs_milestones(target_date);

-- -----------------------------------------------------------------------------
-- cs_interactions
-- -----------------------------------------------------------------------------
create table if not exists public.cs_interactions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.cs_clients(id) on delete cascade,
  type text not null check (type in ('email', 'call', 'meeting')),
  subject text not null default '',
  description text not null default '',
  csm_id uuid references public.csm_users(id) on delete set null,
  interaction_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists cs_interactions_client_id_idx on public.cs_interactions(client_id);
create index if not exists cs_interactions_interaction_date_idx on public.cs_interactions(interaction_date);

-- -----------------------------------------------------------------------------
-- cs_health_history
-- -----------------------------------------------------------------------------
create table if not exists public.cs_health_history (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.cs_clients(id) on delete cascade,
  health_score integer not null check (health_score >= 0 and health_score <= 100),
  recorded_at timestamptz not null default now()
);

create index if not exists cs_health_history_client_id_idx on public.cs_health_history(client_id);
create index if not exists cs_health_history_recorded_at_idx on public.cs_health_history(recorded_at);

-- -----------------------------------------------------------------------------
-- RLS (allow all for now – tighten in production)
-- -----------------------------------------------------------------------------
alter table public.csm_users enable row level security;
alter table public.cs_clients enable row level security;
alter table public.cs_tasks enable row level security;
alter table public.cs_milestones enable row level security;
alter table public.cs_interactions enable row level security;
alter table public.cs_health_history enable row level security;

create policy "Allow all on csm_users" on public.csm_users for all using (true) with check (true);
create policy "Allow all on cs_clients" on public.cs_clients for all using (true) with check (true);
create policy "Allow all on cs_tasks" on public.cs_tasks for all using (true) with check (true);
create policy "Allow all on cs_milestones" on public.cs_milestones for all using (true) with check (true);
create policy "Allow all on cs_interactions" on public.cs_interactions for all using (true) with check (true);
create policy "Allow all on cs_health_history" on public.cs_health_history for all using (true) with check (true);
