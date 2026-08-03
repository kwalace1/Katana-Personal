import { describe, it, expect } from 'vitest'
import { getLowStockItems, groupReorderSuggestions } from './inventory-reorder'
import type { InventoryItem } from './inventory-api'

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1',
    sku: 'SKU-1',
    product_name: 'Widget',
    location: 'Main',
    on_hand_qty: 5,
    min_qty: 10,
    reorder_qty: 20,
    unit_cost: 4,
    total_value: 20,
    allocated: 0,
    supplier_id: 'sup-1',
    supplier_name: 'Acme Supply',
    status: 'low-stock',
    barcode: null,
    image_url: null,
    category: null,
    description: null,
    last_movement_at: null,
    is_active: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('getLowStockItems', () => {
  it('includes low-stock and out-of-stock active items', () => {
    const items = [
      makeItem({ id: 'a', status: 'low-stock' }),
      makeItem({ id: 'b', status: 'in-stock', on_hand_qty: 50, min_qty: 10 }),
      makeItem({ id: 'c', status: 'out-of-stock', on_hand_qty: 0 }),
      makeItem({ id: 'd', is_active: false, status: 'low-stock' }),
    ]
    const low = getLowStockItems(items)
    expect(low.map((i) => i.id)).toEqual(['a', 'c'])
  })
})

describe('groupReorderSuggestions', () => {
  it('groups by supplier and sums suggested totals', () => {
    const items = [
      makeItem({ id: 'a', supplier_id: 'sup-1', supplier_name: 'Acme', reorder_qty: 10, unit_cost: 5 }),
      makeItem({ id: 'b', supplier_id: 'sup-1', supplier_name: 'Acme', reorder_qty: 5, unit_cost: 2 }),
      makeItem({ id: 'c', supplier_id: 'sup-2', supplier_name: 'Beta Co', reorder_qty: 3, unit_cost: 10 }),
    ]
    const groups = groupReorderSuggestions(items)
    expect(groups).toHaveLength(2)
    const acme = groups.find((g) => g.supplierName === 'Acme')
    expect(acme?.supplierId).toBe('sup-1')
    expect(acme?.items).toHaveLength(2)
    expect(acme?.suggestedTotal).toBe(10 * 5 + 5 * 2)
  })

  it('uses Unassigned supplier bucket when supplier name is missing', () => {
    const groups = groupReorderSuggestions([
      makeItem({ supplier_id: null, supplier_name: null }),
    ])
    expect(groups[0]?.supplierName).toBe('Unassigned supplier')
  })
})
