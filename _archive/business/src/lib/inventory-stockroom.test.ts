import { describe, it, expect } from 'vitest'
import { parseInventoryLocation, buildStockroomLayout, qtyToStackHeight } from './inventory-stockroom'
import type { InventoryItem } from './inventory-api'

function item(overrides: Partial<InventoryItem> & { location?: string | null }): InventoryItem {
  return {
    id: overrides.id ?? '1',
    sku: overrides.sku ?? 'SKU-1',
    product_name: overrides.product_name ?? 'Widget',
    location: overrides.location ?? 'A1-B2',
    on_hand_qty: overrides.on_hand_qty ?? 10,
    min_qty: 5,
    reorder_qty: 20,
    unit_cost: 1,
    total_value: 10,
    allocated: 0,
    supplier_id: null,
    supplier_name: null,
    status: overrides.status ?? 'in-stock',
    barcode: null,
    image_url: null,
    category: null,
    description: null,
    last_movement_at: null,
    is_active: overrides.is_active ?? true,
    created_at: '',
    updated_at: '',
  }
}

describe('parseInventoryLocation', () => {
  it('parses aisle-shelf-bin format', () => {
    expect(parseInventoryLocation('A1-B2-C3')).toEqual({
      zone: 'A1',
      shelf: 'B2',
      bin: 'C3',
      display: 'A1-B2-C3',
    })
  })

  it('groups unassigned items into receiving dock', () => {
    expect(parseInventoryLocation(null).zone).toBe('Receiving Dock')
    expect(parseInventoryLocation('').zone).toBe('Receiving Dock')
  })
})

describe('qtyToStackHeight', () => {
  it('maps quantity tiers to visual stack layers', () => {
    expect(qtyToStackHeight(0)).toBe(1)
    expect(qtyToStackHeight(3)).toBe(2)
    expect(qtyToStackHeight(25)).toBe(4)
    expect(qtyToStackHeight(100)).toBe(5)
  })
})

describe('buildStockroomLayout', () => {
  it('groups items by location into zones', () => {
    const { zones, stats } = buildStockroomLayout([
      item({ id: '1', location: 'A1-B1', sku: 'A' }),
      item({ id: '2', location: 'A1-B2', sku: 'B' }),
      item({ id: '3', location: 'Z9', sku: 'C' }),
    ])
    expect(stats.totalSkus).toBe(3)
    expect(stats.totalBins).toBe(3)
    expect(zones.length).toBeGreaterThanOrEqual(2)
  })
})
