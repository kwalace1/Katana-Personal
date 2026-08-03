import { describe, it, expect } from 'vitest'
import { computeInventoryStatus } from './inventory-movements'
import {
  getAvailableQty,
  findOpenPoLinesForItem,
  resolveSupplierLink,
  getTransactionTypeMeta,
} from './inventory-utils'
import type { InventoryItem, PurchaseOrder } from './inventory-api'

describe('computeInventoryStatus', () => {
  it('returns out-of-stock at zero', () => {
    expect(computeInventoryStatus(0, 5)).toBe('out-of-stock')
  })

  it('returns low-stock at or below min', () => {
    expect(computeInventoryStatus(5, 5)).toBe('low-stock')
    expect(computeInventoryStatus(3, 5)).toBe('low-stock')
  })

  it('returns in-stock above min', () => {
    expect(computeInventoryStatus(6, 5)).toBe('in-stock')
  })
})

describe('getAvailableQty', () => {
  it('subtracts allocated from on hand', () => {
    expect(getAvailableQty({ on_hand_qty: 10, allocated: 3 })).toBe(7)
    expect(getAvailableQty({ on_hand_qty: 2, allocated: 5 })).toBe(0)
  })
})

describe('findOpenPoLinesForItem', () => {
  const item = {
    id: 'item-1',
    sku: 'SKU-A',
  } as InventoryItem

  const orders: PurchaseOrder[] = [
    {
      id: 'po-1',
      po_number: 'PO-100',
      status: 'open',
      line_items: [
        {
          id: 'line-1',
          po_id: 'po-1',
          item_id: 'item-1',
          sku: 'SKU-A',
          product_name: 'A',
          quantity: 10,
          received_qty: 4,
          unit_cost: 1,
          total: 10,
          created_at: '',
          updated_at: '',
        },
      ],
    } as PurchaseOrder,
    {
      id: 'po-2',
      po_number: 'PO-200',
      status: 'received',
      line_items: [
        {
          id: 'line-2',
          po_id: 'po-2',
          item_id: 'item-1',
          sku: 'SKU-A',
          product_name: 'A',
          quantity: 5,
          received_qty: 0,
          unit_cost: 1,
          total: 5,
          created_at: '',
          updated_at: '',
        },
      ],
    } as PurchaseOrder,
  ]

  it('finds remaining qty on open/pending PO lines by item or sku', () => {
    const matches = findOpenPoLinesForItem(orders, item)
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      poNumber: 'PO-100',
      lineId: 'line-1',
      remainingQty: 6,
    })
  })
})

describe('resolveSupplierLink', () => {
  const suppliers = [
    { id: 's1', name: 'Acme Corp' },
    { id: 's2', name: 'Beta LLC' },
  ] as Parameters<typeof resolveSupplierLink>[1]

  it('matches supplier id case-insensitively by name', () => {
    expect(resolveSupplierLink('acme corp', suppliers)).toEqual({
      supplier_id: 's1',
      supplier_name: 'acme corp',
    })
  })

  it('returns null id when no match', () => {
    expect(resolveSupplierLink('Unknown', suppliers)).toEqual({
      supplier_id: null,
      supplier_name: 'Unknown',
    })
  })
})

describe('getTransactionTypeMeta', () => {
  it('labels po-receive and adjustment with correct direction', () => {
    expect(getTransactionTypeMeta('po-receive').label).toBe('PO Receive')
    expect(getTransactionTypeMeta('adjustment', -3).isInbound).toBe(false)
    expect(getTransactionTypeMeta('adjustment', 2).isInbound).toBe(true)
  })
})
