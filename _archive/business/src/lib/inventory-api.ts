import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import {
  applyInventoryMovement,
  receivePurchaseOrderLines as receivePurchaseOrderLinesRpc,
  computeInventoryStatus,
  type ReceivePoLineInput,
} from './inventory-movements'
import { uploadWithTracking } from './storage-api'
import { getTodayDateKey } from './due-date-utils'
import { getAvailableQty, resolveSupplierLink } from './inventory-utils'

export { applyInventoryMovement, computeInventoryStatus }
export type { ReceivePoLineInput }

export async function receivePurchaseOrderLines(
  poId: string,
  lines: ReceivePoLineInput[],
  userName?: string,
): Promise<{ po: Record<string, unknown>; lines: unknown[] } | null> {
  const result = await receivePurchaseOrderLinesRpc(poId, lines, userName)
  if (result) {
    try {
      await recordSupplierDeliveryMetrics(poId)
    } catch (err) {
      console.error('Supplier metrics update failed:', err)
    }
  }
  return result
}
export { getAvailableQty, findOpenPoLinesForItem, resolveSupplierLink } from './inventory-utils'
export type { OpenPoLineMatch } from './inventory-utils'

// ============================================
// TYPES
// ============================================

export interface InventoryItem {
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
  status: 'in-stock' | 'low-stock' | 'out-of-stock'
  barcode: string | null
  image_url: string | null
  category: string | null
  description: string | null
  last_movement_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  id: string
  item_id: string
  movement_date: string
  reason: string
  change_qty: number
  reference: string | null
  user_name: string | null
  notes: string | null
  po_id: string | null
  po_line_id: string | null
  job_id: string | null
  project_id: string | null
  created_at: string
}

export interface InventoryAllocation {
  id: string
  item_id: string
  quantity: number
  reference_type: 'job' | 'project' | 'manual'
  reference_id: string | null
  reference_label: string | null
  status: 'active' | 'fulfilled' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface CheckOutOptions {
  reference?: string
  userName?: string
  notes?: string
  reason?: string
  jobId?: string
  projectId?: string
  jobLabel?: string
  projectLabel?: string
}

export interface ScanInOptions {
  reference?: string
  userName?: string
  notes?: string
  reason?: string
  poId?: string
  poLineId?: string
}

export interface AdjustmentOptions {
  reason?: string
  reference?: string
  userName?: string
  notes?: string
}

export interface PurchaseOrder {
  id: string
  po_number: string
  supplier_id: string | null
  supplier_name: string
  status: 'draft' | 'open' | 'pending' | 'received' | 'cancelled'
  total: number
  notes: string | null
  created_date: string
  expected_date: string | null
  received_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  line_items?: POLineItem[]
}

export interface POLineItem {
  id: string
  po_id: string
  item_id: string | null
  sku: string
  product_name: string
  quantity: number
  received_qty: number
  unit_cost: number
  total: number
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  performance_score: number
  lead_time: number
  total_orders: number
  on_time_delivery: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryTransaction {
  id: string
  type: 'scan-in' | 'check-out' | 'adjustment' | 'po-receive'
  item_id: string
  sku: string
  product_name: string
  quantity: number
  transaction_date: string
  user_name: string | null
  reference: string | null
  notes: string | null
  location: string | null
  quantity_delta: number
  po_id: string | null
  po_line_id: string | null
  job_id: string | null
  project_id: string | null
  created_at: string
}

// ============================================
// INVENTORY ITEMS API
// ============================================

export interface GetInventoryItemsOptions {
  /** When true, return only archived (inactive) items. Default: active items only. */
  archivedOnly?: boolean
}

export async function getInventoryItems(opts?: GetInventoryItemsOptions): Promise<InventoryItem[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  let query = supabase.from('inventory_items').select('*').order('product_name')
  if (opts?.archivedOnly) {
    query = query.eq('is_active', false)
  } else {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching inventory items:', error)
    throw error
  }

  return data || []
}

export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching inventory item:', error)
    return null
  }

  return data
}

export async function getInventoryItemBySku(sku: string): Promise<InventoryItem | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .or(`sku.ilike.${sku},barcode.eq.${sku}`)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching inventory item by SKU:', error)
    return null
  }

  return data
}

export async function createInventoryItem(item: Omit<InventoryItem, 'id' | 'total_value' | 'created_at' | 'updated_at'>): Promise<InventoryItem | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('inventory_items')
    .insert({ ...item, user_id: userId, organization_id: orgId })
    .select()
    .single()

  if (error) {
    console.error('Error creating inventory item:', error)
    throw error
  }

  return data
}

export async function updateInventoryItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  // Remove computed fields
  const { total_value, created_at, updated_at, ...updateData } = updates

  const { data, error } = await supabase
    .from('inventory_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating inventory item:', error)
    throw error
  }

  return data
}

export async function deleteInventoryItem(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  // Soft delete
  const { error } = await supabase
    .from('inventory_items')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error deleting inventory item:', error)
    return false
  }

  return true
}

export async function restoreInventoryItem(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  const { error } = await supabase
    .from('inventory_items')
    .update({ is_active: true })
    .eq('id', id)

  if (error) {
    console.error('Error restoring inventory item:', error)
    return false
  }

  return true
}

export async function uploadInventoryItemImage(
  itemId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<InventoryItem | null> {
  if (!isSupabaseConfigured) return null

  const upload = await uploadWithTracking(file, {
    module: 'inventory',
    bucket: 'inventory-files',
    compress: true,
    maxWidthPx: 1200,
    onProgress,
  })

  if ('error' in upload) {
    throw new Error(upload.error)
  }

  return updateInventoryItem(itemId, { image_url: upload.url })
}

/** Update supplier delivery KPIs after a PO receive event. */
export async function recordSupplierDeliveryMetrics(poId: string): Promise<void> {
  if (!isSupabaseConfigured) return

  const po = await getPurchaseOrder(poId)
  if (!po?.supplier_id) return

  const supplier = await getSupplier(po.supplier_id)
  if (!supplier) return

  const todayKey = getTodayDateKey()
  let onTime = true
  if (po.expected_date) {
    onTime = todayKey <= po.expected_date
  }

  const prevOrders = supplier.total_orders ?? 0
  const prevOnTimePct = supplier.on_time_delivery ?? 100
  const newOrders = prevOrders + 1
  const newOnTimePct =
    prevOrders === 0
      ? onTime
        ? 100
        : 0
      : (prevOnTimePct * prevOrders + (onTime ? 100 : 0)) / newOrders

  const roundedOnTime = Math.round(newOnTimePct * 10) / 10

  await updateSupplier(po.supplier_id, {
    total_orders: newOrders,
    on_time_delivery: roundedOnTime,
    performance_score: Math.round(roundedOnTime),
  })
}

// ============================================
// INVENTORY MOVEMENTS API
// ============================================

export async function getInventoryMovements(itemId?: string): Promise<InventoryMovement[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  let query = supabase
    .from('inventory_movements')
    .select('*')
    .order('movement_date', { ascending: false })

  if (itemId) {
    query = query.eq('item_id', itemId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching inventory movements:', error)
    throw error
  }

  return data || []
}

export async function getRecentInventoryMovements(limit: number = 50): Promise<InventoryMovement[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .order('movement_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent inventory movements:', error)
    return []
  }

  return data || []
}

export async function createInventoryMovement(movement: Omit<InventoryMovement, 'id' | 'created_at'>): Promise<InventoryMovement | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const updated = await applyInventoryMovement({
    itemId: movement.item_id,
    quantityDelta: movement.change_qty,
    movementType: movement.change_qty >= 0 ? 'scan-in' : 'check-out',
    reason: movement.reason,
    reference: movement.reference,
    userName: movement.user_name,
    notes: movement.notes,
    poId: movement.po_id,
    poLineId: movement.po_line_id,
    jobId: movement.job_id,
    projectId: movement.project_id,
  })

  if (!updated) return null

  const { data } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('item_id', movement.item_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

// ============================================
// PURCHASE ORDERS API
// ============================================

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .order('created_date', { ascending: false })

  if (error) {
    console.error('Error fetching purchase orders:', error)
    throw error
  }

  return data || []
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data: poData, error: poError } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (poError) {
    console.error('Error fetching purchase order:', poError)
    return null
  }

  // Fetch line items
  const { data: lineItems, error: lineError } = await supabase
    .from('po_line_items')
    .select('*')
    .eq('po_id', id)

  if (lineError) {
    console.error('Error fetching PO line items:', lineError)
  }

  return {
    ...poData,
    line_items: lineItems || []
  }
}

export async function recalculatePurchaseOrderTotal(poId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0

  const lines = await getPOLineItems(poId)
  const total = lines.reduce((sum, li) => sum + (li.quantity * li.unit_cost), 0)
  await updatePurchaseOrder(poId, { total })
  return total
}

export async function createPurchaseOrder(po: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at' | 'line_items'>, lineItems?: Omit<POLineItem, 'id' | 'po_id' | 'total' | 'created_at' | 'updated_at'>[]): Promise<PurchaseOrder | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({ ...po, user_id: userId, organization_id: orgId })
    .select()
    .single()

  if (error) {
    console.error('Error creating purchase order:', error)
    throw error
  }

  // Insert line items if provided
  if (data && lineItems && lineItems.length > 0) {
    const lineItemsWithPoId = lineItems.map(item => ({
      ...item,
      po_id: data.id,
      total: item.quantity * item.unit_cost,
      user_id: userId,
      organization_id: orgId
    }))

    const { error: lineError } = await supabase
      .from('po_line_items')
      .insert(lineItemsWithPoId)

    if (lineError) {
      console.error('Error creating PO line items:', lineError)
    } else {
      await recalculatePurchaseOrderTotal(data.id)
    }
  }

  if (data) {
    const { notifyInventoryPurchaseOrder } = await import('@/lib/notification-modules')
    void notifyInventoryPurchaseOrder({ po: data, event: 'created' })
  }

  return data
}

export async function updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data: prior } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  // Remove computed fields and relations
  const { line_items, created_at, updated_at, ...updateData } = updates

  const { data, error } = await supabase
    .from('purchase_orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating purchase order:', error)
    throw error
  }

  if (data && updates.status && prior?.status && prior.status !== data.status) {
    const { notifyInventoryPurchaseOrder } = await import('@/lib/notification-modules')
    void notifyInventoryPurchaseOrder({
      po: data,
      previousStatus: prior.status as string,
      event: 'status_changed',
    })
  }

  return data
}

export async function deletePurchaseOrder(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting purchase order:', error)
    return false
  }

  return true
}

// ============================================
// PO LINE ITEMS API
// ============================================

export async function getPOLineItems(poId: string): Promise<POLineItem[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  const { data, error } = await supabase
    .from('po_line_items')
    .select('*')
    .eq('po_id', poId)

  if (error) {
    console.error('Error fetching PO line items:', error)
    throw error
  }

  return data || []
}

export async function createPOLineItem(lineItem: Omit<POLineItem, 'id' | 'total' | 'created_at' | 'updated_at'>): Promise<POLineItem | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('po_line_items')
    .insert({
      ...lineItem,
      total: lineItem.quantity * lineItem.unit_cost,
      user_id: userId,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating PO line item:', error)
    throw error
  }

  if (data) {
    await recalculatePurchaseOrderTotal(lineItem.po_id)
  }

  return data
}

export async function updatePOLineItem(id: string, updates: Partial<POLineItem>): Promise<POLineItem | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { total, created_at, updated_at, ...updateData } = updates

  const { data: prior } = await supabase
    .from('po_line_items')
    .select('quantity, unit_cost, po_id')
    .eq('id', id)
    .maybeSingle()

  const nextQty = updateData.quantity ?? prior?.quantity ?? 0
  const nextCost = updateData.unit_cost ?? prior?.unit_cost ?? 0
  const patch: Record<string, unknown> = { ...updateData }
  if (updateData.quantity != null || updateData.unit_cost != null) {
    patch.total = nextQty * nextCost
  }

  const { data, error } = await supabase
    .from('po_line_items')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating PO line item:', error)
    throw error
  }

  if (data) {
    await recalculatePurchaseOrderTotal(data.po_id)
  }

  return data
}

export async function deletePOLineItem(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  const { data: prior } = await supabase
    .from('po_line_items')
    .select('po_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('po_line_items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting PO line item:', error)
    return false
  }

  if (prior?.po_id) {
    await recalculatePurchaseOrderTotal(prior.po_id)
  }

  return true
}

// ============================================
// SUPPLIERS API
// ============================================

export async function getSuppliers(): Promise<Supplier[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Error fetching suppliers:', error)
    throw error
  }

  return data || []
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching supplier:', error)
    return null
  }

  return data
}

export async function createSupplier(supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>): Promise<Supplier | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...supplier, user_id: userId, organization_id: orgId })
    .select()
    .single()

  if (error) {
    console.error('Error creating supplier:', error)
    throw error
  }

  return data
}

export async function updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { created_at, updated_at, ...updateData } = updates

  const { data, error } = await supabase
    .from('suppliers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating supplier:', error)
    throw error
  }

  return data
}

export async function deleteSupplier(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  // Soft delete
  const { error } = await supabase
    .from('suppliers')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error deleting supplier:', error)
    return false
  }

  return true
}

// ============================================
// INVENTORY TRANSACTIONS API
// ============================================

export async function getInventoryTransactions(): Promise<InventoryTransaction[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .order('transaction_date', { ascending: false })

  if (error) {
    console.error('Error fetching inventory transactions:', error)
    throw error
  }

  const rows = data || []
  return rows.map((row) => ({
    ...(row as InventoryTransaction),
    location: row.location ?? null,
    quantity_delta:
      row.quantity_delta != null
        ? row.quantity_delta
        : row.type === 'scan-in'
          ? row.quantity
          : -row.quantity,
  }))
}

export async function getRecentInventoryTransactions(limit: number = 50): Promise<InventoryTransaction[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent inventory transactions:', error)
    return []
  }

  const rows = data || []
  return rows.map((row) => ({
    ...(row as InventoryTransaction),
    location: row.location ?? null,
    quantity_delta:
      row.quantity_delta != null
        ? row.quantity_delta
        : row.type === 'scan-in'
          ? row.quantity
          : -row.quantity,
  }))
}

export async function createInventoryTransaction(
  transaction: Omit<
    InventoryTransaction,
    'id' | 'created_at' | 'location' | 'quantity_delta' | 'po_id' | 'po_line_id' | 'job_id' | 'project_id'
  > & {
    po_id?: string | null
    po_line_id?: string | null
    job_id?: string | null
    project_id?: string | null
  },
): Promise<InventoryTransaction | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const qtyDelta =
    transaction.type === 'check-out' ? -transaction.quantity : transaction.quantity

  const movementType =
    transaction.type === 'po-receive'
      ? 'po-receive'
      : transaction.type === 'adjustment'
        ? 'adjustment'
        : transaction.type

  await applyInventoryMovement({
    itemId: transaction.item_id,
    quantityDelta: qtyDelta,
    movementType,
    reason: transaction.type === 'scan-in' ? 'Scan In' : transaction.type === 'po-receive' ? 'PO Receive' : 'Check Out',
    reference: transaction.reference,
    userName: transaction.user_name,
    notes: transaction.notes,
    poId: transaction.po_id,
    poLineId: transaction.po_line_id,
    jobId: transaction.job_id,
    projectId: transaction.project_id,
  })

  const { data } = await supabase
    .from('inventory_transactions')
    .select('*')
    .eq('item_id', transaction.item_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data as InventoryTransaction | null
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export async function generatePONumber(): Promise<string> {
  if (!isSupabaseConfigured) {
    const now = new Date()
    return `PO-${now.getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  }

  const { data, error } = await supabase.rpc('generate_po_number')

  if (error) {
    console.error('Error generating PO number:', error)
    // Fallback to local generation
    const now = new Date()
    return `PO-${now.getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  }

  return data
}

// Scan-in operation with inventory update
export async function performScanIn(
  itemId: string,
  quantity: number,
  options?: ScanInOptions | string,
  userNameLegacy?: string,
  notesLegacy?: string,
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  const opts: ScanInOptions =
    typeof options === 'string'
      ? { reference: options, userName: userNameLegacy, notes: notesLegacy }
      : (options ?? {})

  try {
    const item = await getInventoryItem(itemId)
    if (!item) {
      return { success: false, error: 'Item not found' }
    }

    const updated = await applyInventoryMovement({
      itemId,
      quantityDelta: quantity,
      movementType: opts.poLineId ? 'po-receive' : 'scan-in',
      reason: opts.reason ?? (opts.poLineId ? 'PO Receive' : 'Scan In'),
      reference: opts.reference ?? null,
      userName: opts.userName || 'System',
      notes: opts.notes ?? null,
      poId: opts.poId ?? null,
      poLineId: opts.poLineId ?? null,
    })

    return { success: true, item: (updated as InventoryItem) || undefined }
  } catch (error) {
    console.error('Error performing scan-in:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform scan-in',
    }
  }
}

export interface PerformCheckOutParams {
  itemId: string
  quantity: number
  options?: CheckOutOptions
}

// Check-out operation with inventory update
export async function performCheckOut(
  itemIdOrParams: string | PerformCheckOutParams,
  quantityLegacy?: number,
  referenceLegacy?: string,
  userNameLegacy?: string,
  notesLegacy?: string,
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  const params: PerformCheckOutParams =
    typeof itemIdOrParams === 'string'
      ? {
          itemId: itemIdOrParams,
          quantity: quantityLegacy ?? 0,
          options: {
            reference: referenceLegacy,
            userName: userNameLegacy,
            notes: notesLegacy,
          },
        }
      : itemIdOrParams

  const { itemId, quantity, options = {} } = params

  try {
    const item = await getInventoryItem(itemId)
    if (!item) {
      return { success: false, error: 'Item not found' }
    }

    if (item.on_hand_qty - item.allocated < quantity) {
      return { success: false, error: 'Insufficient available quantity' }
    }

    let reference = options.reference ?? null
    if (options.jobId && options.jobLabel) {
      reference = `Job: ${options.jobLabel}`
    } else if (options.projectId && options.projectLabel) {
      reference = `Project: ${options.projectLabel}`
    }

    const updated = await applyInventoryMovement({
      itemId,
      quantityDelta: -quantity,
      movementType: 'check-out',
      reason: options.reason ?? 'Check Out',
      reference,
      userName: options.userName || 'System',
      notes: options.notes ?? null,
      jobId: options.jobId ?? null,
      projectId: options.projectId ?? null,
    })

    const updatedItem = (updated as InventoryItem) || (await getInventoryItem(itemId))
    if (updatedItem) {
      const { notifyInventoryCheckOut } = await import('@/lib/notification-modules')
      void notifyInventoryCheckOut({
        item: updatedItem,
        quantity,
        userName: options.userName,
      })
    }
    return { success: true, item: updatedItem || undefined }
  } catch (error) {
    console.error('Error performing check-out:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform check-out',
    }
  }
}

export async function performAdjustment(
  itemId: string,
  quantityDelta: number,
  options?: AdjustmentOptions,
): Promise<{ success: boolean; item?: InventoryItem; error?: string }> {
  if (quantityDelta === 0) {
    return { success: false, error: 'Adjustment quantity cannot be zero' }
  }

  try {
    const item = await getInventoryItem(itemId)
    if (!item) {
      return { success: false, error: 'Item not found' }
    }

    if (quantityDelta < 0 && getAvailableQty(item) + quantityDelta < 0) {
      return { success: false, error: 'Insufficient available quantity' }
    }

    const updated = await applyInventoryMovement({
      itemId,
      quantityDelta,
      movementType: 'adjustment',
      reason: options?.reason ?? 'Inventory Adjustment',
      reference: options?.reference ?? null,
      userName: options?.userName || 'System',
      notes: options?.notes ?? null,
    })

    return { success: true, item: (updated as InventoryItem) || undefined }
  } catch (error) {
    console.error('Error performing adjustment:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform adjustment',
    }
  }
}

// Get inventory statistics
export async function getInventoryStats(): Promise<{
  totalItems: number
  lowStockItems: number
  outOfStockItems: number
  totalValue: number
}> {
  if (!isSupabaseConfigured) {
    return { totalItems: 0, lowStockItems: 0, outOfStockItems: 0, totalValue: 0 }
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .select('status, total_value')
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching inventory stats:', error)
    return { totalItems: 0, lowStockItems: 0, outOfStockItems: 0, totalValue: 0 }
  }

  const items = data || []
  return {
    totalItems: items.length,
    lowStockItems: items.filter(i => i.status === 'low-stock').length,
    outOfStockItems: items.filter(i => i.status === 'out-of-stock').length,
    totalValue: items.reduce((sum, i) => sum + (i.total_value || 0), 0)
  }
}

// Get open purchase orders count
export async function getOpenPOCount(): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0
  }

  const { count, error } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .in('status', ['open', 'pending'])

  if (error) {
    console.error('Error fetching open PO count:', error)
    return 0
  }

  return count || 0
}

// ============================================
// ALLOCATIONS
// ============================================

export async function getItemAllocations(itemId: string): Promise<InventoryAllocation[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('inventory_allocations')
    .select('*')
    .eq('item_id', itemId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching allocations:', error)
    return []
  }

  return (data ?? []) as InventoryAllocation[]
}

export async function createInventoryAllocation(input: {
  itemId: string
  quantity: number
  referenceType: 'job' | 'project' | 'manual'
  referenceId?: string | null
  referenceLabel?: string | null
}): Promise<InventoryAllocation | null> {
  if (!isSupabaseConfigured) return null

  const item = await getInventoryItem(input.itemId)
  if (!item) throw new Error('Item not found')
  if (item.on_hand_qty - item.allocated < input.quantity) {
    throw new Error('Insufficient available quantity to allocate')
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('inventory_allocations')
    .insert({
      item_id: input.itemId,
      quantity: input.quantity,
      reference_type: input.referenceType,
      reference_id: input.referenceId ?? null,
      reference_label: input.referenceLabel ?? null,
      status: 'active',
      user_id: userId,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) throw error
  return data as InventoryAllocation
}

export async function cancelInventoryAllocation(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false

  const { error } = await supabase
    .from('inventory_allocations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)

  return !error
}

export async function getOpenPurchaseOrdersWithLines(): Promise<PurchaseOrder[]> {
  const orders = await getPurchaseOrders()
  const open = orders.filter((po) => po.status === 'open' || po.status === 'pending')
  return Promise.all(open.map((po) => getPurchaseOrder(po.id).then((p) => p ?? po)))
}

// ============================================
// BULK IMPORT
// ============================================

export async function bulkImportInventoryItems(
  rows: Array<{
    sku: string
    product_name: string
    location: string
    on_hand_qty: number
    min_qty: number
    reorder_qty: number
    unit_cost: number
    supplier_name: string
    category: string
    barcode: string
    description: string
  }>,
): Promise<{ created: number; updated: number; errors: string[] }> {
  let created = 0
  let updated = 0
  const errors: string[] = []
  const suppliers = await getSuppliers()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      const existing = await getInventoryItemBySku(row.sku)
      const status = computeInventoryStatus(row.on_hand_qty, row.min_qty)
      const supplierLink = resolveSupplierLink(row.supplier_name, suppliers)

      if (existing) {
        const qtyDelta = row.on_hand_qty - existing.on_hand_qty
        const nonQtyUpdates = {
          product_name: row.product_name,
          location: row.location || existing.location,
          min_qty: row.min_qty,
          reorder_qty: row.reorder_qty || row.min_qty * 2,
          unit_cost: row.unit_cost,
          supplier_id: supplierLink.supplier_id,
          supplier_name: supplierLink.supplier_name,
          category: row.category || null,
          barcode: row.barcode || null,
          description: row.description || null,
          status,
        }

        if (qtyDelta !== 0) {
          await applyInventoryMovement({
            itemId: existing.id,
            quantityDelta: qtyDelta,
            movementType: 'adjustment',
            reason: 'CSV Import',
            reference: `SKU ${row.sku}`,
            userName: 'CSV Import',
            notes: `Bulk import adjusted qty from ${existing.on_hand_qty} to ${row.on_hand_qty}`,
          })
          await updateInventoryItem(existing.id, nonQtyUpdates)
        } else {
          await updateInventoryItem(existing.id, {
            ...nonQtyUpdates,
            on_hand_qty: row.on_hand_qty,
          })
        }
        updated++
      } else {
        const userId = await getCurrentUserId()
        const orgId = await getOrganizationId()
        const { data: inserted, error } = await supabase.from('inventory_items').insert({
          sku: row.sku,
          product_name: row.product_name,
          location: row.location || 'Main',
          on_hand_qty: 0,
          min_qty: row.min_qty,
          reorder_qty: row.reorder_qty || row.min_qty * 2,
          unit_cost: row.unit_cost,
          allocated: 0,
          supplier_id: supplierLink.supplier_id,
          supplier_name: supplierLink.supplier_name,
          status: computeInventoryStatus(0, row.min_qty),
          barcode: row.barcode || null,
          image_url: null,
          category: row.category || null,
          description: row.description || null,
          last_movement_at: null,
          is_active: true,
          user_id: userId,
          organization_id: orgId,
        }).select().single()
        if (error) throw error
        if (inserted && row.on_hand_qty > 0) {
          await applyInventoryMovement({
            itemId: inserted.id,
            quantityDelta: row.on_hand_qty,
            movementType: 'adjustment',
            reason: 'CSV Import',
            reference: `SKU ${row.sku}`,
            userName: 'CSV Import',
            notes: 'Initial stock from bulk import',
          })
          if (row.on_hand_qty > 0) {
            await updateInventoryItem(inserted.id, { status })
          }
        }
        created++
      }
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { created, updated, errors }
}







