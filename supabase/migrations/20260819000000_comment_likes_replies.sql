-- Comment likes + threaded replies on Social posts
-- Safe to run after 20260808000000_feed_engagement.sql

alter table public.together_post_comments
  add column if not exists parent_id text references public.together_post_comments (id) on delete cascade;

create index if not exists together_post_comments_parent_idx
  on public.together_post_comments (parent_id, created_at asc);

create table if not exists public.together_comment_likes (
  comment_id text not null references public.together_post_comments (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists together_comment_likes_user_idx on public.together_comment_likes (user_id);

alter table public.together_comment_likes enable row level security;

create or replace function public.can_view_together_comment(p_comment_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.together_post_comments c
    where c.id = p_comment_id
      and public.can_view_together_post(c.post_id)
  );
$$;

grant execute on function public.can_view_together_comment(text) to anon, authenticated, service_role;
grant all on table public.together_comment_likes to anon, authenticated, service_role;

drop policy if exists together_comment_likes_select on public.together_comment_likes;
create policy together_comment_likes_select on public.together_comment_likes
  for select to authenticated
  using (public.can_view_together_comment(comment_id));

drop policy if exists together_comment_likes_insert on public.together_comment_likes;
create policy together_comment_likes_insert on public.together_comment_likes
  for insert to authenticated
  with check (
    user_id = public.uid_text()
    and public.can_view_together_comment(comment_id)
  );

drop policy if exists together_comment_likes_delete on public.together_comment_likes;
create policy together_comment_likes_delete on public.together_comment_likes
  for delete to authenticated
  using (user_id = public.uid_text());

-- Replies must belong to a comment on a post the author can already view
drop policy if exists together_post_comments_insert on public.together_post_comments;
create policy together_post_comments_insert on public.together_post_comments
  for insert to authenticated
  with check (
    author_id = public.uid_text()
    and public.can_view_together_post(post_id)
    and (
      parent_id is null
      or exists (
        select 1
        from public.together_post_comments p
        where p.id = parent_id
          and p.post_id = together_post_comments.post_id
      )
    )
  );

do $$
begin
  alter publication supabase_realtime add table public.together_comment_likes;
exception
  when duplicate_object then null;
end $$;
