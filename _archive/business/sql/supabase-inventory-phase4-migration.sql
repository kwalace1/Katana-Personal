-- =============================================================================
-- Katana Inventory Phase 4 – atomic movements, allocations, PO receive, refs
-- Run in Supabase SQL Editor after prior inventory migrations.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Supporting tables (if missing)
-- -----------------------------------------------------------------------------

create table if not exists public.inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null,
  movement_date timestamptz not null default now(),
  reason text not null default '',
  change_qty numeric not null default 0,
  reference text,
  user_name text,
  notes text,
  po_id uuid,
  po_line_id uuid,
  job_id uuid,
  project_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_transactions (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('scan-in', 'check-out', 'adjustment', 'po-receive')),
  item_id uuid not null,
  sku text not null default '',
  product_name text not null default '',
  quantity numeric not null default 0,
  transaction_date timestamptz not null default now(),
  user_name text,
  reference text,
  notes text,
  location text,
  quantity_delta numeric,
  po_id uuid,
  po_line_id uuid,
  job_id uuid,
  project_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null default '',
  contact_name text,
  email text,
  phone text,
  address text,
  performance_score numeric not null default 100,
  lead_time numeric not null default 0,
  total_orders numeric not null default 0,
  on_time_delivery numeric not null default 100,
  notes text,
  is_active boolean not null default true,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extend existing tables
alter table public.inventory_movements add column if not exists po_id uuid;
alter table public.inventory_movements add column if not exists po_line_id uuid;
alter table public.inventory_movements add column if not exists job_id uuid;
alter table public.inventory_movements add column if not exists project_id uuid;
alter table public.inventory_movements add column if not exists organization_id uuid;

alter table public.inventory_transactions add column if not exists po_id uuid;
alter table public.inventory_transactions add column if not exists po_line_id uuid;
alter table public.inventory_transactions add column if not exists job_id uuid;
alter table public.inventory_transactions add column if not exists project_id uuid;
alter table public.inventory_transactions add column if not exists organization_id uuid;
alter table public.inventory_transactions add column if not exists location text;
alter table public.inventory_transactions add column if not exists quantity_delta numeric;

-- Widen transaction type constraint for po-receive / adjustment
alter table public.inventory_transactions drop constraint if exists inventory_transactions_type_check;
alter table public.inventory_transactions add constraint inventory_transactions_type_check
  check (type in ('scan-in', 'check-out', 'adjustment', 'po-receive'));

alter table public.purchase_orders add column if not exists organization_id uuid;
alter table public.purchase_orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.po_line_items add column if not exists organization_id uuid;
alter table public.po_line_items add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Allocations
create table if not exists public.inventory_allocations (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null,
  quantity numeric not null default 0 check (quantity > 0),
  reference_type text not null check (reference_type in ('job', 'project', 'manual')),
  reference_id uuid,
  reference_label text,
  status text not null default 'active' check (status in ('active', 'fulfilled', 'cancelled')),
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_allocations_item_id_idx on public.inventory_allocations(item_id);
create index if not exists inventory_allocations_status_idx on public.inventory_allocations(status);
create index if not exists inventory_movements_item_id_idx on public.inventory_movements(item_id);
create index if not exists inventory_transactions_item_id_idx on public.inventory_transactions(item_id);

-- -----------------------------------------------------------------------------
-- Status helper
-- -----------------------------------------------------------------------------

create or replace function public.compute_inventory_status(p_qty numeric, p_min_qty numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_qty, 0) <= 0 then 'out-of-stock'
    when coalesce(p_min_qty, 0) > 0 and p_qty <= p_min_qty then 'low-stock'
    else 'in-stock'
  end;
$$;

-- Keep status/total_value in sync when qty or cost changes directly
create or replace function public.inventory_items_recompute_derived()
returns trigger
language plpgsql
as $$
begin
  new.status := public.compute_inventory_status(new.on_hand_qty, new.min_qty);
  new.total_value := coalesce(new.on_hand_qty, 0) * coalesce(new.unit_cost, 0);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists inventory_items_recompute_derived_trg on public.inventory_items;
create trigger inventory_items_recompute_derived_trg
  before insert or update of on_hand_qty, min_qty, unit_cost on public.inventory_items
  for each row execute function public.inventory_items_recompute_derived();

-- Sync allocated from active reservations
create or replace function public.sync_inventory_allocated_for_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventory_items
  set allocated = coalesce((
    select sum(quantity)
    from public.inventory_allocations
    where item_id = p_item_id and status = 'active'
  ), 0),
  updated_at = now()
  where id = p_item_id;
end;
$$;

create or replace function public.inventory_allocations_sync_allocated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_inventory_allocated_for_item(coalesce(new.item_id, old.item_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists inventory_allocations_sync_allocated_trg on public.inventory_allocations;
create trigger inventory_allocations_sync_allocated_trg
  after insert or update or delete on public.inventory_allocations
  for each row execute function public.inventory_allocations_sync_allocated();

-- -----------------------------------------------------------------------------
-- Atomic inventory movement
-- -----------------------------------------------------------------------------

create or replace function public.apply_inventory_movement(
  p_item_id uuid,
  p_quantity_delta numeric,
  p_movement_type text,
  p_reason text default '',
  p_reference text default null,
  p_user_name text default null,
  p_notes text default null,
  p_po_id uuid default null,
  p_po_line_id uuid default null,
  p_job_id uuid default null,
  p_project_id uuid default null,
  p_unit_cost_override numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_org_id uuid;
  v_user_id uuid;
  v_new_qty numeric;
  v_tx_type text;
  v_abs_qty numeric;
begin
  v_user_id := auth.uid();
  v_org_id := public.get_user_organization_id();

  select * into v_item
  from public.inventory_items
  where id = p_item_id and is_active = true
  for update;

  if not found then
    raise exception 'Item not found or inactive';
  end if;

  if v_org_id is not null and v_item.organization_id is not null
     and v_item.organization_id <> v_org_id then
    raise exception 'Item not in your organization';
  end if;

  v_new_qty := coalesce(v_item.on_hand_qty, 0) + p_quantity_delta;

  if p_quantity_delta < 0 then
    if v_new_qty < 0 then
      raise exception 'Insufficient available quantity';
    end if;
    if (coalesce(v_item.on_hand_qty, 0) - coalesce(v_item.allocated, 0) + p_quantity_delta) < 0 then
      raise exception 'Insufficient available quantity (allocated stock reserved)';
    end if;
  end if;

  if p_unit_cost_override is not null and p_quantity_delta > 0 then
    v_item.unit_cost := p_unit_cost_override;
  end if;

  update public.inventory_items
  set
    on_hand_qty = v_new_qty,
    unit_cost = v_item.unit_cost,
    last_movement_at = now(),
    updated_at = now()
  where id = p_item_id
  returning * into v_item;

  v_abs_qty := abs(p_quantity_delta);
  v_tx_type := case
    when p_movement_type in ('scan-in', 'check-out', 'adjustment', 'po-receive') then p_movement_type
    when p_quantity_delta >= 0 then 'scan-in'
    else 'check-out'
  end;

  insert into public.inventory_movements (
    item_id, movement_date, reason, change_qty, reference, user_name, notes,
    po_id, po_line_id, job_id, project_id, user_id, organization_id
  ) values (
    p_item_id, now(), coalesce(p_reason, ''), p_quantity_delta, p_reference, p_user_name, p_notes,
    p_po_id, p_po_line_id, p_job_id, p_project_id, v_user_id, coalesce(v_item.organization_id, v_org_id)
  );

  insert into public.inventory_transactions (
    type, item_id, sku, product_name, quantity, transaction_date, user_name, reference, notes,
    location, quantity_delta, po_id, po_line_id, job_id, project_id, user_id, organization_id
  ) values (
    v_tx_type, p_item_id, v_item.sku, v_item.product_name, v_abs_qty, now(), p_user_name, p_reference, p_notes,
    v_item.location, p_quantity_delta, p_po_id, p_po_line_id, p_job_id, p_project_id, v_user_id,
    coalesce(v_item.organization_id, v_org_id)
  );

  return to_jsonb(v_item);
end;
$$;

-- -----------------------------------------------------------------------------
-- Receive PO lines atomically
-- -----------------------------------------------------------------------------

create or replace function public.receive_purchase_order_lines(
  p_po_id uuid,
  p_lines jsonb,
  p_user_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_line record;
  v_po_line public.po_line_items%rowtype;
  v_receive_qty numeric;
  v_remaining numeric;
  v_item_id uuid;
  v_all_received boolean := true;
  v_any_received boolean := false;
  v_po_total numeric := 0;
  v_results jsonb := '[]'::jsonb;
begin
  select * into v_po from public.purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'Purchase order not found';
  end if;

  if v_po.status not in ('open', 'pending') then
    raise exception 'Purchase order is not open for receiving';
  end if;

  for v_line in
    select * from jsonb_to_recordset(p_lines) as x(po_line_id uuid, quantity numeric)
  loop
    v_receive_qty := coalesce(v_line.quantity, 0);
    if v_receive_qty <= 0 then
      continue;
    end if;

    select * into v_po_line
    from public.po_line_items
    where id = v_line.po_line_id and po_id = p_po_id
    for update;

    if not found then
      raise exception 'PO line not found: %', v_line.po_line_id;
    end if;

    v_remaining := v_po_line.quantity - coalesce(v_po_line.received_qty, 0);
    if v_receive_qty > v_remaining then
      raise exception 'Cannot receive more than remaining quantity for line %', v_po_line.sku;
    end if;

    v_item_id := v_po_line.item_id;
    if v_item_id is null then
      select id into v_item_id from public.inventory_items
      where sku = v_po_line.sku and is_active = true
      order by created_at desc limit 1;
    end if;

    if v_item_id is null then
      raise exception 'No inventory item linked for SKU %', v_po_line.sku;
    end if;

    perform public.apply_inventory_movement(
      v_item_id,
      v_receive_qty,
      'po-receive',
      'PO Receive',
      v_po.po_number,
      p_user_name,
      null,
      p_po_id,
      v_po_line.id,
      null,
      null,
      v_po_line.unit_cost
    );

    update public.po_line_items
    set received_qty = coalesce(received_qty, 0) + v_receive_qty,
        total = quantity * unit_cost,
        updated_at = now()
    where id = v_po_line.id;

    v_any_received := true;
    v_results := v_results || jsonb_build_object(
      'po_line_id', v_po_line.id,
      'received_qty', v_receive_qty
    );
  end loop;

  select bool_and(coalesce(received_qty, 0) >= quantity)
  into v_all_received
  from public.po_line_items
  where po_id = p_po_id;

  select coalesce(sum(total), 0) into v_po_total from public.po_line_items where po_id = p_po_id;

  update public.purchase_orders
  set
    status = case when v_all_received then 'received' else 'pending' end,
    received_date = case when v_all_received then current_date else received_date end,
    total = v_po_total,
    updated_at = now()
  where id = p_po_id
  returning * into v_po;

  return jsonb_build_object(
    'po', to_jsonb(v_po),
    'lines', v_results,
    'any_received', v_any_received
  );
end;
$$;

-- Backfill status/total_value for existing rows
update public.inventory_items
set
  status = public.compute_inventory_status(on_hand_qty, min_qty),
  total_value = coalesce(on_hand_qty, 0) * coalesce(unit_cost, 0)
where true;

-- RLS for allocations (org isolation)
alter table public.inventory_allocations enable row level security;

drop policy if exists "org_isolation_inventory_allocations" on public.inventory_allocations;
create policy "org_isolation_inventory_allocations" on public.inventory_allocations
  for all
  using (organization_id = public.get_user_organization_id())
  with check (organization_id = public.get_user_organization_id());

grant execute on function public.apply_inventory_movement to authenticated;
grant execute on function public.receive_purchase_order_lines to authenticated;
grant execute on function public.sync_inventory_allocated_for_item to authenticated;
