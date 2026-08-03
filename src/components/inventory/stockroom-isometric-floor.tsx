import { memo, useCallback, useId, useState } from 'react'
import { motion } from 'framer-motion'
import {
  resolveBinColor,
  type SceneBin,
  type SceneZone,
  type StockroomViewMode,
} from '@/lib/inventory-stockroom-scene'
import { KATANA_BLUE, KATANA_BLUE_RGB, KATANA_PURPLE_RGB } from '@/lib/inventory-stockroom'

const ISO_HW = 22
const ISO_HH = 11

// Iso floor-grid tile (2:1 ratio) — ambient depth cue across the platform.
const GRID_W = 52
const GRID_H = 26
const SLAB_THICKNESS = 12

// ─── geometry helpers ──────────────────────────────────────────────────────────

function pathFromPoints(pts: readonly (readonly [number, number])[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z'
}

function darken(hex: string, amount: number): string {
  return `color-mix(in srgb, ${hex} ${100 - amount}%, black)`
}

function lighten(hex: string, amount: number): string {
  return `color-mix(in srgb, ${hex} ${100 - amount}%, white)`
}

/** Smallest symmetric isometric diamond (2:1) that covers the given screen points. */
function isoCover(xs: number[], ys: number[], pad: number) {
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const hw = (maxX - minX) / 2 + (maxY - minY) + pad
  return { cx, cy, hw, hh: hw / 2 }
}

function diamond(cx: number, cy: number, hw: number, hh: number) {
  return [
    [cx, cy - hh],
    [cx + hw, cy],
    [cx, cy + hh],
    [cx - hw, cy],
  ] as const
}

function isoCubePaths(cx: number, cy: number, stackHeight: number) {
  const h = 8 + stackHeight * 5
  const top = [
    [cx, cy - h],
    [cx + ISO_HW, cy - h + ISO_HH],
    [cx, cy - h + ISO_HH * 2],
    [cx - ISO_HW, cy - h + ISO_HH],
  ] as const
  const right = [
    [cx, cy - h + ISO_HH * 2],
    [cx + ISO_HW, cy - h + ISO_HH],
    [cx + ISO_HW, cy + ISO_HH],
    [cx, cy + ISO_HH * 2],
  ] as const
  const left = [
    [cx - ISO_HW, cy - h + ISO_HH],
    [cx, cy - h + ISO_HH * 2],
    [cx, cy + ISO_HH * 2],
    [cx - ISO_HW, cy + ISO_HH],
  ] as const
  return { top, right, left, h }
}

/** Short, readable code shown on the bin — keeps the most specific part of the location. */
function binShortLabel(bin: SceneBin): string {
  const code = bin.parsed.bin || bin.parsed.shelf || bin.displayLocation
  return code.length > 16 ? code.slice(0, 15) + '…' : code
}

// ─── floor platform ──────────────────────────────────────────────────────────

function FloorSlab({ bins, gridId, gradId }: { bins: SceneBin[]; gridId: string; gradId: string }) {
  if (bins.length === 0) return null
  const { cx, cy, hw, hh } = isoCover(
    bins.map((b) => b.isoX),
    bins.map((b) => b.isoY),
    150,
  )
  const [top, right, bottom, left] = diamond(cx, cy, hw, hh)
  const T = SLAB_THICKNESS
  const topPath = pathFromPoints([top, right, bottom, left])

  // extruded thickness on the two front-facing (lower) edges
  const leftSide = pathFromPoints([
    left,
    bottom,
    [bottom[0], bottom[1] + T],
    [left[0], left[1] + T],
  ])
  const rightSide = pathFromPoints([
    bottom,
    right,
    [right[0], right[1] + T],
    [bottom[0], bottom[1] + T],
  ])

  return (
    <g>
      {/* drop shadow on the void below */}
      <ellipse cx={cx} cy={bottom[1] + T + 14} rx={hw * 0.92} ry={hh * 0.42} fill="rgba(0,0,0,0.45)" />
      {/* slab edge / thickness */}
      <path d={leftSide} fill="rgba(6,12,26,0.95)" stroke="rgba(34,211,238,0.12)" strokeWidth={1} />
      <path d={rightSide} fill="rgba(11,20,40,0.95)" stroke="rgba(34,211,238,0.18)" strokeWidth={1} />
      {/* slab top */}
      <path d={topPath} fill={`url(#${gradId})`} />
      <path d={topPath} fill={`url(#${gridId})`} opacity={0.55} />
      {/* perimeter glow */}
      <path d={topPath} fill="none" stroke="rgba(34,211,238,0.16)" strokeWidth={4} />
      <path d={topPath} fill="none" stroke="rgba(56,189,248,0.55)" strokeWidth={1.5} />
    </g>
  )
}

function ZonePad({ sceneZone }: { sceneZone: SceneZone }) {
  const { zone, bins } = sceneZone
  if (bins.length === 0) return null
  const { cx, cy, hw, hh } = isoCover(
    bins.map((b) => b.isoX),
    bins.map((b) => b.isoY),
    34,
  )
  const verts = diamond(cx, cy, hw, hh)
  const pad = pathFromPoints(verts)
  return (
    <g className="pointer-events-none">
      <path
        d={pad}
        fill={`color-mix(in srgb, ${zone.accent} 9%, transparent)`}
        stroke={`color-mix(in srgb, ${zone.accent} 38%, transparent)`}
        strokeWidth={1.25}
        strokeDasharray="7 5"
      />
      {verts.map(([vx, vy], i) => (
        <circle key={i} cx={vx} cy={vy} r={2.4} fill={zone.accent} opacity={0.9} />
      ))}
    </g>
  )
}

// ─── bins ──────────────────────────────────────────────────────────────────────

const IsoBin = memo(function IsoBin({
  bin,
  selected,
  highlighted,
  dimmed,
  viewMode,
  maxValue,
  scanPhase,
  onSelect,
  onHover,
}: {
  bin: SceneBin
  selected: boolean
  highlighted: boolean
  dimmed: boolean
  viewMode: StockroomViewMode
  maxValue: number
  scanPhase: number
  onSelect: (bin: SceneBin) => void
  onHover: (id: string | null) => void
}) {
  const { top, right, left, h } = isoCubePaths(bin.isoX, bin.isoY, bin.stackHeight)
  const color = resolveBinColor(bin, viewMode, maxValue)
  const xray = viewMode === 'xray'
  const opacity = dimmed ? 0.12 : xray ? 0.5 : 1

  const dist = Math.hypot(bin.isoX, bin.isoY)
  const scanWave = Math.abs(dist / 400 - scanPhase)
  const scanGlow = scanPhase > 0 && scanWave < 0.08 ? 1 - scanWave / 0.08 : 0

  const alerting =
    bin.status === 'low-stock' || bin.status === 'mixed' || bin.status === 'out-of-stock'

  // stacked-crate tier seams convey quantity height as physical boxes
  const tiers = Math.max(0, bin.stackHeight - 1)
  const seams: { l: string; r: string }[] = []
  for (let i = 1; i <= tiers; i++) {
    const f = i / bin.stackHeight
    const yR = bin.isoY - h + ISO_HH + f * h
    const yL = bin.isoY - h + ISO_HH + f * h
    seams.push({
      r: `M${bin.isoX},${bin.isoY - h + ISO_HH * 2 + f * h} L${bin.isoX + ISO_HW},${yR}`,
      l: `M${bin.isoX - ISO_HW},${yL} L${bin.isoX},${bin.isoY - h + ISO_HH * 2 + f * h}`,
    })
  }

  // inset diamond on the lid for a crate-top look
  const lidInset = [
    [bin.isoX, bin.isoY - h + 3],
    [bin.isoX + ISO_HW - 6, bin.isoY - h + ISO_HH],
    [bin.isoX, bin.isoY - h + ISO_HH * 2 - 3],
    [bin.isoX - ISO_HW + 6, bin.isoY - h + ISO_HH],
  ] as const

  return (
    <g
      className="cursor-pointer transition-[filter] duration-150 hover:brightness-[1.18] focus:outline-none focus-visible:brightness-[1.18]"
      opacity={opacity}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(bin)
      }}
      onMouseEnter={() => onHover(bin.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(bin.id)}
      onBlur={() => onHover(null)}
      role="button"
      tabIndex={0}
      aria-label={`Bin ${bin.displayLocation}, ${bin.totalQty} units`}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(bin)}
    >
      <title>
        {`${bin.displayLocation} · ${bin.zoneName} · ${bin.totalQty} units · ${bin.items.length} item${bin.items.length === 1 ? '' : 's'}`}
      </title>

      {/* contact shadow grounds the crate on the floor */}
      <ellipse cx={bin.isoX} cy={bin.isoY + ISO_HH * 2 + 1} rx={ISO_HW - 1} ry={5} fill="rgba(0,0,0,0.34)" />

      {/* status floor-glow */}
      {!dimmed && (
        <ellipse
          cx={bin.isoX}
          cy={bin.isoY + ISO_HH * 2}
          rx={ISO_HW + 2}
          ry={ISO_HH - 1}
          fill={color}
          opacity={0.14}
        />
      )}

      {(selected || highlighted || scanGlow > 0) && (
        <ellipse
          cx={bin.isoX}
          cy={bin.isoY + ISO_HH * 2 + 4}
          rx={ISO_HW + 6}
          ry={ISO_HH + 3}
          fill={selected ? `rgba(${KATANA_BLUE_RGB}, 0.35)` : highlighted ? `rgba(${KATANA_PURPLE_RGB}, 0.28)` : `rgba(${KATANA_BLUE_RGB}, ${scanGlow * 0.35})`}
        />
      )}

      {/* crate body */}
      <path d={pathFromPoints(left)} fill={darken(color, 38)} stroke="rgba(0,0,0,0.25)" strokeWidth={0.5} />
      <path d={pathFromPoints(right)} fill={darken(color, 16)} stroke="rgba(0,0,0,0.18)" strokeWidth={0.5} />
      <path d={pathFromPoints(top)} fill={lighten(color, 14)} stroke="rgba(255,255,255,0.28)" strokeWidth={0.6} />

      {/* tier seams */}
      {seams.map((s, i) => (
        <g key={i} opacity={0.5}>
          <path d={s.l} stroke={darken(color, 50)} strokeWidth={0.6} fill="none" />
          <path d={s.r} stroke={darken(color, 50)} strokeWidth={0.6} fill="none" />
        </g>
      ))}

      {/* lid inset */}
      <path d={pathFromPoints(lidInset)} fill="none" stroke={lighten(color, 35)} strokeWidth={0.6} opacity={0.5} />

      {/* bright top edges (key light) */}
      <path
        d={`M${bin.isoX - ISO_HW},${bin.isoY - h + ISO_HH} L${bin.isoX},${bin.isoY - h} L${bin.isoX + ISO_HW},${bin.isoY - h + ISO_HH}`}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={0.8}
      />

      {xray && <path d={pathFromPoints(top)} fill="none" stroke={color} strokeWidth={1.2} opacity={0.6} />}

      {selected && (
        <motion.path
          d={pathFromPoints(top)}
          fill="none"
          stroke={KATANA_BLUE}
          strokeWidth={2}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4 }}
        />
      )}

      {alerting && !dimmed && (
        <circle cx={bin.isoX + ISO_HW - 4} cy={bin.isoY - bin.stackHeight * 5 - 8} r={3} fill="#fbbf24">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}


      {bin.totalQty > 0 && (
        <text
          x={Math.round(bin.isoX)}
          y={Math.round(bin.isoY) - 1}
          textAnchor="middle"
          className="fill-white font-bold pointer-events-none select-none"
          style={{ fontSize: 9, paintOrder: 'stroke', textRendering: 'geometricPrecision' }}
          stroke="rgba(2,6,23,0.85)"
          strokeWidth={1.25}
          strokeLinejoin="round"
        >
          {bin.totalQty > 99 ? '99+' : bin.totalQty}
        </text>
      )}
    </g>
  )
})

/**
 * Floating location label, drawn in a pass ABOVE every crate so a nearer stack can
 * never clip a name behind it. A dark halo keeps each label legible; focused/searched/
 * hovered bins get a full pill with the complete code.
 */
const BinLabel = memo(function BinLabel({
  bin,
  dimmed,
  emphasized,
}: {
  bin: SceneBin
  dimmed: boolean
  emphasized: boolean
}) {
  const topY = bin.isoY - 8 - bin.stackHeight * 5

  if (emphasized) {
    const full = bin.displayLocation
    const w = Math.max(46, full.length * 6.7 + 18)
    const pillY = topY - 26
    return (
      <g pointerEvents="none" className="select-none">
        <rect
          x={bin.isoX - w / 2}
          y={pillY}
          width={w}
          height={19}
          rx={9.5}
          fill="rgba(8,15,33,0.95)"
          stroke="rgba(56,189,248,0.7)"
          strokeWidth={1}
        />
        <text
          x={bin.isoX}
          y={pillY + 13.2}
          textAnchor="middle"
          className="fill-cyan-50 font-mono"
          style={{ fontSize: 11, fontWeight: 600 }}
        >
          {full}
        </text>
      </g>
    )
  }

  return (
    <text
      x={bin.isoX}
      y={topY - 6}
      textAnchor="middle"
      pointerEvents="none"
      className="fill-slate-100 font-mono select-none"
      style={{ fontSize: 10, paintOrder: 'stroke', opacity: dimmed ? 0.16 : 0.95 }}
      stroke="rgba(2,6,23,0.9)"
      strokeWidth={3}
      strokeLinejoin="round"
    >
      {binShortLabel(bin)}
    </text>
  )
})

/** Holographic zone banner that floats above its crates — clears bin labels entirely. */
function ZoneBanner({ sceneZone, dimmed }: { sceneZone: SceneZone; dimmed: boolean }) {
  const { zone, bins } = sceneZone
  if (bins.length === 0) return null
  const xs = bins.map((b) => b.isoX)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const topY = Math.min(...bins.map((b) => b.isoY - 8 - b.stackHeight * 5))
  const label = zone.name.toUpperCase()
  const count = `${bins.length}`
  const w = Math.max(64, label.length * 7.4 + count.length * 7 + 40)
  const bannerY = topY - 54
  const padY = topY - 6
  return (
    <g className="pointer-events-none select-none" opacity={dimmed ? 0.4 : 1}>
      {/* stem from banner down to the zone */}
      <line x1={cx} y1={bannerY + 22} x2={cx} y2={padY} stroke={`color-mix(in srgb, ${zone.accent} 55%, transparent)`} strokeWidth={1} strokeDasharray="2 3" />
      <circle cx={cx} cy={padY} r={2} fill={zone.accent} />
      {/* banner */}
      <rect
        x={cx - w / 2}
        y={bannerY}
        width={w}
        height={22}
        rx={6}
        fill="rgba(7,13,28,0.92)"
        stroke={`color-mix(in srgb, ${zone.accent} 60%, transparent)`}
        strokeWidth={1.25}
      />
      <rect x={cx - w / 2} y={bannerY} width={3.5} height={22} rx={1.5} fill={zone.accent} />
      <text
        x={cx - w / 2 + 12}
        y={bannerY + 15}
        textAnchor="start"
        className="fill-white font-bold uppercase"
        style={{ fontSize: 10.5, letterSpacing: '0.12em' }}
      >
        {label}
      </text>
      <text
        x={cx + w / 2 - 11}
        y={bannerY + 15}
        textAnchor="end"
        className="font-mono font-bold"
        style={{ fontSize: 10, fill: zone.accent }}
      >
        {count}
      </text>
    </g>
  )
}

// ─── floor ──────────────────────────────────────────────────────────────────────

export function StockroomIsometricFloor({
  sceneZones,
  bins,
  maxValue,
  viewMode,
  selectedBinId,
  highlightBinId,
  spotlight,
  scanPhase,
  tourBinId,
  onSelectBin,
}: {
  sceneZones: SceneZone[]
  bins: SceneBin[]
  maxValue: number
  viewMode: StockroomViewMode
  selectedBinId: string | null
  highlightBinId: string | null
  spotlight: boolean
  scanPhase: number
  tourBinId: string | null
  onSelectBin: (bin: SceneBin) => void
}) {
  const uid = useId()
  const gridId = `${uid}-grid`
  const gradId = `${uid}-grad`
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const handleHover = useCallback((id: string | null) => setHoveredId(id), [])

  const sortedBins = [...bins].sort((a, b) => a.isoY - b.isoY || a.isoX - b.isoX)

  return (
    <svg className="overflow-visible" style={{ minWidth: 400, minHeight: 300 }}>
      <defs>
        <pattern id={gridId} width={GRID_W} height={GRID_H} patternUnits="userSpaceOnUse">
          <path
            d={`M0,${GRID_H / 2} L${GRID_W / 2},0 L${GRID_W},${GRID_H / 2} L${GRID_W / 2},${GRID_H} Z`}
            fill="none"
            stroke="rgba(56,189,248,0.09)"
            strokeWidth={1}
          />
        </pattern>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(28,46,82,0.62)" />
          <stop offset="55%" stopColor="rgba(13,23,46,0.78)" />
          <stop offset="100%" stopColor="rgba(7,12,28,0.9)" />
        </linearGradient>
      </defs>

      {/* unified warehouse platform */}
      <FloorSlab bins={bins} gridId={gridId} gradId={gradId} />

      {/* zone footprints */}
      {sceneZones.map((sz) => (
        <ZonePad key={sz.zone.id} sceneZone={sz} />
      ))}

      {/* crates, back-to-front */}
      {sortedBins.map((bin) => (
        <IsoBin
          key={bin.id}
          bin={bin}
          selected={selectedBinId === bin.id || tourBinId === bin.id}
          highlighted={highlightBinId === bin.id}
          dimmed={spotlight && selectedBinId !== bin.id && highlightBinId !== bin.id && tourBinId !== bin.id}
          viewMode={viewMode}
          maxValue={maxValue}
          scanPhase={scanPhase}
          onSelect={onSelectBin}
          onHover={handleHover}
        />
      ))}

      {/* resting bin labels — single-part bins are named by their zone banner, and
          emphasized (hover/selected/search) labels are drawn later, above the banners */}
      {sortedBins.map((bin) => {
        const focused =
          selectedBinId === bin.id || highlightBinId === bin.id || tourBinId === bin.id
        const hovered = hoveredId === bin.id
        const redundant = !bin.parsed.bin && !bin.parsed.shelf
        if (redundant || focused || hovered) return null
        return <BinLabel key={`label-${bin.id}`} bin={bin} dimmed={spotlight} emphasized={false} />
      })}

      {/* zone banners float above the crates */}
      {sceneZones.map((sz) => (
        <ZoneBanner key={`banner-${sz.zone.id}`} sceneZone={sz} dimmed={spotlight} />
      ))}

      {/* emphasized labels drawn ABOVE banners so a hovered/selected name is never occluded */}
      {sortedBins.map((bin) => {
        const focused =
          selectedBinId === bin.id || highlightBinId === bin.id || tourBinId === bin.id
        const hovered = hoveredId === bin.id
        const redundant = !bin.parsed.bin && !bin.parsed.shelf
        if (redundant || !(focused || hovered)) return null
        return <BinLabel key={`emph-${bin.id}`} bin={bin} dimmed={false} emphasized />
      })}
    </svg>
  )
}

export function StockroomDroneMarker({ x, y, visible }: { x: number; y: number; visible: boolean }) {
  if (!visible) return null
  return (
    <motion.g
      initial={{ opacity: 0, y: y - 30 }}
      animate={{ opacity: 1, y: y - 48 }}
      exit={{ opacity: 0 }}
    >
      <ellipse cx={x} cy={y - 44} rx={14} ry={5} fill="none" stroke={`rgba(${KATANA_BLUE_RGB}, 0.5)`} strokeWidth={1}>
        <animate attributeName="rx" values="10;18;10" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
      </ellipse>
      <path
        d={`M${x - 10},${y - 48} L${x},${y - 54} L${x + 10},${y - 48} L${x},${y - 42} Z`}
        fill={KATANA_BLUE}
        stroke="hsl(var(--card))"
        strokeWidth={0.5}
      />
      <line x1={x - 14} y1={y - 46} x2={x - 6} y2={y - 48} stroke={`rgba(${KATANA_BLUE_RGB}, 0.8)`} strokeWidth={1.5} />
      <line x1={x + 14} y1={y - 46} x2={x + 6} y2={y - 48} stroke={`rgba(${KATANA_BLUE_RGB}, 0.8)`} strokeWidth={1.5} />
      <circle cx={x} cy={y - 48} r={2} fill="hsl(var(--card))" />
    </motion.g>
  )
}

export function StockroomLaserBeam({
  fromX,
  fromY,
  toX,
  toY,
  active,
}: {
  fromX: number
  fromY: number
  toX: number
  toY: number
  active: boolean
}) {
  if (!active) return null
  return (
    <g className="pointer-events-none">
      <line
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke={`rgba(${KATANA_BLUE_RGB}, 0.15)`}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke={`rgba(${KATANA_BLUE_RGB}, 0.7)`}
        strokeWidth={1}
        strokeDasharray="4 6"
        strokeLinecap="round"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.6s" repeatCount="indefinite" />
      </line>
    </g>
  )
}

export function StockroomPulseRing({ phase }: { phase: number }) {
  if (phase <= 0) return null
  const r = 40 + phase * 500
  const opacity = Math.max(0, 0.5 - phase * 0.5)
  return (
    <circle cx={0} cy={0} r={r} fill="none" stroke={`rgba(${KATANA_BLUE_RGB}, ${opacity})`} strokeWidth={2} />
  )
}
