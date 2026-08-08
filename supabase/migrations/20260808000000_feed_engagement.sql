-- Feed engagement: likes, comments, and repost snapshot column
-- Safe to run after 20260328000000_init_social.sql

alter table public.together_posts
  add column if not exists repost jsonb;

create table if not exists public.together_post_likes (
  post_id text not null references public.together_posts (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists together_post_likes_user_idx on public.together_post_likes (user_id);

create table if not exists public.together_post_comments (
  id text primary key,
  post_id text not null references public.together_posts (id) on delete cascade,
  author_id text not null,
  text text not null check (char_length(text) > 0 and char_length(text) <= 280),
  created_at timestamptz not null default now()
);
create index if not exists together_post_comments_post_idx
  on public.together_post_comments (post_id, created_at asc);

alter table public.together_post_likes enable row level security;
alter table public.together_post_comments enable row level security;

-- Can engage only on posts you can already view
create or replace function public.can_view_together_post(p_post_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.together_posts p
    where p.id = p_post_id
      and public.uid_text() = any (p.viewer_ids)
  );
$$;

drop policy if exists together_post_likes_select on public.together_post_likes;
create policy together_post_likes_select on public.together_post_likes
  for select to authenticated
  using (public.can_view_together_post(post_id));

drop policy if exists together_post_likes_insert on public.together_post_likes;
create policy together_post_likes_insert on public.together_post_likes
  for insert to authenticated
  with check (
    user_id = public.uid_text()
    and public.can_view_together_post(post_id)
  );

drop policy if exists together_post_likes_delete on public.together_post_likes;
create policy together_post_likes_delete on public.together_post_likes
  for delete to authenticated
  using (user_id = public.uid_text());

drop policy if exists together_post_comments_select on public.together_post_comments;
create policy together_post_comments_select on public.together_post_comments
  for select to authenticated
  using (public.can_view_together_post(post_id));

drop policy if exists together_post_comments_insert on public.together_post_comments;
create policy together_post_comments_insert on public.together_post_comments
  for insert to authenticated
  with check (
    author_id = public.uid_text()
    and public.can_view_together_post(post_id)
  );

drop policy if exists together_post_comments_delete on public.together_post_comments;
create policy together_post_comments_delete on public.together_post_comments
  for delete to authenticated
  using (author_id = public.uid_text());

do $$
begin
  alter publication supabase_realtime add table public.together_post_likes;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.together_post_comments;
exception
  when duplicate_object then null;
end $$;
