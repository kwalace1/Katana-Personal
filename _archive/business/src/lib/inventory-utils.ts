import type { InventoryItem, POLineItem, PurchaseOrder, Supplier } from './inventory-api'

export function getAvailableQty(item: Pick<InventoryItem, 'on_hand_qty' | 'allocated'>): number {
  return Math.max(0, (item.on_hand_qty ?? 0) - (item.allocated ?? 0))
}

export interface OpenPoLineMatch {
  poId: string
  poNumber: string
  lineId: string
  remainingQty: number
  line: POLineItem
}

export function findOpenPoLinesForItem(
  orders: PurchaseOrder[],
  item: InventoryItem,
): OpenPoLineMatch[] {
  const matches: OpenPoLineMatch[] = []
  for (const po of orders) {
    if (po.status !== 'open' && po.status !== 'pending') continue
    for (const line of po.line_items ?? []) {
      const remaining = line.quantity - (line.received_qty ?? 0)
      if (remaining <= 0) continue
      const skuMatch = line.sku.toLowerCase() === item.sku.toLowerCase()
      const itemMatch = line.item_id === item.id
      if (skuMatch || itemMatch) {
        matches.push({
          poId: po.id,
          poNumber: po.po_number,
          lineId: line.id,
          remainingQty: remaining,
          line,
        })
      }
    }
  }
  return matches
}

export function resolveSupplierLink(
  supplierName: string | null | undefined,
  suppliers: Supplier[],
): { supplier_id: string | null; supplier_name: string | null } {
  const name = supplierName?.trim()
  if (!name) return { supplier_id: null, supplier_name: null }
  const match = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase())
  return { supplier_id: match?.id ?? null, supplier_name: name }
}

export type TransactionDisplayType = 'scan-in' | 'check-out' | 'adjustment' | 'po-receive'

export function getTransactionTypeMeta(
  type: TransactionDisplayType,
  quantityDelta?: number,
): {
  label: string
  isInbound: boolean
  badgeClass: string
} {
  switch (type) {
    case 'po-receive':
      return {
        label: 'PO Receive',
        isInbound: true,
        badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      }
    case 'adjustment': {
      const inbound = (quantityDelta ?? 0) >= 0
      return {
        label: 'Adjustment',
        isInbound: inbound,
        badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      }
    }
    case 'scan-in':
      return {
        label: 'Scan-In',
        isInbound: true,
        badgeClass: 'bg-green-500/10 text-green-600 border-green-500/20',
      }
    default:
      return {
        label: 'Check-Out',
        isInbound: false,
        badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      }
  }
}
