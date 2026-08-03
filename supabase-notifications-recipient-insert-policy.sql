-- Run if comms notifications are not appearing in the bell (sender-only insert was blocked).
-- Allows each user to record an inbound notification for themselves.

drop policy if exists "Notifications: recipient can record inbound" on public.user_notifications;
create policy "Notifications: recipient can record inbound"
  on public.user_notifications for insert
  with check (
    recipient_user_id = auth.uid()
    and organization_id = public.get_user_organization_id()
  );
