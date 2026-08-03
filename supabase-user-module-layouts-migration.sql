-- =============================================================================
-- Katana User Module Layouts
-- Per-user customize layouts for module surfaces (Projects first; reusable)
-- Run in Supabase Dashboard → SQL Editor (rerun-safe)
-- =============================================================================

create table if not exists public.user_module_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  surface_id text not null,
  layout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_id, surface_id)
);

create index if not exists idx_user_module_layouts_user
  on public.user_module_layouts(user_id);

create index if not exists idx_user_module_layouts_module_surface
  on public.user_module_layouts(module_id, surface_id);

alter table public.user_module_layouts enable row level security;

drop policy if exists "Module layouts: own rows" on public.user_module_layouts;
create policy "Module layouts: own rows"
  on public.user_module_layouts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
