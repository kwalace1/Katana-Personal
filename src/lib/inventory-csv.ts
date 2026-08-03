import type { InventoryItem, InventoryTransaction } from './inventory-api'

const EXPORT_HEADERS = [
  'sku',
  'product_name',
  'location',
  'on_hand_qty',
  'min_qty',
  'reorder_qty',
  'unit_cost',
  'supplier_name',
  'category',
  'barcode',
  'description',
] as const

export type InventoryCsvRow = {
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
}

function escapeCsv(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function inventoryItemsToCsv(items: InventoryItem[]): string {
  const rows = [
    EXPORT_HEADERS.join(','),
    ...items.map((item) =>
      [
        escapeCsv(item.sku),
        escapeCsv(item.product_name),
        escapeCsv(item.location),
        item.on_hand_qty,
        item.min_qty,
        item.reorder_qty,
        item.unit_cost,
        escapeCsv(item.supplier_name),
        escapeCsv(item.category),
        escapeCsv(item.barcode),
        escapeCsv(item.description),
      ].join(','),
    ),
  ]
  return rows.join('\n')
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export function parseInventoryCsv(text: string): {
  rows: InventoryCsvRow[]
  errors: string[]
} {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length === 0) return { rows: [], errors: ['File is empty'] }

  const headerCells = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const skuIdx = headerCells.indexOf('sku')
  const nameIdx = headerCells.findIndex((h) => h === 'product_name' || h === 'name' || h === 'product')
  if (skuIdx < 0 || nameIdx < 0) {
    return { rows: [], errors: ['CSV must include sku and product_name (or name) columns'] }
  }

  const col = (cells: string[], names: string[], fallback = '') => {
    for (const n of names) {
      const i = headerCells.indexOf(n)
      if (i >= 0) return cells[i]?.trim() ?? fallback
    }
    return fallback
  }

  const rows: InventoryCsvRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    const sku = cells[skuIdx]?.trim()
    const product_name = cells[nameIdx]?.trim()
    if (!sku && !product_name) continue
    if (!sku) {
      errors.push(`Row ${i + 1}: missing SKU`)
      continue
    }
    if (!product_name) {
      errors.push(`Row ${i + 1}: missing product name`)
      continue
    }

    const num = (names: string[], def = 0) => {
      const v = col(cells, names)
      const n = parseFloat(v)
      return Number.isFinite(n) ? n : def
    }

    rows.push({
      sku,
      product_name,
      location: col(cells, ['location'], 'Main'),
      on_hand_qty: num(['on_hand_qty', 'qty', 'quantity']),
      min_qty: num(['min_qty', 'min']),
      reorder_qty: num(['reorder_qty', 'reorder']),
      unit_cost: num(['unit_cost', 'cost']),
      supplier_name: col(cells, ['supplier_name', 'supplier']),
      category: col(cells, ['category']),
      barcode: col(cells, ['barcode']),
      description: col(cells, ['description']),
    })
  }

  return { rows, errors }
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

const TX_EXPORT_HEADERS = [
  'transaction_date',
  'type',
  'sku',
  'product_name',
  'quantity',
  'quantity_delta',
  'location',
  'user_name',
  'reference',
  'notes',
] as const

export function inventoryTransactionsToCsv(transactions: InventoryTransaction[]): string {
  const rows = [
    TX_EXPORT_HEADERS.join(','),
    ...transactions.map((tx) =>
      [
        escapeCsv(new Date(tx.transaction_date).toISOString()),
        escapeCsv(tx.type),
        escapeCsv(tx.sku),
        escapeCsv(tx.product_name),
        tx.quantity,
        tx.quantity_delta,
        escapeCsv(tx.location),
        escapeCsv(tx.user_name),
        escapeCsv(tx.reference),
        escapeCsv(tx.notes),
      ].join(','),
    ),
  ]
  return rows.join('\n')
}
