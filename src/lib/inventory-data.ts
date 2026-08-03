// ============================================
// INVENTORY DATA TYPES
// ============================================
// These types are kept for backward compatibility with existing components
// All actual data operations should use inventory-api.ts

export interface InventoryItem {
  id: string
  sku: string
  productName: string
  location: string
  onHandQty: number
  minQty: number
  reorderQty: number
  unitCost: number
  totalValue: number
  allocated: number
  supplier: string
  status: "in-stock" | "low-stock" | "out-of-stock"
  barcode?: string
  image?: string
  category?: string
  lastMovement?: Date
}

export interface InventoryMovement {
  id: string
  itemId: string
  date: Date
  reason: string
  change: number
  reference: string
  user: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  supplier: string
  status: "draft" | "open" | "pending" | "received" | "cancelled"
  total: number
  createdDate: Date
  expectedDate?: Date
  lineItems: POLineItem[]
  attachments?: string[]
}

export interface POLineItem {
  id: string
  itemId: string
  sku: string
  productName: string
  quantity: number
  receivedQty: number
  unitCost: number
  total: number
}

export interface Supplier {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  performanceScore: number
  leadTime: number
  totalOrders: number
  onTimeDelivery: number
}

export interface Transaction {
  id: string
  type: "scan-in" | "check-out" | "adjustment" | "po-receive"
  itemId: string
  sku: string
  productName: string
  quantity: number
  date: Date
  user: string
  reference?: string
  notes?: string
}

// ============================================
// TYPE CONVERTERS
// ============================================
// Helper functions to convert between API types and legacy component types

import type { 
  InventoryItem as ApiInventoryItem,
  InventoryMovement as ApiInventoryMovement,
  PurchaseOrder as ApiPurchaseOrder,
  POLineItem as ApiPOLineItem,
  Supplier as ApiSupplier,
  InventoryTransaction as ApiTransaction
} from './inventory-api'

export function convertApiItemToLegacy(apiItem: ApiInventoryItem): InventoryItem {
  return {
    id: apiItem.id,
    sku: apiItem.sku,
    productName: apiItem.product_name,
    location: apiItem.location || '',
    onHandQty: apiItem.on_hand_qty,
    minQty: apiItem.min_qty,
    reorderQty: apiItem.reorder_qty,
    unitCost: apiItem.unit_cost,
    totalValue: apiItem.total_value,
    allocated: apiItem.allocated,
    supplier: apiItem.supplier_name || '',
    status: apiItem.status,
    barcode: apiItem.barcode || undefined,
    image: apiItem.image_url || undefined,
    category: apiItem.category || undefined,
    lastMovement: apiItem.last_movement_at ? new Date(apiItem.last_movement_at) : undefined,
  }
}

export function convertLegacyItemToApi(item: Partial<InventoryItem>): Partial<ApiInventoryItem> {
  return {
    sku: item.sku,
    product_name: item.productName,
    location: item.location,
    on_hand_qty: item.onHandQty,
    min_qty: item.minQty,
    reorder_qty: item.reorderQty,
    unit_cost: item.unitCost,
    allocated: item.allocated,
    supplier_name: item.supplier,
    status: item.status,
    barcode: item.barcode || null,
    image_url: item.image || null,
    category: item.category || null,
  }
}

export function convertApiMovementToLegacy(apiMovement: ApiInventoryMovement): InventoryMovement {
  return {
    id: apiMovement.id,
    itemId: apiMovement.item_id,
    date: new Date(apiMovement.movement_date),
    reason: apiMovement.reason,
    change: apiMovement.change_qty,
    reference: apiMovement.reference || '',
    user: apiMovement.user_name || '',
  }
}

export function convertApiPOToLegacy(apiPO: ApiPurchaseOrder): PurchaseOrder {
  return {
    id: apiPO.id,
    poNumber: apiPO.po_number,
    supplier: apiPO.supplier_name,
    status: apiPO.status,
    total: apiPO.total,
    createdDate: new Date(apiPO.created_date),
    expectedDate: apiPO.expected_date ? new Date(apiPO.expected_date) : undefined,
    lineItems: (apiPO.line_items || []).map(convertApiPOLineItemToLegacy),
  }
}

export function convertApiPOLineItemToLegacy(apiLineItem: ApiPOLineItem): POLineItem {
  return {
    id: apiLineItem.id,
    itemId: apiLineItem.item_id || '',
    sku: apiLineItem.sku,
    productName: apiLineItem.product_name,
    quantity: apiLineItem.quantity,
    receivedQty: apiLineItem.received_qty,
    unitCost: apiLineItem.unit_cost,
    total: apiLineItem.total,
  }
}

export function convertApiSupplierToLegacy(apiSupplier: ApiSupplier): Supplier {
  return {
    id: apiSupplier.id,
    name: apiSupplier.name,
    contactName: apiSupplier.contact_name || '',
    email: apiSupplier.email || '',
    phone: apiSupplier.phone || '',
    address: apiSupplier.address || '',
    performanceScore: apiSupplier.performance_score,
    leadTime: apiSupplier.lead_time,
    totalOrders: apiSupplier.total_orders,
    onTimeDelivery: apiSupplier.on_time_delivery,
  }
}

export function convertApiTransactionToLegacy(apiTransaction: ApiTransaction): Transaction {
  return {
    id: apiTransaction.id,
    type: apiTransaction.type,
    itemId: apiTransaction.item_id,
    sku: apiTransaction.sku,
    productName: apiTransaction.product_name,
    quantity: apiTransaction.quantity,
    date: new Date(apiTransaction.transaction_date),
    user: apiTransaction.user_name || '',
    reference: apiTransaction.reference || undefined,
    notes: apiTransaction.notes || undefined,
  }
}

// ============================================
// EMPTY ARRAYS (for backward compatibility when Supabase is not configured)
// ============================================
export const inventoryItems: InventoryItem[] = []
export const inventoryMovements: InventoryMovement[] = []
export const purchaseOrders: PurchaseOrder[] = []
export const suppliers: Supplier[] = []
export const transactions: Transaction[] = []
