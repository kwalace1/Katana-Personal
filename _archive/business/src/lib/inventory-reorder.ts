import type { InventoryItem, PurchaseOrder } from './inventory-api'
import {
  createPurchaseOrder,
  createPOLineItem,
  generatePONumber,
  getInventoryItems,
  updatePurchaseOrder,
} from './inventory-api'
import { getTodayDateKey } from './due-date-utils'

export interface ReorderSuggestion {
  supplierName: string
  supplierId: string | null
  items: InventoryItem[]
  suggestedTotal: number
}

export function getLowStockItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter(
    (item) =>
      item.is_active &&
      (item.status === 'low-stock' ||
        item.status === 'out-of-stock' ||
        (item.min_qty > 0 && item.on_hand_qty <= item.min_qty)),
  )
}

export function groupReorderSuggestions(items: InventoryItem[]): ReorderSuggestion[] {
  const low = getLowStockItems(items)
  const bySupplier = new Map<string, ReorderSuggestion>()

  for (const item of low) {
    const key = (item.supplier_name?.trim() || 'Unassigned supplier').toLowerCase()
    const label = item.supplier_name?.trim() || 'Unassigned supplier'
    if (!bySupplier.has(key)) {
      bySupplier.set(key, {
        supplierName: label,
        supplierId: item.supplier_id,
        items: [],
        suggestedTotal: 0,
      })
    }
    const group = bySupplier.get(key)!
    group.items.push(item)
    const orderQty = Math.max(item.reorder_qty || item.min_qty * 2 || 1, 1)
    group.suggestedTotal += orderQty * (item.unit_cost || 0)
  }

  return Array.from(bySupplier.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName))
}

export async function createDraftPoFromSuggestion(
  suggestion: ReorderSuggestion,
): Promise<PurchaseOrder | null> {
  const poNumber = await generatePONumber()
  const po = await createPurchaseOrder({
    po_number: poNumber,
    supplier_id: suggestion.supplierId,
    supplier_name: suggestion.supplierName,
    status: 'draft',
    total: suggestion.suggestedTotal,
    notes: 'Auto-generated from low-stock reorder suggestions',
    created_date: getTodayDateKey(),
    expected_date: null,
    received_date: null,
    created_by: null,
  })

  if (!po) return null

  let total = 0
  for (const item of suggestion.items) {
    const qty = Math.max(item.reorder_qty || item.min_qty * 2 || 1, 1)
    const lineTotal = qty * (item.unit_cost || 0)
    total += lineTotal
    await createPOLineItem({
      po_id: po.id,
      item_id: item.id,
      sku: item.sku,
      product_name: item.product_name,
      quantity: qty,
      received_qty: 0,
      unit_cost: item.unit_cost || 0,
    })
  }

  return updatePurchaseOrder(po.id, { total })
}

export async function fetchLowStockForReorder(): Promise<InventoryItem[]> {
  const items = await getInventoryItems()
  return getLowStockItems(items)
}
