import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'

export type InventoryStatus = 'in-stock' | 'low-stock' | 'out-of-stock'

export type InventoryItemSnapshot = {
  id: string
  sku: string
  product_name: string
  location: string | null
  on_hand_qty: number
  min_qty: number
  reorder_qty: number
  unit_cost: number
  total_value: number
  allocated: number
  supplier_id: string | null
  supplier_name: string | null
  status: InventoryStatus
  barcode: string | null
  image_url: string | null
  category: string | null
  description: string | null
  last_movement_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MovementType = 'scan-in' | 'check-out' | 'adjustment' | 'po-receive'

export interface ApplyMovementParams {
  itemId: string
  quantityDelta: number
  movementType: MovementType
  reason: string
  reference?: string | null
  userName?: string | null
  notes?: string | null
  poId?: string | null
  poLineId?: string | null
  jobId?: string | null
  projectId?: string | null
  unitCostOverride?: number | null
}

export interface ReceivePoLineInput {
  po_line_id: string
  quantity: number
}

export function computeInventoryStatus(
  qty: number,
  minQty: number,
): InventoryStatus {
  if (qty <= 0) return 'out-of-stock'
  if (minQty > 0 && qty <= minQty) return 'low-stock'
  return 'in-stock'
}

function isRpcMissing(error: { message?: string; code?: string } | null): boolean {
  const m = error?.message ?? ''
  return (
    error?.code === 'PGRST202' ||
    /apply_inventory_movement|receive_purchase_order_lines|42883|does not exist/i.test(m)
  )
}

/** Apply stock change via RPC, or client-side fallback when migration not yet run. */
export async function applyInventoryMovement(
  params: ApplyMovementParams,
): Promise<InventoryItemSnapshot | null> {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase.rpc('apply_inventory_movement', {
    p_item_id: params.itemId,
    p_quantity_delta: params.quantityDelta,
    p_movement_type: params.movementType,
    p_reason: params.reason,
    p_reference: params.reference ?? null,
    p_user_name: params.userName ?? null,
    p_notes: params.notes ?? null,
    p_po_id: params.poId ?? null,
    p_po_line_id: params.poLineId ?? null,
    p_job_id: params.jobId ?? null,
    p_project_id: params.projectId ?? null,
    p_unit_cost_override: params.unitCostOverride ?? null,
  })

  if (!error && data) {
    return data as InventoryItemSnapshot
  }

  if (!isRpcMissing(error)) {
    console.error('apply_inventory_movement RPC error:', error)
    throw error
  }

  return applyInventoryMovementFallback(params)
}

async function applyInventoryMovementFallback(
  params: ApplyMovementParams,
): Promise<InventoryItemSnapshot | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data: item, error: fetchError } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', params.itemId)
    .single()

  if (fetchError || !item) throw fetchError ?? new Error('Item not found')

  const newQty = (item.on_hand_qty ?? 0) + params.quantityDelta
  if (newQty < 0) throw new Error('Insufficient available quantity')
  if (
    params.quantityDelta < 0 &&
    (item.on_hand_qty ?? 0) - (item.allocated ?? 0) + params.quantityDelta < 0
  ) {
    throw new Error('Insufficient available quantity (allocated stock reserved)')
  }

  const unitCost =
    params.unitCostOverride != null && params.quantityDelta > 0
      ? params.unitCostOverride
      : item.unit_cost

  const status = computeInventoryStatus(newQty, item.min_qty ?? 0)
  const totalValue = newQty * (unitCost ?? 0)
  const absQty = Math.abs(params.quantityDelta)
  const txType =
    params.movementType === 'po-receive'
      ? 'po-receive'
      : params.movementType === 'adjustment'
        ? 'adjustment'
        : params.movementType

  const { data: updated, error: updateError } = await supabase
    .from('inventory_items')
    .update({
      on_hand_qty: newQty,
      unit_cost: unitCost,
      status,
      total_value: totalValue,
      last_movement_at: new Date().toISOString(),
    })
    .eq('id', params.itemId)
    .select()
    .single()

  if (updateError) throw updateError

  await supabase.from('inventory_movements').insert({
    item_id: params.itemId,
    movement_date: new Date().toISOString(),
    reason: params.reason,
    change_qty: params.quantityDelta,
    reference: params.reference ?? null,
    user_name: params.userName ?? null,
    notes: params.notes ?? null,
    po_id: params.poId ?? null,
    po_line_id: params.poLineId ?? null,
    job_id: params.jobId ?? null,
    project_id: params.projectId ?? null,
    user_id: userId,
    organization_id: orgId,
  })

  await supabase.from('inventory_transactions').insert({
    type: txType,
    item_id: params.itemId,
    sku: item.sku,
    product_name: item.product_name,
    quantity: absQty,
    transaction_date: new Date().toISOString(),
    user_name: params.userName ?? null,
    reference: params.reference ?? null,
    notes: params.notes ?? null,
    location: item.location ?? null,
    quantity_delta: params.quantityDelta,
    po_id: params.poId ?? null,
    po_line_id: params.poLineId ?? null,
    job_id: params.jobId ?? null,
    project_id: params.projectId ?? null,
    user_id: userId,
    organization_id: orgId,
  })

  return updated as InventoryItemSnapshot
}

export async function receivePurchaseOrderLines(
  poId: string,
  lines: ReceivePoLineInput[],
  userName?: string,
): Promise<{ po: Record<string, unknown>; lines: unknown[] } | null> {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase.rpc('receive_purchase_order_lines', {
    p_po_id: poId,
    p_lines: lines,
    p_user_name: userName ?? null,
  })

  if (!error && data) {
    return data as { po: Record<string, unknown>; lines: unknown[] }
  }

  if (!isRpcMissing(error)) {
    console.error('receive_purchase_order_lines RPC error:', error)
    throw error
  }

  throw new Error(
    'PO receive requires the inventory phase 4 migration (receive_purchase_order_lines RPC).',
  )
}
