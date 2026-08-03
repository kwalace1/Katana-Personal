import {
  buildStockroomLayout,
  binStatusColor,
  type StockroomBin,
  type StockroomZone,
  type StockroomStats,
} from './inventory-stockroom'
import type { InventoryItem } from './inventory-api'

export const ISO_TILE_W = 52
export const ISO_TILE_H = 26
export const ZONE_GAP_X = 280
export const ZONE_GAP_Y = 220

export type StockroomViewMode = 'status' | 'heatmap' | 'xray'

export interface SceneBin extends StockroomBin {
  isoX: number
  isoY: number
  zoneId: string
  zoneName: string
  zoneAccent: string
}

export interface SceneZone {
  zone: StockroomZone
  originX: number
  originY: number
  bins: SceneBin[]
  aislePath: { x: number; y: number }[]
}

export interface StockroomScene {
  zones: SceneZone[]
  bins: SceneBin[]
  stats: StockroomStats
  bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number }
  maxBinValue: number
  tourStops: SceneBin[]
}

export function toIsometric(gridX: number, gridY: number): { x: number; y: number } {
  return {
    x: (gridX - gridY) * (ISO_TILE_W / 2),
    y: (gridX + gridY) * (ISO_TILE_H / 2),
  }
}

function statusPriority(status: StockroomBin['status']): number {
  switch (status) {
    case 'out-of-stock':
      return 0
    case 'low-stock':
      return 1
    case 'mixed':
      return 2
    default:
      return 3
  }
}

function layoutZoneBins(zone: StockroomZone, originX: number, originY: number): SceneBin[] {
  const cols = zone.gridCols
  return zone.bins.map((bin) => {
    const { x, y } = toIsometric(bin.gridCol, bin.gridRow)
    return {
      ...bin,
      isoX: originX + x,
      isoY: originY + y + 40,
      zoneId: zone.id,
      zoneName: zone.name,
      zoneAccent: zone.accent,
    }
  })
}

/** Build a single isometric warehouse scene with world coordinates for camera + tour. */
export function buildStockroomScene(items: InventoryItem[]): StockroomScene {
  const { zones, stats } = buildStockroomLayout(items)
  const zoneCols = Math.max(1, Math.ceil(Math.sqrt(zones.length)))

  const sceneZones: SceneZone[] = zones.map((zone, index) => {
    const zx = (index % zoneCols) * ZONE_GAP_X - ((zoneCols - 1) * ZONE_GAP_X) / 2
    const zy = Math.floor(index / zoneCols) * ZONE_GAP_Y
    const bins = layoutZoneBins(zone, zx, zy)
    const aislePath = bins.length
      ? [
          { x: zx, y: zy + 80 },
          { x: zx + (zone.gridCols - 1) * (ISO_TILE_W / 4), y: zy + 80 + zone.gridRows * (ISO_TILE_H / 2) },
        ]
      : []
    return { zone, originX: zx, originY: zy, bins, aislePath }
  })

  const bins = sceneZones.flatMap((z) => z.bins)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const b of bins) {
    minX = Math.min(minX, b.isoX - 40)
    maxX = Math.max(maxX, b.isoX + 40)
    minY = Math.min(minY, b.isoY - 60)
    maxY = Math.max(maxY, b.isoY + 30)
  }

  if (!Number.isFinite(minX)) {
    minX = -200
    maxX = 200
    minY = -100
    maxY = 100
  }

  const maxBinValue = Math.max(1, ...bins.map((b) => b.totalValue))

  const tourStops = [...bins]
    .filter((b) => b.status !== 'in-stock')
    .sort((a, b) => statusPriority(a.status) - statusPriority(b.status) || b.totalValue - a.totalValue)

  if (tourStops.length === 0) {
    tourStops.push(...[...bins].sort((a, b) => b.totalValue - a.totalValue).slice(0, 6))
  }

  return {
    zones: sceneZones,
    bins,
    stats,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
    maxBinValue,
    tourStops,
  }
}

export function binHeatColor(value: number, maxValue: number): string {
  const t = Math.min(1, Math.max(0, value / maxValue))
  // Katana aqua → blue → purple
  const hue = 199 + t * 42
  return `hsl(${hue} 76% ${52 + t * 8}%)`
}

export function resolveBinColor(
  bin: StockroomBin,
  mode: StockroomViewMode,
  maxValue: number,
): string {
  if (mode === 'heatmap') return binHeatColor(bin.totalValue, maxValue)
  if (mode === 'xray') return binStatusColor(bin.status)
  return binStatusColor(bin.status)
}

export { binStatusColor, buildStockroomLayout }
