-- Add subtasks to tasks (optional checklist; drives task progress when present)
-- Run in Supabase Dashboard → SQL Editor if you already have the projects schema.

alter table public.tasks
  add column if not exists subtasks jsonb not null default '[]';

comment on column public.tasks.subtasks is 'Array of { id, title, completed }; when non-empty, task progress = (completed count / total) * 100';
