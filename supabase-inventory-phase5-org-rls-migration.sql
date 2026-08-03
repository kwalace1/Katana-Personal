-- Inventory phase 5: unify org-based RLS across all inventory tables
-- Run after supabase-inventory-phase4-migration.sql and supabase-user-isolation-migration.sql

-- Backfill organization_id from inventory_items / purchase_orders where missing
update public.po_line_items pl
set organization_id = po.organization_id
from public.purchase_orders po
where pl.po_id = po.id
  and pl.organization_id is null
  and po.organization_id is not null;

update public.inventory_movements m
set organization_id = i.organization_id
from public.inventory_items i
where m.item_id = i.id
  and m.organization_id is null
  and i.organization_id is not null;

update public.inventory_transactions t
set organization_id = i.organization_id
from public.inventory_items i
where t.item_id = i.id
  and t.organization_id is null
  and i.organization_id is not null;

-- Purchase orders
drop policy if exists "user_isolation_purchase_orders" on public.purchase_orders;
drop policy if exists "Authenticated only purchase_orders" on public.purchase_orders;
drop policy if exists "Allow all on purchase_orders" on public.purchase_orders;

create policy "org_isolation_purchase_orders" on public.purchase_orders
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

-- PO line items
drop policy if exists "user_isolation_po_line_items" on public.po_line_items;
drop policy if exists "Authenticated only po_line_items" on public.po_line_items;
drop policy if exists "Allow all on po_line_items" on public.po_line_items;

alter table public.po_line_items enable row level security;

create policy "org_isolation_po_line_items" on public.po_line_items
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

-- Suppliers
drop policy if exists "user_isolation_suppliers" on public.suppliers;
drop policy if exists "Authenticated only suppliers" on public.suppliers;
drop policy if exists "Allow all on suppliers" on public.suppliers;

create policy "org_isolation_suppliers" on public.suppliers
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

-- Inventory movements
drop policy if exists "user_isolation_inv_movements" on public.inventory_movements;
drop policy if exists "Authenticated only inventory_movements" on public.inventory_movements;
drop policy if exists "Allow all on inventory_movements" on public.inventory_movements;

alter table public.inventory_movements enable row level security;

create policy "org_isolation_inventory_movements" on public.inventory_movements
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

-- Inventory transactions
drop policy if exists "user_isolation_inv_transactions" on public.inventory_transactions;
drop policy if exists "Authenticated only inventory_transactions" on public.inventory_transactions;
drop policy if exists "Allow all on inventory_transactions" on public.inventory_transactions;

alter table public.inventory_transactions enable row level security;

create policy "org_isolation_inventory_transactions" on public.inventory_transactions
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());
