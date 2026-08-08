-- Fix: likes/comments tables existed without GRANTs (permission denied).
-- Run this in Supabase → SQL Editor → New query → Run.

grant usage on schema public to anon, authenticated, service_role;

grant all on table public.together_post_likes to anon, authenticated, service_role;
grant all on table public.together_post_comments to anon, authenticated, service_role;

grant execute on function public.can_view_together_post(text) to anon, authenticated, service_role;
grant execute on function public.uid_text() to anon, authenticated, service_role;

-- Ensure RLS helper + policies exist (safe if already applied)
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

grant execute on function public.can_view_together_post(text) to anon, authenticated, service_role;

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
