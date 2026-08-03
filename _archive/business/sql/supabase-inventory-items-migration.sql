-- =============================================================================
-- Katana Inventory – line items table (inventory_items)
-- Matches src/lib/inventory-api.ts + api/tools.ts Katana Sync (KSync) tools.
-- RLS: same org isolation pattern as hr_employees / projects (organization_id).
-- Run in Supabase SQL Editor if this table is missing.
-- =============================================================================

create extension if not exists "uuid-ossp";

create table if not exists public.inventory_items (
  id uuid primary key default uuid_generate_v4(),
  sku text not null default '',
  product_name text not null default '',
  location text,
  on_hand_qty numeric not null default 0,
  min_qty numeric not null default 0,
  reorder_qty numeric not null default 0,
  unit_cost numeric not null default 0,
  total_value numeric not null default 0,
  allocated numeric not null default 0,
  supplier_id uuid,
  supplier_name text,
  status text not null default 'in-stock',
  barcode text,
  image_url text,
  category text,
  description text,
  last_movement_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid
);

create index if not exists inventory_items_organization_id_idx on public.inventory_items(organization_id);
create index if not exists inventory_items_is_active_idx on public.inventory_items(is_active);
create index if not exists inventory_items_product_name_idx on public.inventory_items(product_name);

alter table public.inventory_items enable row level security;

drop policy if exists "org_isolation_inventory_items" on public.inventory_items;
create policy "org_isolation_inventory_items" on public.inventory_items
  for all
  using (organization_id = get_user_organization_id())
  with check (organization_id = get_user_organization_id());
