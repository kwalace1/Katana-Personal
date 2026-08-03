-- =============================================================================
-- Katana Notifications — cross-module in-app notifications
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

create extension if not exists "uuid-ossp";

create table if not exists public.user_notifications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  source_module text not null check (
    source_module in (
      'comms',
      'projects',
      'inventory',
      'customer_success',
      'hr',
      'workforce',
      'hub',
      'general',
      'support'
    )
  ),
  notification_type text not null,
  title text not null,
  body text,
  link_path text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_recipient_created
  on public.user_notifications(recipient_user_id, created_at desc);

create index if not exists idx_user_notifications_recipient_unread
  on public.user_notifications(recipient_user_id)
  where read_at is null;

create unique index if not exists idx_user_notifications_dedupe
  on public.user_notifications(recipient_user_id, notification_type, (metadata->>'dedupe_key'))
  where (metadata->>'dedupe_key') is not null;

alter table public.user_notifications enable row level security;

drop policy if exists "Notifications: recipients can view own" on public.user_notifications;
create policy "Notifications: recipients can view own"
  on public.user_notifications for select
  using (recipient_user_id = auth.uid());

drop policy if exists "Notifications: recipients can mark read" on public.user_notifications;
create policy "Notifications: recipients can mark read"
  on public.user_notifications for update
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

drop policy if exists "Notifications: org members can create for others" on public.user_notifications;
create policy "Notifications: org members can create for others"
  on public.user_notifications for insert
  with check (
    auth.uid() is not null
    and organization_id = public.get_user_organization_id()
    and (
      actor_user_id is null
      or actor_user_id = auth.uid()
    )
  );

drop policy if exists "Notifications: recipient can record inbound" on public.user_notifications;
create policy "Notifications: recipient can record inbound"
  on public.user_notifications for insert
  with check (
    recipient_user_id = auth.uid()
    and organization_id = public.get_user_organization_id()
  );

-- Realtime: live notification bell + toasts (safe to re-run)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end $$;
