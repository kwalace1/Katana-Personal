-- =============================================================================
-- Katana Workforce (WFM) – Supabase schema
-- Run this in Supabase Dashboard → SQL Editor to create the WFM tables.
-- Fixes: "Could not find the table 'public.wfm_jobs' in the schema cache"
-- =============================================================================

create extension if not exists "uuid-ossp";

-- Sequence for job numbers (used by generate_job_number)
create sequence if not exists public.wfm_job_number_seq;

-- -----------------------------------------------------------------------------
-- wfm_technicians
-- -----------------------------------------------------------------------------
create table if not exists public.wfm_technicians (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  role text not null default 'technician' check (role in ('technician', 'lead', 'supervisor')),
  status text not null default 'active' check (status in ('active', 'inactive', 'on-leave')),
  skills text[], -- array of skill strings
  hourly_rate numeric,
  avatar_url text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wfm_technicians_status_idx on public.wfm_technicians(status);
create index if not exists wfm_technicians_is_active_idx on public.wfm_technicians(is_active);

-- -----------------------------------------------------------------------------
-- wfm_jobs
-- -----------------------------------------------------------------------------
create table if not exists public.wfm_jobs (
  id uuid primary key default uuid_generate_v4(),
  job_number text not null,
  title text not null,
  description text,
  customer_name text,
  customer_phone text,
  customer_email text,
  location text,
  location_address text,
  status text not null default 'assigned' check (status in ('assigned', 'in-progress', 'completed', 'on-hold', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  technician_id uuid references public.wfm_technicians(id) on delete set null,
  start_date date,
  end_date date,
  estimated_hours numeric,
  actual_hours numeric,
  notes text,
  completion_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wfm_jobs_job_number_idx on public.wfm_jobs(job_number);
create index if not exists wfm_jobs_status_idx on public.wfm_jobs(status);
create index if not exists wfm_jobs_technician_id_idx on public.wfm_jobs(technician_id);
create index if not exists wfm_jobs_start_date_idx on public.wfm_jobs(start_date);
create index if not exists wfm_jobs_is_active_idx on public.wfm_jobs(is_active);

-- -----------------------------------------------------------------------------
-- wfm_schedules
-- -----------------------------------------------------------------------------
create table if not exists public.wfm_schedules (
  id uuid primary key default uuid_generate_v4(),
  technician_id uuid not null references public.wfm_technicians(id) on delete cascade,
  job_id uuid references public.wfm_jobs(id) on delete set null,
  schedule_date date not null,
  start_time time,
  end_time time,
  status text not null default 'scheduled' check (status in ('scheduled', 'in-progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wfm_schedules_technician_id_idx on public.wfm_schedules(technician_id);
create index if not exists wfm_schedules_job_id_idx on public.wfm_schedules(job_id);
create index if not exists wfm_schedules_schedule_date_idx on public.wfm_schedules(schedule_date);

-- -----------------------------------------------------------------------------
-- wfm_timesheets
-- -----------------------------------------------------------------------------
create table if not exists public.wfm_timesheets (
  id uuid primary key default uuid_generate_v4(),
  technician_id uuid not null references public.wfm_technicians(id) on delete cascade,
  job_id uuid references public.wfm_jobs(id) on delete set null,
  clock_in timestamptz not null,
  clock_out timestamptz,
  break_duration integer not null default 0,
  total_hours numeric,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wfm_timesheets_technician_id_idx on public.wfm_timesheets(technician_id);
create index if not exists wfm_timesheets_job_id_idx on public.wfm_timesheets(job_id);
create index if not exists wfm_timesheets_clock_in_idx on public.wfm_timesheets(clock_in);

-- -----------------------------------------------------------------------------
-- wfm_job_notes
-- -----------------------------------------------------------------------------
create table if not exists public.wfm_job_notes (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.wfm_jobs(id) on delete cascade,
  technician_id uuid references public.wfm_technicians(id) on delete set null,
  note text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists wfm_job_notes_job_id_idx on public.wfm_job_notes(job_id);

-- -----------------------------------------------------------------------------
-- RPC: generate_job_number
-- -----------------------------------------------------------------------------
create or replace function public.generate_job_number()
returns text
language plpgsql
security definer
as $$
declare
  next_num bigint;
  result text;
begin
  next_num := nextval('public.wfm_job_number_seq');
  result := 'JOB-' || to_char(now(), 'YYYY') || '-' || lpad(next_num::text, 4, '0');
  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS (allow all for now – tighten in production)
-- -----------------------------------------------------------------------------
alter table public.wfm_technicians enable row level security;
alter table public.wfm_jobs enable row level security;
alter table public.wfm_schedules enable row level security;
alter table public.wfm_timesheets enable row level security;
alter table public.wfm_job_notes enable row level security;

create policy "Allow all on wfm_technicians" on public.wfm_technicians for all using (true) with check (true);
create policy "Allow all on wfm_jobs" on public.wfm_jobs for all using (true) with check (true);
create policy "Allow all on wfm_schedules" on public.wfm_schedules for all using (true) with check (true);
create policy "Allow all on wfm_timesheets" on public.wfm_timesheets for all using (true) with check (true);
create policy "Allow all on wfm_job_notes" on public.wfm_job_notes for all using (true) with check (true);
