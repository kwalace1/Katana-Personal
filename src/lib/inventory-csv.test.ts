import { describe, it, expect } from 'vitest'
import { inventoryItemsToCsv, parseInventoryCsv } from './inventory-csv'
import type { InventoryItem } from './inventory-api'

const sampleItem: InventoryItem = {
  id: '1',
  sku: 'ABC-1',
  product_name: 'Bolt, 1/4"',
  location: 'Shelf A',
  on_hand_qty: 100,
  min_qty: 20,
  reorder_qty: 50,
  unit_cost: 0.25,
  total_value: 25,
  allocated: 0,
  supplier_id: null,
  supplier_name: 'Fasteners Inc',
  status: 'in-stock',
  barcode: '123456',
  image_url: null,
  category: 'Hardware',
  description: 'Stainless',
  last_movement_at: null,
  is_active: true,
  created_at: '',
  updated_at: '',
}

describe('inventoryItemsToCsv', () => {
  it('exports header and row with escaped commas', () => {
    const csv = inventoryItemsToCsv([sampleItem])
    expect(csv.split('\n')[0]).toContain('sku,product_name')
    expect(csv).toContain('ABC-1')
    expect(csv).toContain('Bolt, 1/4"')
  })
})

describe('parseInventoryCsv', () => {
  it('parses valid rows with alternate column names', () => {
    const text = `sku,name,qty,min,cost,supplier\nABC-2,Widget,10,2,5.5,Acme`
    const { rows, errors } = parseInventoryCsv(text)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      sku: 'ABC-2',
      product_name: 'Widget',
      on_hand_qty: 10,
      min_qty: 2,
      unit_cost: 5.5,
      supplier_name: 'Acme',
    })
  })

  it('returns error when required columns missing', () => {
    const { rows, errors } = parseInventoryCsv('name,location\nWidget,Main')
    expect(rows).toHaveLength(0)
    expect(errors[0]).toMatch(/sku/)
  })

  it('handles quoted fields with commas', () => {
    const text = 'sku,product_name,on_hand_qty,min_qty\nX1,"Part, special",5,1'
    const { rows } = parseInventoryCsv(text)
    expect(rows[0]?.product_name).toBe('Part, special')
  })
})
