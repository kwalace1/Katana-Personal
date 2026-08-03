-- =============================================================================
-- Katana Inventory – Supabase schema (purchase orders)
-- Run this in Supabase Dashboard → SQL Editor to create the inventory tables.
-- Fixes: "could not find the table public.purchase_orders"
-- =============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Sequence for PO numbers (used by generate_po_number)
create sequence if not exists public.po_number_seq;

-- -----------------------------------------------------------------------------
-- purchase_orders
-- -----------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  po_number text not null,
  supplier_id uuid,
  supplier_name text not null default '',
  status text not null check (status in ('draft', 'open', 'pending', 'received', 'cancelled')) default 'draft',
  total numeric not null default 0,
  notes text,
  created_date date not null default (current_date),
  expected_date date,
  received_date date,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_orders_po_number_idx on public.purchase_orders(po_number);
create index if not exists purchase_orders_status_idx on public.purchase_orders(status);
create index if not exists purchase_orders_created_date_idx on public.purchase_orders(created_date);

-- -----------------------------------------------------------------------------
-- po_line_items
-- -----------------------------------------------------------------------------
create table if not exists public.po_line_items (
  id uuid primary key default uuid_generate_v4(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  item_id uuid,
  sku text not null default '',
  product_name text not null default '',
  quantity integer not null default 0,
  received_qty integer not null default 0,
  unit_cost numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists po_line_items_po_id_idx on public.po_line_items(po_id);

-- -----------------------------------------------------------------------------
-- RPC: generate_po_number (optional – app falls back to local if this fails)
-- -----------------------------------------------------------------------------
create or replace function public.generate_po_number()
returns text
language plpgsql
security definer
as $$
declare
  next_num bigint;
  result text;
begin
  next_num := nextval('public.po_number_seq');
  result := 'PO-' || to_char(now(), 'YYYY') || '-' || lpad(next_num::text, 4, '0');
  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS (allow all for now – tighten in production)
-- -----------------------------------------------------------------------------
alter table public.purchase_orders enable row level security;
alter table public.po_line_items enable row level security;

create policy "Allow all on purchase_orders" on public.purchase_orders for all using (true) with check (true);
create policy "Allow all on po_line_items" on public.po_line_items for all using (true) with check (true);
