import type { InventoryItem } from './inventory-api'

export interface ParsedLocation {
  zone: string
  shelf: string
  bin: string
  display: string
}

export interface StockroomBin {
  id: string
  locationKey: string
  displayLocation: string
  parsed: ParsedLocation
  items: InventoryItem[]
  gridCol: number
  gridRow: number
  status: 'in-stock' | 'low-stock' | 'out-of-stock' | 'mixed'
  totalQty: number
  totalValue: number
  stackHeight: number
}

export interface StockroomZone {
  id: string
  name: string
  bins: StockroomBin[]
  gridCols: number
  gridRows: number
  accent: string
}

export interface StockroomStats {
  totalBins: number
  totalSkus: number
  totalUnits: number
  lowStockBins: number
  emptyBins: number
  zoneCount: number
}

/** Katana brand tokens for canvas/SVG (matches index.css) */
export const KATANA_BLUE = 'hsl(211 79% 58%)'
export const KATANA_PURPLE = 'hsl(241 91% 67%)'
export const KATANA_AQUA = 'hsl(199 76% 61%)'
export const KATANA_BLUE_RGB = '74, 144, 226'
export const KATANA_PURPLE_RGB = '91, 95, 246'
export const KATANA_AQUA_RGB = '93, 173, 226'

const ZONE_ACCENTS = [
  KATANA_BLUE,
  KATANA_PURPLE,
  KATANA_AQUA,
  'hsl(211 79% 48%)',
  'hsl(241 91% 57%)',
  'hsl(199 76% 51%)',
  'hsl(211 65% 68%)',
  'hsl(241 75% 72%)',
]

const UNASSIGNED_ZONE = 'Receiving Dock'

/** Parse free-text locations like A1-B2-C3, A1/B2, or plain labels into zone/shelf/bin. */
export function parseInventoryLocation(location: string | null | undefined): ParsedLocation {
  const raw = (location ?? '').trim()
  if (!raw) {
    return { zone: UNASSIGNED_ZONE, shelf: '', bin: '', display: 'Unassigned' }
  }

  const parts = raw
    .split(/[-/|,>]+/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 1) {
    return { zone: parts[0], shelf: '', bin: '', display: raw }
  }
  if (parts.length === 2) {
    return { zone: parts[0], shelf: parts[1], bin: '', display: raw }
  }
  return {
    zone: parts[0],
    shelf: parts[1],
    bin: parts.slice(2).join('-'),
    display: raw,
  }
}

function worstStatus(items: InventoryItem[]): StockroomBin['status'] {
  const statuses = new Set(items.map((i) => i.status))
  if (statuses.size > 1) return 'mixed'
  if (statuses.has('out-of-stock')) return 'out-of-stock'
  if (statuses.has('low-stock')) return 'low-stock'
  return 'in-stock'
}

/** Visual stack tiers 1–5 from on-hand quantity. */
export function qtyToStackHeight(qty: number): number {
  if (qty <= 0) return 1
  if (qty <= 5) return 2
  if (qty <= 20) return 3
  if (qty <= 50) return 4
  return 5
}

function layoutBins(bins: StockroomBin[]): StockroomBin[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(bins.length)))
  return bins.map((bin, index) => ({
    ...bin,
    gridCol: index % cols,
    gridRow: Math.floor(index / cols),
  }))
}

/** Group active inventory into zones and bins for the virtual stockroom floor. */
export function buildStockroomLayout(items: InventoryItem[]): { zones: StockroomZone[]; stats: StockroomStats } {
  const active = items.filter((i) => i.is_active)
  const byLocation = new Map<string, InventoryItem[]>()

  for (const item of active) {
    const key = (item.location ?? '').trim().toLowerCase() || '__unassigned__'
    const list = byLocation.get(key) ?? []
    list.push(item)
    byLocation.set(key, list)
  }

  const zoneMap = new Map<string, StockroomBin[]>()

  for (const [locationKey, locationItems] of byLocation) {
    const displayLocation =
      locationKey === '__unassigned__' ? 'Unassigned' : (locationItems[0]?.location?.trim() ?? 'Unknown')
    const parsed = parseInventoryLocation(displayLocation)
    const totalQty = locationItems.reduce((s, i) => s + i.on_hand_qty, 0)
    const totalValue = locationItems.reduce((s, i) => s + i.total_value, 0)

    const bin: StockroomBin = {
      id: locationKey,
      locationKey,
      displayLocation,
      parsed,
      items: locationItems,
      gridCol: 0,
      gridRow: 0,
      status: worstStatus(locationItems),
      totalQty,
      totalValue,
      stackHeight: qtyToStackHeight(totalQty),
    }

    const zoneBins = zoneMap.get(parsed.zone) ?? []
    zoneBins.push(bin)
    zoneMap.set(parsed.zone, zoneBins)
  }

  const zones: StockroomZone[] = Array.from(zoneMap.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([name, bins], index) => {
      const laidOut = layoutBins(
        bins.sort((a, b) => a.displayLocation.localeCompare(b.displayLocation, undefined, { numeric: true })),
      )
      const cols = Math.max(1, Math.ceil(Math.sqrt(laidOut.length)))
      const rows = Math.max(1, Math.ceil(laidOut.length / cols))
      return {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        bins: laidOut,
        gridCols: cols,
        gridRows: rows,
        accent: ZONE_ACCENTS[index % ZONE_ACCENTS.length],
      }
    })

  const allBins = zones.flatMap((z) => z.bins)
  const stats: StockroomStats = {
    totalBins: allBins.length,
    totalSkus: active.length,
    totalUnits: active.reduce((s, i) => s + i.on_hand_qty, 0),
    lowStockBins: allBins.filter((b) => b.status === 'low-stock' || b.status === 'mixed').length,
    emptyBins: allBins.filter((b) => b.totalQty <= 0).length,
    zoneCount: zones.length,
  }

  return { zones, stats }
}

export function binStatusColor(status: StockroomBin['status']): string {
  switch (status) {
    case 'in-stock':
      return 'hsl(142 71% 45%)'
    case 'low-stock':
      return 'hsl(38 92% 50%)'
    case 'out-of-stock':
      return 'hsl(0 72% 51%)'
    case 'mixed':
      return KATANA_PURPLE
    default:
      return 'hsl(220 8% 42%)'
  }
}
