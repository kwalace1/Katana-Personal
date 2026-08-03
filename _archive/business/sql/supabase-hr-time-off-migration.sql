-- Time off requests: Employee Portal submissions → HR approval
create table if not exists public.hr_time_off_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees(id) on delete cascade,
  type text not null check (type in ('Vacation', 'Sick', 'Personal', 'Bereavement', 'Jury Duty', 'Unpaid', 'Other')),
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Denied', 'Cancelled')),
  manager_notes text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_time_off_end_after_start check (end_date >= start_date)
);

create index if not exists hr_time_off_employee_idx on public.hr_time_off_requests(employee_id);
create index if not exists hr_time_off_status_idx on public.hr_time_off_requests(status);
create index if not exists hr_time_off_org_idx on public.hr_time_off_requests(organization_id);

alter table public.hr_time_off_requests enable row level security;

-- Org members (HR) can read all requests in their organization
drop policy if exists "hr_time_off_select_org" on public.hr_time_off_requests;
create policy "hr_time_off_select_org"
  on public.hr_time_off_requests for select
  using (organization_id = get_user_organization_id());

-- Employees can read their own requests (email-linked HR profile)
drop policy if exists "hr_time_off_select_subject" on public.hr_time_off_requests;
create policy "hr_time_off_select_subject"
  on public.hr_time_off_requests for select
  using (
    exists (
      select 1 from public.hr_employees e
      inner join auth.users u on lower(trim(both from u.email::text)) = lower(trim(both from e.email::text))
      where e.id = hr_time_off_requests.employee_id and u.id = auth.uid()
    )
  );

-- Employees submit for themselves only
drop policy if exists "hr_time_off_insert_subject" on public.hr_time_off_requests;
create policy "hr_time_off_insert_subject"
  on public.hr_time_off_requests for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.hr_employees e
      inner join auth.users u on lower(trim(both from u.email::text)) = lower(trim(both from e.email::text))
      where e.id = employee_id and u.id = auth.uid()
    )
  );

-- HR can approve/deny within org
drop policy if exists "hr_time_off_update_org" on public.hr_time_off_requests;
create policy "hr_time_off_update_org"
  on public.hr_time_off_requests for update
  using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());

comment on table public.hr_time_off_requests is 'Employee time off requests; submitted from portal, approved in HR';
