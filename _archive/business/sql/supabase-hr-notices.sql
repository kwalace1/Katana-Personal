-- =============================================================================
-- HR notices for Employee Portal (company-wide or org-scoped announcements)
-- =============================================================================

create table if not exists public.hr_notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  title text not null,
  body text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hr_notices_published_at_idx on public.hr_notices(published_at desc);

alter table public.hr_notices enable row level security;

drop policy if exists "hr_notices_select_authenticated" on public.hr_notices;
create policy "hr_notices_select_authenticated"
  on public.hr_notices for select
  using (auth.role() = 'authenticated');

drop policy if exists "hr_notices_write_authenticated" on public.hr_notices;
create policy "hr_notices_write_authenticated"
  on public.hr_notices for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "hr_notices_update_authenticated" on public.hr_notices;
create policy "hr_notices_update_authenticated"
  on public.hr_notices for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "hr_notices_delete_authenticated" on public.hr_notices;
create policy "hr_notices_delete_authenticated"
  on public.hr_notices for delete
  using (auth.role() = 'authenticated');

comment on table public.hr_notices is 'HR / company notices shown on Employee Portal dashboard';
