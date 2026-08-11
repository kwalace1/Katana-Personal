-- Post edit (UPDATE) + report table for Social feed.
-- Run in Supabase → SQL Editor after deploy if migrations aren’t auto-applied.

grant usage on schema public to anon, authenticated, service_role;
grant execute on function public.uid_text() to anon, authenticated, service_role;
grant execute on function public.can_view_together_post(text) to anon, authenticated, service_role;

-- Authors can edit their own posts (client only patches text + media)
drop policy if exists together_posts_update on public.together_posts;
create policy together_posts_update on public.together_posts
  for update to authenticated
  using (author_id = public.uid_text())
  with check (author_id = public.uid_text());

create table if not exists public.together_post_reports (
  id text primary key,
  post_id text not null references public.together_posts (id) on delete cascade,
  reporter_id text not null,
  author_id text not null,
  reason text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create index if not exists together_post_reports_reporter_idx
  on public.together_post_reports (reporter_id, created_at desc);
create index if not exists together_post_reports_post_idx
  on public.together_post_reports (post_id);

alter table public.together_post_reports enable row level security;

grant all on table public.together_post_reports to anon, authenticated, service_role;

drop policy if exists together_post_reports_select on public.together_post_reports;
create policy together_post_reports_select on public.together_post_reports
  for select to authenticated
  using (reporter_id = public.uid_text());

drop policy if exists together_post_reports_insert on public.together_post_reports;
create policy together_post_reports_insert on public.together_post_reports
  for insert to authenticated
  with check (
    reporter_id = public.uid_text()
    and public.can_view_together_post(post_id)
  );
