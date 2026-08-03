-- =============================================================================
-- Katana HR – Supabase schema
-- Run this in Supabase Dashboard → SQL Editor to create the HR tables.
-- Fixes: "cannot find the table public.hr_employees in the schema cache"
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- hr_employees
-- -----------------------------------------------------------------------------
create table if not exists public.hr_employees (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  position text not null,
  department text not null,
  status text not null default 'Active' check (status in ('Active', 'Onboarding', 'Inactive', 'On Leave')),
  email text not null,
  phone text,
  manager_id uuid references public.hr_employees(id) on delete set null,
  photo_url text,
  hire_date date not null,
  next_review_date date,
  last_review_date date,
  performance_score numeric,
  module_access text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hr_employees_department_idx on public.hr_employees(department);
create index if not exists hr_employees_status_idx on public.hr_employees(status);
create index if not exists hr_employees_manager_id_idx on public.hr_employees(manager_id);

-- Allow anonymous read/write for now; tighten with RLS for production
alter table public.hr_employees enable row level security;

create policy "Allow all for hr_employees"
  on public.hr_employees
  for all
  using (true)
  with check (true);
