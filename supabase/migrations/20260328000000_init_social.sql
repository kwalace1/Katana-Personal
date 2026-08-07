-- Katana Personal: social + workspace sync schema (Firebase → Supabase cutover)
-- User IDs are text (auth.users.id::text). New signups use Supabase UUIDs.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers (uid_text only — table-dependent helpers come after CREATE TABLE)
-- ---------------------------------------------------------------------------
create or replace function public.uid_text()
returns text
language sql
stable
as $$
  select auth.uid()::text;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  uid text primary key,
  email text not null default '',
  display_name text not null default 'Friend',
  friend_code text not null unique,
  photo_url text,
  share_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.friend_codes (
  code text primary key,
  uid text not null references public.profiles (uid) on delete cascade
);

create table public.friendships (
  id text primary key,
  a text not null,
  b text not null,
  status text not null check (status in ('pending', 'accepted')),
  requested_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index friendships_a_idx on public.friendships (a);
create index friendships_b_idx on public.friendships (b);

create table public.blocks (
  id text primary key,
  blocker text not null,
  blocked text not null,
  created_at timestamptz not null default now()
);
create index blocks_blocker_idx on public.blocks (blocker);

create table public.shared_items (
  id text primary key default gen_random_uuid()::text,
  kind text not null,
  title text not null,
  body text default '',
  data jsonb not null default '{}'::jsonb,
  owner_id text not null,
  member_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shared_items_member_ids_idx on public.shared_items using gin (member_ids);

create table public.activity (
  uid text primary key,
  message text not null default '',
  updated_at timestamptz not null default now(),
  events jsonb not null default '[]'::jsonb
);

create table public.streaks (
  uid text primary key,
  display_name text not null default 'Friend',
  updated_at timestamptz not null default now(),
  water_streak int not null default 0,
  sleep_streak int not null default 0,
  nutrition_streak int not null default 0,
  workout_streak int not null default 0,
  lift_streak int not null default 0,
  habit_streak_best int not null default 0,
  water_glasses_today int not null default 0,
  sleep_hours_last numeric not null default 0,
  habits_done_today int not null default 0,
  habits_due_today int not null default 0,
  calories_today int not null default 0,
  workout_minutes_today int not null default 0,
  visible jsonb not null default '{}'::jsonb
);

create table public.circles (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  owner_id text not null,
  member_ids text[] not null default '{}',
  moderator_ids text[] not null default '{}',
  challenge jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index circles_member_ids_idx on public.circles using gin (member_ids);

create table public.circle_events (
  id text primary key default gen_random_uuid()::text,
  circle_id text not null references public.circles (id) on delete cascade,
  title text not null,
  notes text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  category text not null default 'errand',
  color text not null default '',
  created_by text not null,
  assignee_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index circle_events_circle_id_idx on public.circle_events (circle_id);

create table public.circle_posts (
  id text primary key default gen_random_uuid()::text,
  circle_id text not null references public.circles (id) on delete cascade,
  author_id text not null,
  message text not null check (char_length(message) > 0 and char_length(message) <= 500),
  created_at timestamptz not null default now()
);
create index circle_posts_circle_id_idx on public.circle_posts (circle_id);

create table public.together_posts (
  id text primary key,
  author_id text not null,
  created_at timestamptz not null default now(),
  text text not null default '' check (char_length(text) <= 500),
  audience text not null check (audience in ('friends', 'circle')),
  circle_id text,
  viewer_ids text[] not null default '{}',
  media jsonb not null default '[]'::jsonb,
  card jsonb
);
create index together_posts_viewer_ids_idx on public.together_posts using gin (viewer_ids);
create index together_posts_created_at_idx on public.together_posts (created_at desc);

create table public.circle_invites (
  token text primary key,
  circle_id text not null,
  circle_name text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by text[] not null default '{}',
  invitee_uid text,
  status text,
  responded_at timestamptz
);
create index circle_invites_invitee_status_idx on public.circle_invites (invitee_uid, status);
create index circle_invites_created_by_circle_idx on public.circle_invites (created_by, circle_id, status);

create table public.notifications (
  id text primary key default gen_random_uuid()::text,
  uid text not null,
  kind text not null,
  title text not null,
  body text not null,
  href text default '',
  read boolean not null default false,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);
create index notifications_uid_created_idx on public.notifications (uid, created_at desc);

create table public.push_tokens (
  uid text primary key,
  token text not null,
  platform text not null default 'web',
  updated_at timestamptz not null default now()
);

create table public.workspace_collections (
  user_id text not null,
  collection text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection)
);

create table public.workspace_meta (
  user_id text primary key,
  updated_at timestamptz not null default now(),
  has_data boolean not null default false,
  local_user_id text
);

-- ---------------------------------------------------------------------------
-- Helpers that reference tables (must run after CREATE TABLE)
-- ---------------------------------------------------------------------------
create or replace function public.are_friends(a text, b text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.a = least(a, b) and f.b = greatest(a, b))
        or (f.a = a and f.b = b)
        or (f.a = b and f.b = a)
      )
  );
$$;

create or replace function public.is_circle_member(p_circle_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circles c
    where c.id = p_circle_id
      and public.uid_text() = any (c.member_ids)
  );
$$;

create or replace function public.can_view_together_post(p_post_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.together_posts p
    where p.id = p_post_id
      and public.uid_text() = any (p.viewer_ids)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.friend_codes enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.shared_items enable row level security;
alter table public.activity enable row level security;
alter table public.streaks enable row level security;
alter table public.circles enable row level security;
alter table public.circle_events enable row level security;
alter table public.circle_posts enable row level security;
alter table public.together_posts enable row level security;
alter table public.circle_invites enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.workspace_collections enable row level security;
alter table public.workspace_meta enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (true);
create policy profiles_insert on public.profiles for insert to authenticated
  with check (uid = public.uid_text());
create policy profiles_update on public.profiles for update to authenticated
  using (uid = public.uid_text()) with check (uid = public.uid_text());

-- friend_codes
create policy friend_codes_select on public.friend_codes for select to authenticated
  using (true);
create policy friend_codes_insert on public.friend_codes for insert to authenticated
  with check (uid = public.uid_text());
create policy friend_codes_update on public.friend_codes for update to authenticated
  using (uid = public.uid_text()) with check (uid = public.uid_text());
create policy friend_codes_delete on public.friend_codes for delete to authenticated
  using (uid = public.uid_text());

-- friendships
create policy friendships_select on public.friendships for select to authenticated
  using (a = public.uid_text() or b = public.uid_text());
create policy friendships_insert on public.friendships for insert to authenticated
  with check (a = public.uid_text() or b = public.uid_text());
create policy friendships_update on public.friendships for update to authenticated
  using (a = public.uid_text() or b = public.uid_text());
create policy friendships_delete on public.friendships for delete to authenticated
  using (a = public.uid_text() or b = public.uid_text());

-- blocks
create policy blocks_select on public.blocks for select to authenticated
  using (blocker = public.uid_text() or blocked = public.uid_text());
create policy blocks_insert on public.blocks for insert to authenticated
  with check (blocker = public.uid_text());
create policy blocks_delete on public.blocks for delete to authenticated
  using (blocker = public.uid_text());

-- shared_items
create policy shared_items_select on public.shared_items for select to authenticated
  using (public.uid_text() = any (member_ids));
create policy shared_items_insert on public.shared_items for insert to authenticated
  with check (public.uid_text() = any (member_ids));
create policy shared_items_update on public.shared_items for update to authenticated
  using (public.uid_text() = any (member_ids));
create policy shared_items_delete on public.shared_items for delete to authenticated
  using (public.uid_text() = any (member_ids));

-- activity / streaks (self write; self or friend read)
create policy activity_select on public.activity for select to authenticated
  using (uid = public.uid_text() or public.are_friends(public.uid_text(), uid));
create policy activity_write on public.activity for all to authenticated
  using (uid = public.uid_text()) with check (uid = public.uid_text());

create policy streaks_select on public.streaks for select to authenticated
  using (uid = public.uid_text() or public.are_friends(public.uid_text(), uid));
create policy streaks_write on public.streaks for all to authenticated
  using (uid = public.uid_text()) with check (uid = public.uid_text());

-- circles
create policy circles_select on public.circles for select to authenticated
  using (true);
create policy circles_insert on public.circles for insert to authenticated
  with check (owner_id = public.uid_text() and public.uid_text() = any (member_ids));
create policy circles_update on public.circles for update to authenticated
  using (
    public.uid_text() = any (member_ids)
    or not (public.uid_text() = any (member_ids))
  );
create policy circles_delete on public.circles for delete to authenticated
  using (owner_id = public.uid_text());

-- circle_events
create policy circle_events_select on public.circle_events for select to authenticated
  using (public.is_circle_member(circle_id));
create policy circle_events_insert on public.circle_events for insert to authenticated
  with check (public.is_circle_member(circle_id) and created_by = public.uid_text());
create policy circle_events_update on public.circle_events for update to authenticated
  using (public.is_circle_member(circle_id));
create policy circle_events_delete on public.circle_events for delete to authenticated
  using (public.is_circle_member(circle_id));

-- circle_posts
create policy circle_posts_select on public.circle_posts for select to authenticated
  using (public.is_circle_member(circle_id));
create policy circle_posts_insert on public.circle_posts for insert to authenticated
  with check (public.is_circle_member(circle_id) and author_id = public.uid_text());
create policy circle_posts_delete on public.circle_posts for delete to authenticated
  using (public.is_circle_member(circle_id) and author_id = public.uid_text());

-- together_posts
create policy together_posts_select on public.together_posts for select to authenticated
  using (public.uid_text() = any (viewer_ids));
create policy together_posts_insert on public.together_posts for insert to authenticated
  with check (
    author_id = public.uid_text()
    and public.uid_text() = any (viewer_ids)
  );
create policy together_posts_delete on public.together_posts for delete to authenticated
  using (author_id = public.uid_text());

-- circle_invites
create policy circle_invites_select on public.circle_invites for select to authenticated
  using (
    true
    or created_by = public.uid_text()
    or invitee_uid = public.uid_text()
  );
create policy circle_invites_insert on public.circle_invites for insert to authenticated
  with check (created_by = public.uid_text());
create policy circle_invites_update on public.circle_invites for update to authenticated
  using (
    created_by = public.uid_text()
    or invitee_uid = public.uid_text()
  );
create policy circle_invites_delete on public.circle_invites for delete to authenticated
  using (created_by = public.uid_text());

-- notifications
create policy notifications_select on public.notifications for select to authenticated
  using (uid = public.uid_text());
create policy notifications_insert on public.notifications for insert to authenticated
  with check (uid is not null and uid <> public.uid_text());
create policy notifications_update on public.notifications for update to authenticated
  using (uid = public.uid_text());
create policy notifications_delete on public.notifications for delete to authenticated
  using (uid = public.uid_text());

-- push_tokens
create policy push_tokens_all on public.push_tokens for all to authenticated
  using (uid = public.uid_text()) with check (uid = public.uid_text());

-- workspace
create policy workspace_collections_all on public.workspace_collections for all to authenticated
  using (user_id = public.uid_text()) with check (user_id = public.uid_text());
create policy workspace_meta_all on public.workspace_meta for all to authenticated
  using (user_id = public.uid_text()) with check (user_id = public.uid_text());

-- ---------------------------------------------------------------------------
-- Storage bucket: together
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'together',
  'together',
  false,
  26214400,
  array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do nothing;

-- Path: together/{authorUid}/{postId}/{fileName}  →  storage path relative to bucket is {authorUid}/{postId}/{fileName}
create policy together_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'together'
    and (
      (storage.foldername(name))[1] = public.uid_text()
      or public.can_view_together_post((storage.foldername(name))[2])
    )
  );

create policy together_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'together'
    and (storage.foldername(name))[1] = public.uid_text()
  );

create policy together_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'together'
    and (storage.foldername(name))[1] = public.uid_text()
  );

-- Realtime for live social feeds
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.circle_posts;
alter publication supabase_realtime add table public.circle_events;
alter publication supabase_realtime add table public.circle_invites;
alter publication supabase_realtime add table public.together_posts;

-- App + migration roles need table privileges (service_role bypasses RLS but still needs GRANTs)
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
