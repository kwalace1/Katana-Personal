/**
 * Inventory freeform (v2) widget catalog + defaults.
 * Surfaces: catalog (hub) + item_detail.
 */

import {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  normalizeModuleWidgetLayout,
  removeWidgetFromLayout,
  type ModuleWidgetItem,
  type ModuleWidgetLayout,
  type WidgetCatalogEntry,
} from '@/lib/module-widget-layout'

export const INVENTORY_MODULE_ID = 'inventory'
export const INVENTORY_CATALOG_SURFACE = 'catalog'
export const INVENTORY_ITEM_DETAIL_SURFACE = 'item_detail'

// --- Catalog (hub) ---

export const INVENTORY_CATALOG_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: 'stats',
    label: 'Stats',
    description: 'Total items, low stock, open POs, and inventory value',
    defaultW: 12,
    defaultH: 3,
    minW: 4,
    minH: 2,
  },
  {
    id: 'reorder_suggestions',
    label: 'Reorder suggestions',
    description: 'Low-stock items ready for draft purchase orders',
    defaultW: 12,
    defaultH: 5,
    minW: 4,
    minH: 3,
  },
  {
    id: 'stockroom_teaser',
    label: 'Stockroom',
    description: 'Shortcut into the virtual warehouse floor',
    defaultW: 12,
    defaultH: 3,
    minW: 4,
    minH: 2,
  },
  {
    id: 'quick_actions',
    label: 'Quick actions',
    description: 'POs, scan-in, check-out, suppliers, transactions, stockroom',
    defaultW: 12,
    defaultH: 5,
    minW: 6,
    minH: 3,
  },
  {
    id: 'items_catalog',
    label: 'Items catalog',
    description: 'Searchable inventory table with archive tools',
    defaultW: 12,
    defaultH: 16,
    minW: 6,
    minH: 8,
  },
  {
    id: 'metric_total_items',
    label: 'Total items',
    description: 'Single metric: total SKUs',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
  },
  {
    id: 'metric_low_stock',
    label: 'Low stock',
    description: 'Single metric: low-stock SKUs',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
  },
  {
    id: 'metric_open_pos',
    label: 'Open POs',
    description: 'Single metric: open purchase orders',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
  },
  {
    id: 'metric_total_value',
    label: 'Total value',
    description: 'Single metric: on-hand inventory value',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
  },
]

export const DEFAULT_INVENTORY_CATALOG_WIDGETS: ModuleWidgetItem[] = [
  { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 2 },
  { i: 'reorder_suggestions', x: 0, y: 3, w: 12, h: 5, minW: 4, minH: 3 },
  { i: 'stockroom_teaser', x: 0, y: 8, w: 12, h: 3, minW: 4, minH: 2 },
  { i: 'quick_actions', x: 0, y: 11, w: 12, h: 5, minW: 6, minH: 3 },
  { i: 'items_catalog', x: 0, y: 16, w: 12, h: 16, minW: 6, minH: 8 },
]

export type InventoryCatalogWidgetLayout = ModuleWidgetLayout

export function normalizeInventoryCatalogWidgetLayout(raw: unknown): InventoryCatalogWidgetLayout {
  return normalizeModuleWidgetLayout(
    raw,
    INVENTORY_CATALOG_WIDGET_CATALOG,
    DEFAULT_INVENTORY_CATALOG_WIDGETS,
    {}
  )
}

export function inventoryCatalogWidgetLayoutToBase(
  layout: InventoryCatalogWidgetLayout
): ModuleWidgetLayout {
  return {
    version: 2,
    widgets: layout.widgets,
    extras: layout.extras ?? {},
  }
}

// --- Item detail ---

export const INVENTORY_ITEM_DETAIL_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: 'stats',
    label: 'Key metrics',
    description: 'On hand, min qty, unit cost, and location',
    defaultW: 8,
    defaultH: 3,
    minW: 4,
    minH: 2,
  },
  {
    id: 'item_info',
    label: 'Item information',
    description: 'Supplier, category, barcode, reorder, allocated, value',
    defaultW: 8,
    defaultH: 5,
    minW: 4,
    minH: 3,
  },
  {
    id: 'allocations',
    label: 'Allocations',
    description: 'Reserved stock and reserve controls',
    defaultW: 8,
    defaultH: 6,
    minW: 4,
    minH: 3,
  },
  {
    id: 'recent_movements',
    label: 'Recent movements',
    description: 'Movement history for this SKU',
    defaultW: 8,
    defaultH: 8,
    minW: 4,
    minH: 4,
  },
  {
    id: 'item_image',
    label: 'Item image',
    description: 'Product image and upload',
    defaultW: 4,
    defaultH: 8,
    minW: 3,
    minH: 4,
  },
  {
    id: 'quick_stats',
    label: 'Quick stats',
    description: 'Available, allocated, reorder point, qty, value',
    defaultW: 4,
    defaultH: 5,
    minW: 3,
    minH: 3,
  },
  {
    id: 'last_movement',
    label: 'Last movement',
    description: 'Most recent movement date',
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
]

/** Default mirrors previous 2-col layout: main column left (8), sidebar right (4). */
export const DEFAULT_INVENTORY_ITEM_DETAIL_WIDGETS: ModuleWidgetItem[] = [
  { i: 'stats', x: 0, y: 0, w: 8, h: 3, minW: 4, minH: 2 },
  { i: 'item_image', x: 8, y: 0, w: 4, h: 8, minW: 3, minH: 4 },
  { i: 'item_info', x: 0, y: 3, w: 8, h: 5, minW: 4, minH: 3 },
  { i: 'quick_stats', x: 8, y: 8, w: 4, h: 5, minW: 3, minH: 3 },
  { i: 'allocations', x: 0, y: 8, w: 8, h: 6, minW: 4, minH: 3 },
  { i: 'last_movement', x: 8, y: 13, w: 4, h: 3, minW: 3, minH: 2 },
  { i: 'recent_movements', x: 0, y: 14, w: 8, h: 8, minW: 4, minH: 4 },
]

export type InventoryItemDetailWidgetLayout = ModuleWidgetLayout

export function normalizeInventoryItemDetailWidgetLayout(
  raw: unknown
): InventoryItemDetailWidgetLayout {
  return normalizeModuleWidgetLayout(
    raw,
    INVENTORY_ITEM_DETAIL_WIDGET_CATALOG,
    DEFAULT_INVENTORY_ITEM_DETAIL_WIDGETS,
    {}
  )
}

export function inventoryItemDetailWidgetLayoutToBase(
  layout: InventoryItemDetailWidgetLayout
): ModuleWidgetLayout {
  return {
    version: 2,
    widgets: layout.widgets,
    extras: layout.extras ?? {},
  }
}

export {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  removeWidgetFromLayout,
}
