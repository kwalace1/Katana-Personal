-- Scheduled push nudges (orchestration, etc.) — server cron delivers when app is closed.
create table if not exists public.push_schedules (
  uid text not null,
  kind text not null default 'orchestration',
  title text not null,
  body text not null,
  href text not null default '/dashboard',
  tag text not null default 'katana-scheduled',
  fire_at timestamptz not null,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (uid, kind)
);

create index if not exists push_schedules_due_idx on public.push_schedules (fire_at)
  where sent_at is null;

alter table public.push_schedules enable row level security;

create policy push_schedules_select on public.push_schedules
  for select to authenticated using (uid = auth.uid()::text);

create policy push_schedules_insert on public.push_schedules
  for insert to authenticated with check (uid = auth.uid()::text);

create policy push_schedules_update on public.push_schedules
  for update to authenticated using (uid = auth.uid()::text);

create policy push_schedules_delete on public.push_schedules
  for delete to authenticated using (uid = auth.uid()::text);
