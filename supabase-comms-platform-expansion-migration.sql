-- =============================================================================
-- Katana Comms Platform Expansion Migration
-- Milestones: unread cursors, mentions, announcements, FTS, attachments, context
-- Run in Supabase Dashboard → SQL Editor (rerun-safe)
-- =============================================================================

-- ---------- M1: READ CURSORS ----------

create table if not exists public.comms_read_cursors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid references public.comms_channels(id) on delete cascade,
  conversation_id uuid references public.comms_conversations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (channel_id is not null and conversation_id is null)
    or (channel_id is null and conversation_id is not null)
  )
);

create unique index if not exists idx_comms_read_cursors_user_channel
  on public.comms_read_cursors(user_id, channel_id)
  where channel_id is not null;

create unique index if not exists idx_comms_read_cursors_user_conversation
  on public.comms_read_cursors(user_id, conversation_id)
  where conversation_id is not null;

create index if not exists idx_comms_read_cursors_user
  on public.comms_read_cursors(user_id);

alter table public.comms_read_cursors enable row level security;

drop policy if exists "Read cursors: own rows" on public.comms_read_cursors;
create policy "Read cursors: own rows"
  on public.comms_read_cursors for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- M2: MENTIONS + MENTIONS-ONLY PREF ----------

create table if not exists public.comms_message_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.comms_messages(id) on delete cascade,
  mentioned_user_id uuid references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mention_kind text not null default 'user' check (mention_kind in ('user', 'channel')),
  created_at timestamptz not null default now()
);

create index if not exists idx_comms_mentions_message on public.comms_message_mentions(message_id);
create index if not exists idx_comms_mentions_user on public.comms_message_mentions(mentioned_user_id);
create index if not exists idx_comms_mentions_org on public.comms_message_mentions(organization_id);

alter table public.comms_message_mentions enable row level security;

drop policy if exists "Mentions: org members can view" on public.comms_message_mentions;
create policy "Mentions: org members can view"
  on public.comms_message_mentions for select
  using (
    organization_id = public.get_user_organization_id()
    and exists (
      select 1 from public.comms_messages m
      where m.id = message_id
    )
  );

drop policy if exists "Mentions: authenticated can insert" on public.comms_message_mentions;
create policy "Mentions: authenticated can insert"
  on public.comms_message_mentions for insert
  with check (
    auth.uid() is not null
    and organization_id = public.get_user_organization_id()
  );

drop policy if exists "Mentions: own org delete" on public.comms_message_mentions;
create policy "Mentions: own org delete"
  on public.comms_message_mentions for delete
  using (organization_id = public.get_user_organization_id());

alter table public.comms_channel_prefs
  add column if not exists notify_on_mentions_only boolean not null default false;

alter table public.comms_conversation_prefs
  add column if not exists notify_on_mentions_only boolean not null default false;

-- ---------- M3: ANNOUNCEMENTS ----------

alter table public.comms_channels
  drop constraint if exists comms_channels_channel_type_check;

alter table public.comms_channels
  add constraint comms_channels_channel_type_check
  check (channel_type in ('department', 'team', 'project', 'general', 'announcement'));

alter table public.comms_channels
  add column if not exists posting_mode text not null default 'open'
  check (posting_mode in ('open', 'admins_only'));

-- ---------- M4: FULL-TEXT SEARCH ----------

alter table public.comms_messages
  add column if not exists content_tsv tsvector;

create or replace function public.comms_messages_content_tsv_update()
returns trigger
language plpgsql
as $$
declare
  searchable text;
begin
  searchable := new.content;
  if searchable like '::gif::%' then
    searchable := 'GIF';
  end if;
  new.content_tsv := to_tsvector('english', coalesce(searchable, ''));
  return new;
end;
$$;

drop trigger if exists trg_comms_messages_content_tsv on public.comms_messages;
create trigger trg_comms_messages_content_tsv
  before insert or update of content on public.comms_messages
  for each row execute function public.comms_messages_content_tsv_update();

update public.comms_messages
set content_tsv = to_tsvector(
  'english',
  case when content like '::gif::%' then 'GIF' else coalesce(content, '') end
)
where content_tsv is null;

create index if not exists idx_comms_messages_content_tsv
  on public.comms_messages using gin (content_tsv);

-- ---------- M5: ATTACHMENTS ----------

create table if not exists public.comms_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.comms_messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_comms_attachments_message
  on public.comms_message_attachments(message_id);

alter table public.comms_message_attachments enable row level security;

drop policy if exists "Attachments: visible with message" on public.comms_message_attachments;
create policy "Attachments: visible with message"
  on public.comms_message_attachments for select
  using (
    exists (
      select 1 from public.comms_messages m
      where m.id = message_id
    )
  );

drop policy if exists "Attachments: insert own" on public.comms_message_attachments;
create policy "Attachments: insert own"
  on public.comms_message_attachments for insert
  with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Attachments: delete own" on public.comms_message_attachments;
create policy "Attachments: delete own"
  on public.comms_message_attachments for delete
  using (user_id = auth.uid());

-- ---------- M6: DURABLE CONTEXT COLUMNS ----------

alter table public.comms_channels
  add column if not exists context_type text
  check (context_type is null or context_type in ('task', 'client', 'employee', 'project', 'job', 'invoice'));

alter table public.comms_channels
  add column if not exists context_id uuid;

create unique index if not exists idx_comms_channels_org_context
  on public.comms_channels(organization_id, context_type, context_id)
  where context_type is not null and context_id is not null;

-- Backfill from description markers: katana-context:type:uuid
update public.comms_channels c
set
  context_type = lower(substring(c.description from 'katana-context:(task|client|employee|project|job|invoice):')),
  context_id = (substring(c.description from 'katana-context:(?:task|client|employee|project|job|invoice):([0-9a-f-]{36})'))::uuid
where c.description ~* 'katana-context:(task|client|employee|project|job|invoice):[0-9a-f-]{36}'
  and c.context_type is null;

-- Storage bucket for attachments (create in Dashboard if missing):
-- insert into storage.buckets (id, name, public) values ('comms-attachments', 'comms-attachments', true)
--   on conflict (id) do nothing;
