import { describe, it, expect } from 'vitest'
import { addWidgetToLayout, removeWidgetFromLayout } from '@/lib/module-widget-layout'
import {
  DEFAULT_INVENTORY_CATALOG_WIDGETS,
  DEFAULT_INVENTORY_ITEM_DETAIL_WIDGETS,
  INVENTORY_CATALOG_WIDGET_CATALOG,
  INVENTORY_ITEM_DETAIL_WIDGET_CATALOG,
  normalizeInventoryCatalogWidgetLayout,
  normalizeInventoryItemDetailWidgetLayout,
} from './inventory-widget-layout'

describe('inventory-widget-layout', () => {
  it('normalizes default catalog widget order', () => {
    const layout = normalizeInventoryCatalogWidgetLayout(null)
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(
      DEFAULT_INVENTORY_CATALOG_WIDGETS.map((w) => w.i)
    )
  })

  it('normalizes default item_detail widget ids', () => {
    const layout = normalizeInventoryItemDetailWidgetLayout(null)
    expect(layout.version).toBe(2)
    expect(layout.widgets.map((w) => w.i)).toEqual(
      DEFAULT_INVENTORY_ITEM_DETAIL_WIDGETS.map((w) => w.i)
    )
  })

  it('drops unknown widget ids from catalog layout', () => {
    const layout = normalizeInventoryCatalogWidgetLayout({
      version: 2,
      widgets: [
        { i: 'stats', x: 0, y: 0, w: 12, h: 3 },
        { i: 'not_real', x: 0, y: 3, w: 6, h: 4 },
      ],
      extras: {},
    })
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'stats')).toBe(true)
  })

  it('drops unknown widget ids from item_detail layout', () => {
    const layout = normalizeInventoryItemDetailWidgetLayout({
      version: 2,
      widgets: [
        { i: 'item_info', x: 0, y: 0, w: 8, h: 5 },
        { i: 'not_real', x: 0, y: 5, w: 6, h: 4 },
      ],
      extras: {},
    })
    expect(layout.widgets.every((w) => w.i !== 'not_real')).toBe(true)
    expect(layout.widgets.some((w) => w.i === 'item_info')).toBe(true)
  })

  it('adds and removes a widget from the catalog layout', () => {
    let layout = normalizeInventoryCatalogWidgetLayout(null)
    const metric = INVENTORY_CATALOG_WIDGET_CATALOG.find((e) => e.id === 'metric_total_items')!
    expect(layout.widgets.some((w) => w.i === 'metric_total_items')).toBe(false)

    layout = addWidgetToLayout(layout, metric) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'metric_total_items')).toBe(true)

    layout = removeWidgetFromLayout(layout, 'metric_total_items') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'metric_total_items')).toBe(false)
  })

  it('adds and removes a widget from the item_detail layout', () => {
    let layout = normalizeInventoryItemDetailWidgetLayout(null)
    const lastMovement = INVENTORY_ITEM_DETAIL_WIDGET_CATALOG.find((e) => e.id === 'last_movement')!
    layout = removeWidgetFromLayout(layout, 'last_movement') as typeof layout
    expect(layout.widgets.some((w) => w.i === 'last_movement')).toBe(false)

    layout = addWidgetToLayout(layout, lastMovement) as typeof layout
    expect(layout.widgets.some((w) => w.i === 'last_movement')).toBe(true)
  })
})
