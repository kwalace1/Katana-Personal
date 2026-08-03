-- =============================================================================
-- Katana Comms Schema
-- Internal communication layer: channels, direct messages, contextual messaging
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================================

-- Enable UUID generation if not already enabled
create extension if not exists "uuid-ossp";

-- =============================================================================
-- 1. CHANNELS
-- Departmental / team / project / general communication spaces
-- =============================================================================

create table if not exists public.comms_channels (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  channel_type text not null default 'general' check (channel_type in ('department', 'team', 'project', 'general')),
  is_private boolean not null default false,
  created_by uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comms_channels_org on public.comms_channels(organization_id);
create index if not exists idx_comms_channels_type on public.comms_channels(channel_type);

-- =============================================================================
-- 2. CHANNEL MEMBERS
-- =============================================================================

create table if not exists public.comms_channel_members (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references public.comms_channels(id) on delete cascade,
  member_user_id uuid not null references auth.users(id),
  role text not null default 'member' check (role in ('admin', 'member')),
  user_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  unique(channel_id, member_user_id)
);

create index if not exists idx_comms_channel_members_channel on public.comms_channel_members(channel_id);
create index if not exists idx_comms_channel_members_user on public.comms_channel_members(member_user_id);

-- =============================================================================
-- 3. CONVERSATIONS (Direct Messages & Group DMs)
-- =============================================================================

create table if not exists public.comms_conversations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_type text not null default 'direct' check (conversation_type in ('direct', 'group')),
  name text,
  created_by uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comms_conversations_org on public.comms_conversations(organization_id);

-- =============================================================================
-- 4. CONVERSATION MEMBERS
-- =============================================================================

create table if not exists public.comms_conversation_members (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.comms_conversations(id) on delete cascade,
  member_user_id uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  unique(conversation_id, member_user_id)
);

create index if not exists idx_comms_conv_members_conv on public.comms_conversation_members(conversation_id);
create index if not exists idx_comms_conv_members_user on public.comms_conversation_members(member_user_id);

-- =============================================================================
-- 5. MESSAGES
-- Unified table for both channel and DM messages
-- Exactly one of channel_id / conversation_id must be set
-- =============================================================================

create table if not exists public.comms_messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid references public.comms_channels(id) on delete cascade,
  conversation_id uuid references public.comms_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  content text not null,
  parent_message_id uuid references public.comms_messages(id) on delete set null,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_target_check check (
    (channel_id is not null and conversation_id is null) or
    (channel_id is null and conversation_id is not null)
  )
);

create index if not exists idx_comms_messages_channel on public.comms_messages(channel_id, created_at);
create index if not exists idx_comms_messages_conversation on public.comms_messages(conversation_id, created_at);
create index if not exists idx_comms_messages_sender on public.comms_messages(sender_id);
create index if not exists idx_comms_messages_parent on public.comms_messages(parent_message_id);

-- =============================================================================
-- 6. CONTEXT LINKS
-- Tie messages to business objects (tasks, clients, employees, projects)
-- =============================================================================

create table if not exists public.comms_context_links (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references public.comms_messages(id) on delete cascade,
  context_type text not null check (context_type in ('task', 'client', 'employee', 'project')),
  context_id uuid not null,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_comms_context_links_message on public.comms_context_links(message_id);
create index if not exists idx_comms_context_links_target on public.comms_context_links(context_type, context_id);

-- =============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- These bypass RLS to avoid infinite recursion in membership checks.
-- =============================================================================

create or replace function public.get_user_organization_id()
returns uuid
language sql
stable
security definer
as $$
  select organization_id from public.user_profiles where id = auth.uid()
$$;

create or replace function public.is_channel_admin(p_channel_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.comms_channel_members
    where channel_id = p_channel_id
    and member_user_id = auth.uid()
    and role = 'admin'
  );
$$;

create or replace function public.is_channel_member(p_channel_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.comms_channel_members
    where channel_id = p_channel_id
    and member_user_id = auth.uid()
  );
$$;

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.comms_conversation_members
    where conversation_id = p_conversation_id
    and member_user_id = auth.uid()
  );
$$;

create or replace function public.is_channel_creator(p_channel_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.comms_channels
    where id = p_channel_id
    and created_by = auth.uid()
  );
$$;

create or replace function public.is_conversation_creator(p_conversation_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.comms_conversations
    where id = p_conversation_id
    and created_by = auth.uid()
  );
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- Uses security-definer helpers to avoid infinite recursion.
-- =============================================================================

-- ---------- CHANNELS ----------

alter table public.comms_channels enable row level security;

create policy "Channels: org members can view"
  on public.comms_channels for select
  using (
    organization_id = public.get_user_organization_id()
    and (
      created_by = auth.uid()
      or is_private = false
      or public.is_channel_member(id)
    )
  );

create policy "Channels: org members can create"
  on public.comms_channels for insert
  with check (
    auth.uid() is not null
    and organization_id = public.get_user_organization_id()
  );

create policy "Channels: creator or admin can update"
  on public.comms_channels for update
  using (
    created_by = auth.uid()
    or public.is_channel_admin(id)
  );

create policy "Channels: creator can delete"
  on public.comms_channels for delete
  using (created_by = auth.uid());

-- ---------- CHANNEL MEMBERS ----------

alter table public.comms_channel_members enable row level security;

-- Fellow members can see each other (security definer avoids recursion)
create policy "Channel members: visible to fellow members"
  on public.comms_channel_members for select
  using (
    member_user_id = auth.uid()
    or public.is_channel_member(channel_id)
  );

create policy "Channel members: join or admin can add"
  on public.comms_channel_members for insert
  with check (
    auth.uid() is not null
    and (
      member_user_id = auth.uid()
      or public.is_channel_creator(channel_id)
      or public.is_channel_admin(channel_id)
    )
  );

create policy "Channel members: self or admin can remove"
  on public.comms_channel_members for delete
  using (
    member_user_id = auth.uid()
    or public.is_channel_admin(channel_id)
  );

-- ---------- CONVERSATIONS ----------

alter table public.comms_conversations enable row level security;

create policy "Conversations: members can view"
  on public.comms_conversations for select
  using (
    created_by = auth.uid()
    or public.is_conversation_member(id)
  );

create policy "Conversations: org members can create"
  on public.comms_conversations for insert
  with check (
    auth.uid() is not null
    and organization_id = public.get_user_organization_id()
  );

create policy "Conversations: creator can update"
  on public.comms_conversations for update
  using (created_by = auth.uid());

-- ---------- CONVERSATION MEMBERS ----------

alter table public.comms_conversation_members enable row level security;

-- Fellow members can see each other (security definer avoids recursion)
create policy "Conversation members: visible to fellow members"
  on public.comms_conversation_members for select
  using (
    member_user_id = auth.uid()
    or public.is_conversation_member(conversation_id)
  );

create policy "Conversation members: creator can add"
  on public.comms_conversation_members for insert
  with check (
    auth.uid() is not null
    and (
      member_user_id = auth.uid()
      or public.is_conversation_creator(conversation_id)
    )
  );

-- ---------- MESSAGES ----------

alter table public.comms_messages enable row level security;

create policy "Messages: visible to members"
  on public.comms_messages for select
  using (
    (
      channel_id is not null
      and (
        public.is_channel_member(channel_id)
        or exists (
          select 1 from public.comms_channels
          where id = channel_id and is_private = false
          and organization_id = public.get_user_organization_id()
        )
      )
    )
    or (
      conversation_id is not null
      and public.is_conversation_member(conversation_id)
    )
  );

create policy "Messages: members can send"
  on public.comms_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      (
        channel_id is not null
        and (
          public.is_channel_member(channel_id)
          or exists (
            select 1 from public.comms_channels
            where id = channel_id and is_private = false
            and organization_id = public.get_user_organization_id()
          )
        )
      )
      or (
        conversation_id is not null
        and public.is_conversation_member(conversation_id)
      )
    )
  );

create policy "Messages: sender can update"
  on public.comms_messages for update
  using (sender_id = auth.uid());

create policy "Messages: sender can delete"
  on public.comms_messages for delete
  using (sender_id = auth.uid());

-- ---------- CONTEXT LINKS ----------

alter table public.comms_context_links enable row level security;

create policy "Context links: visible with message"
  on public.comms_context_links for select
  using (
    exists (
      select 1 from public.comms_messages m
      where m.id = message_id
    )
  );

create policy "Context links: sender can create"
  on public.comms_context_links for insert
  with check (
    exists (
      select 1 from public.comms_messages m
      where m.id = message_id and m.sender_id = auth.uid()
    )
  );

-- =============================================================================
-- Enable realtime for messages (live updates)
-- =============================================================================

alter publication supabase_realtime add table public.comms_messages;
