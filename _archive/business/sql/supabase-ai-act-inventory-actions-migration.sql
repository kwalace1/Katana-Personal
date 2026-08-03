-- ============================================================================
-- Agent Office Phase 2.2 — Inventory action kernel (ai_act_inventory_*)
-- Org-stamping SECURITY INVOKER actions over the inventory tables. Same
-- contract as PM/Support: ai_act_guard, explicit org re-check, enum validation,
-- audit on success+fail, {ok} envelope. Inventory base tables use an org-scoped
-- ALL policy (organization_id = get_user_organization_id()); the FOUND check
-- after each UPDATE still returns not_permitted on any RLS-blocked write.
--
--   purchase_orders.status      ∈ draft | open | pending | received | cancelled
--   inventory_allocations.status ∈ active | fulfilled | cancelled
--   suppliers.is_active          boolean
--
-- Deliberately NOT included: stock-quantity mutations (derived totals) and
-- supplier creation (needs required-field decisions) — a later, higher-care batch.
-- Depends on ai_act_guard()/agent_action_audit_log(). Idempotent.
-- ============================================================================

create or replace function public.ai_act_inventory_set_po_status(
  p_po_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before purchase_orders; v_row purchase_orders;
begin
  v_payload := jsonb_build_object('po_id', p_po_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('draft','open','pending','received','cancelled') then
    raise exception 'invalid_status: "%" (use draft|open|pending|received|cancelled)', p_status; end if;
  select * into v_before from purchase_orders t where t.id = p_po_id and t.organization_id = v_org;
  if not found then raise exception 'purchase_order_not_found'; end if;
  if v_before.status = p_status then
    return jsonb_build_object('ok',true,'action','inventory.set_po_status','changed',false,'purchase_order',to_jsonb(v_before),'note','PO already has that status'); end if;
  update purchase_orders t set status = p_status, updated_at = now()
    where t.id = p_po_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you do not have permission to update this purchase order'; end if;
  perform public.agent_action_audit_log('inventory.set_po_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),
    p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','inventory.set_po_status','changed',true,'before',to_jsonb(v_before),'purchase_order',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('inventory.set_po_status','failed',coalesce(v_payload,'{}'::jsonb),
    case when v_before.id is null then null else to_jsonb(v_before) end,null,
    p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','inventory.set_po_status','error',sqlerrm);
end; $$;

create or replace function public.ai_act_inventory_set_allocation_status(
  p_allocation_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before inventory_allocations; v_row inventory_allocations;
begin
  v_payload := jsonb_build_object('allocation_id', p_allocation_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('active','fulfilled','cancelled') then
    raise exception 'invalid_status: "%" (use active|fulfilled|cancelled)', p_status; end if;
  select * into v_before from inventory_allocations t where t.id = p_allocation_id and t.organization_id = v_org;
  if not found then raise exception 'allocation_not_found'; end if;
  if v_before.status = p_status then
    return jsonb_build_object('ok',true,'action','inventory.set_allocation_status','changed',false,'allocation',to_jsonb(v_before),'note','allocation already has that status'); end if;
  update inventory_allocations t set status = p_status, updated_at = now()
    where t.id = p_allocation_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you do not have permission to update this allocation'; end if;
  perform public.agent_action_audit_log('inventory.set_allocation_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),
    p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','inventory.set_allocation_status','changed',true,'before',to_jsonb(v_before),'allocation',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('inventory.set_allocation_status','failed',coalesce(v_payload,'{}'::jsonb),
    case when v_before.id is null then null else to_jsonb(v_before) end,null,
    p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','inventory.set_allocation_status','error',sqlerrm);
end; $$;

create or replace function public.ai_act_inventory_set_supplier_active(
  p_supplier_id uuid, p_active boolean,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before suppliers; v_row suppliers;
begin
  v_payload := jsonb_build_object('supplier_id', p_supplier_id, 'active', p_active);
  v_org := public.ai_act_guard();
  if p_active is null then raise exception 'active_required'; end if;
  select * into v_before from suppliers t where t.id = p_supplier_id and t.organization_id = v_org;
  if not found then raise exception 'supplier_not_found'; end if;
  if v_before.is_active is not distinct from p_active then
    return jsonb_build_object('ok',true,'action','inventory.set_supplier_active','changed',false,'supplier',to_jsonb(v_before),'note','supplier already in that state'); end if;
  update suppliers t set is_active = p_active, updated_at = now()
    where t.id = p_supplier_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you do not have permission to update this supplier'; end if;
  perform public.agent_action_audit_log('inventory.set_supplier_active','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),
    p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','inventory.set_supplier_active','changed',true,'before',to_jsonb(v_before),'supplier',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('inventory.set_supplier_active','failed',coalesce(v_payload,'{}'::jsonb),
    case when v_before.id is null then null else to_jsonb(v_before) end,null,
    p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','inventory.set_supplier_active','error',sqlerrm);
end; $$;

revoke all on function public.ai_act_inventory_set_po_status(uuid, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_inventory_set_po_status(uuid, text, text, text, text, text, text, smallint) to authenticated, service_role;
revoke all on function public.ai_act_inventory_set_allocation_status(uuid, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_inventory_set_allocation_status(uuid, text, text, text, text, text, text, smallint) to authenticated, service_role;
revoke all on function public.ai_act_inventory_set_supplier_active(uuid, boolean, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_inventory_set_supplier_active(uuid, boolean, text, text, text, text, text, smallint) to authenticated, service_role;
