-- Friends/Circle member mentions stored with the post.
-- Mention recipients must already be in viewer_ids; the client never expands audience.

alter table public.together_posts
  add column if not exists mentions jsonb not null default '[]'::jsonb;

