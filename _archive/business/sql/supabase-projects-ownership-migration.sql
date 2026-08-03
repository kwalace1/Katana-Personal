-- =============================================================================
-- Add "created by" and "assigned to" (owner) to projects
-- Run in Supabase SQL Editor if you already have the projects table.
-- =============================================================================

alter table public.projects
  add column if not exists created_by_name text default '',
  add column if not exists created_by_avatar text default '',
  add column if not exists owner_name text default '',
  add column if not exists owner_avatar text default '';

comment on column public.projects.created_by_name is 'Display name of user who created the project';
comment on column public.projects.owner_name is 'Display name of project owner / person assigned to the project';
