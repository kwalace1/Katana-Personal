-- Safe re-run after partial migration (skips objects that already exist).
-- Run in Supabase Dashboard → SQL Editor.

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
