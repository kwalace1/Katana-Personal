-- =============================================================================
-- Katana Comms Features Migration
-- Reactions, thread replies (parent_message_id already exists)
-- Run in Supabase Dashboard → SQL Editor (rerun-safe)
-- =============================================================================

-- Message reactions (emoji per user per message)
create table if not exists public.comms_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.comms_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists idx_comms_reactions_message on public.comms_message_reactions(message_id);
create index if not exists idx_comms_reactions_user on public.comms_message_reactions(user_id);

alter table public.comms_message_reactions enable row level security;

-- Visible when parent message is visible
drop policy if exists "Reactions: visible with message" on public.comms_message_reactions;
create policy "Reactions: visible with message"
  on public.comms_message_reactions for select
  using (
    exists (
      select 1 from public.comms_messages m
      where m.id = message_id
    )
  );

drop policy if exists "Reactions: members can add" on public.comms_message_reactions;
create policy "Reactions: members can add"
  on public.comms_message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.comms_messages m
      where m.id = message_id
    )
  );

drop policy if exists "Reactions: own reaction can remove" on public.comms_message_reactions;
create policy "Reactions: own reaction can remove"
  on public.comms_message_reactions for delete
  using (user_id = auth.uid());

-- Realtime for reactions
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comms_message_reactions'
  ) then
    alter publication supabase_realtime add table public.comms_message_reactions;
  end if;
exception
  when duplicate_object then null;
end $$;
