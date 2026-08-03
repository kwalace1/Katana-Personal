-- =============================================================================
-- Katana Comms Preferences Migration
-- Mute/hide channels & DMs, mute individuals, leave conversations
-- Run in Supabase Dashboard → SQL Editor (rerun-safe)
-- =============================================================================

-- Per-user channel preferences (mute notifications, hide from sidebar)
create table if not exists public.comms_channel_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id uuid not null references public.comms_channels(id) on delete cascade,
  is_muted boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel_id)
);

create index if not exists idx_comms_channel_prefs_user on public.comms_channel_prefs(user_id);
create index if not exists idx_comms_channel_prefs_channel on public.comms_channel_prefs(channel_id);

-- Per-user conversation preferences (mute, hide / "delete" DM for self)
create table if not exists public.comms_conversation_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.comms_conversations(id) on delete cascade,
  is_muted boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, conversation_id)
);

create index if not exists idx_comms_conv_prefs_user on public.comms_conversation_prefs(user_id);
create index if not exists idx_comms_conv_prefs_conv on public.comms_conversation_prefs(conversation_id);

-- Mute a person org-wide in comms (suppress their message notifications)
create table if not exists public.comms_user_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  muted_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, muted_user_id),
  check (user_id <> muted_user_id)
);

create index if not exists idx_comms_user_mutes_user on public.comms_user_mutes(user_id);

-- Allow members to leave conversations (hide/delete DM for self)
drop policy if exists "Conversation members: self can leave" on public.comms_conversation_members;
create policy "Conversation members: self can leave"
  on public.comms_conversation_members for delete
  using (member_user_id = auth.uid());

-- ---------- RLS: CHANNEL PREFS ----------

alter table public.comms_channel_prefs enable row level security;

drop policy if exists "Channel prefs: own rows" on public.comms_channel_prefs;
create policy "Channel prefs: own rows"
  on public.comms_channel_prefs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- RLS: CONVERSATION PREFS ----------

alter table public.comms_conversation_prefs enable row level security;

drop policy if exists "Conversation prefs: own rows" on public.comms_conversation_prefs;
create policy "Conversation prefs: own rows"
  on public.comms_conversation_prefs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- RLS: USER MUTES ----------

alter table public.comms_user_mutes enable row level security;

drop policy if exists "User mutes: own rows" on public.comms_user_mutes;
create policy "User mutes: own rows"
  on public.comms_user_mutes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
