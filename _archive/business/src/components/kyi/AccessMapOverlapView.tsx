import { useState, useEffect, useRef, useCallback } from 'react'
import type { WheelEvent as ReactWheelEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, UserPlus } from 'lucide-react'
import {
  buildTargetedInvestorAddUrl,
  getInvestorOverlap,
  type InvestorOverlapResponse,
  type MultiInvestorSuggestion,
} from '@/lib/kyi-api'

/** Per ORBIT §6: investor colors for outer ring */
const INVESTOR_PALETTE = ['#7c5cff', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']
const CONN2_COLOR = '#3b82f6'
const CONN3_COLOR = '#f59e0b'
const OUTER_NODE_R = 22
const INNER_RADIUS_BASE = 60
const RING_SPACING = 40
const ZOOM_EXTENT: [number, number] = [0.3, 3]

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

interface AccessMapOverlapViewProps {
  companyId: number
  companyName: string
  fullscreen?: boolean
}

function getInitials(label: string): string {
  const parts = (label || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (label || '?').slice(0, 2).toUpperCase()
}

export function AccessMapOverlapView({ companyId, companyName, fullscreen = false }: AccessMapOverlapViewProps) {
  const [data, setData] = useState<InvestorOverlapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoverInvestorId, setHoverInvestorId] = useState<number | null>(null)
  const [hoverSuggestionLabel, setHoverSuggestionLabel] = useState<string | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<MultiInvestorSuggestion | null>(null)
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 })
  const panRef = useRef({ panning: false, lastX: 0, lastY: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dim, setDim] = useState(() => ({
    width: 400,
    height: 400,
    centerX: 200,
    centerY: 200,
  }))

  useEffect(() => {
    let cancelled = false
    getInvestorOverlap(companyId)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load overlap data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth || 400
      const h = el.clientHeight || 400
      const size = Math.min(w, h)
      setDim({
        width: size,
        height: size,
        centerX: size / 2,
        centerY: size / 2,
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [fullscreen])

  const handleWheel = useCallback((e: ReactWheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const factor = Math.exp(-e.deltaY * 0.001)
    setZoomTransform((prev) => {
      const nextK = clamp(prev.k * factor, ZOOM_EXTENT[0], ZOOM_EXTENT[1])
      return { ...prev, k: nextK }
    })
  }, [])

  const handlePointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    panRef.current.panning = true
    panRef.current.lastX = e.clientX
    panRef.current.lastY = e.clientY
  }, [])

  const handlePointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (!panRef.current.panning) return
    const { clientX, clientY } = e
    const dx = clientX - panRef.current.lastX
    const dy = clientY - panRef.current.lastY
    panRef.current.lastX = clientX
    panRef.current.lastY = clientY
    setZoomTransform((prev) => ({
      ...prev,
      x: prev.x + dx / prev.k,
      y: prev.y + dy / prev.k,
    }))
  }, [])

  const endPan = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current.panning) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
    panRef.current.panning = false
  }, [])

  const handleDoubleClick = useCallback(() => {
    const start = performance.now()
    const from = { ...zoomTransform }
    const duration = 500
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setZoomTransform({
        k: from.k + (1 - from.k) * t,
        x: from.x * (1 - t),
        y: from.y * (1 - t),
      })
      if (t < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [zoomTransform])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 rounded-xl border border-border kyi-network-map-bg">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return <p className="text-sm text-red-500 py-4">{error}</p>
  }
  if (!data || data.investors.length < 2) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-muted-foreground">
        <p>Overlap view requires at least 2 investors. Add more investors to this company to see shared connections.</p>
      </div>
    )
  }

  const investors = data.investors
  const suggestions = data.multi_investor_suggestions || []
  const svgW = dim.width
  const svgH = dim.height
  const cx = dim.centerX
  const cy = dim.centerY
  const minWh = Math.min(svgW, svgH)
  const outerRadius = minWh * 0.4

  const investorPositions = investors.map((inv, i) => {
    const angle = (i / investors.length) * 2 * Math.PI - Math.PI / 2
    const rawLabel =
      inv.label ||
      (inv as { name?: string }).name ||
      (inv as { full_name?: string }).full_name ||
      ''
    return {
      id: inv.id,
      label: rawLabel,
      x: outerRadius * Math.cos(angle),
      y: outerRadius * Math.sin(angle),
      color: INVESTOR_PALETTE[i % INVESTOR_PALETTE.length],
    }
  })

  const byCount = new Map<number, MultiInvestorSuggestion[]>()
  suggestions.forEach((s) => {
    const c = s.connection_count
    if (!byCount.has(c)) byCount.set(c, [])
    byCount.get(c)!.push(s)
  })
  const countsDesc = [...byCount.keys()].sort((a, b) => b - a)
  const suggestionPositions: { x: number; y: number; suggestion: MultiInvestorSuggestion; nodeR: number; label: string }[] = []
  countsDesc.forEach((connectionCount, ringIdx) => {
    const list = byCount.get(connectionCount) ?? []
    const ringRadius = INNER_RADIUS_BASE + ringIdx * RING_SPACING
    const nodeR = 8 + connectionCount * 3
    list.forEach((s, i) => {
      const angle = (i / Math.max(list.length, 1)) * 2 * Math.PI - Math.PI / 2
      const label = s.label || (s as { name?: string }).name || ''
      suggestionPositions.push({
        x: ringRadius * Math.cos(angle),
        y: ringRadius * Math.sin(angle),
        suggestion: s,
        nodeR,
        label,
      })
    })
  })

  return (
    <div className={fullscreen ? 'flex flex-1 min-h-0 min-w-0' : 'flex flex-col md:flex-row gap-4'}>
      <div
        ref={containerRef}
        className={
          fullscreen
            ? 'relative flex-1 min-h-0 min-w-0 rounded-xl border border-border kyi-network-map-bg flex items-center justify-center'
            : 'relative flex-shrink-0 rounded-xl border border-border kyi-network-map-bg min-h-[400px]'
        }
      >
        {/* Legend at top-left per ORBIT §6 */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 text-[10px] text-white/90">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: INVESTOR_PALETTE[0] }} />
            Your investors
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CONN2_COLOR }} />
            Connected to 2 investors
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CONN3_COLOR }} />
            Connected to 3+ investors (high value)
          </span>
        </div>
        <svg
          width={fullscreen ? '100%' : svgW}
          height={fullscreen ? '100%' : svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          style={fullscreen ? { maxHeight: '100%' } : undefined}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerLeave={endPan}
          onDoubleClick={handleDoubleClick}
        >
          <g transform={`translate(${cx},${cy}) scale(${zoomTransform.k}) translate(${zoomTransform.x},${zoomTransform.y})`}>
            {/* Edges: each suggestion to each connected_to investor (stroke = investor color, opacity 0.4) */}
            {suggestionPositions.map((sp) =>
              sp.suggestion.connected_to.map((conn) => {
                const inv = investorPositions.find((ip) => ip.label === conn.name || ip.id === conn.id)
                if (!inv) return null
                const highlight = hoverSuggestionLabel === sp.label || hoverInvestorId === inv.id
                const stroke = inv.color
                const opacity = highlight ? 0.9 : 0.4
                const strokeW = highlight ? 3 : 1.2
                return (
                  <line
                    key={`${sp.suggestion.label}-${inv.id}`}
                    x1={sp.x}
                    y1={sp.y}
                    x2={inv.x}
                    y2={inv.y}
                    stroke={stroke}
                    strokeOpacity={opacity}
                    strokeWidth={strokeW}
                  />
                )
              }),
            )}
            {/* Center label per spec */}
            <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fill="#9ca3af" fontSize={10} className="pointer-events-none">
              {suggestions.length} people connected to multiple investors
            </text>
            {/* Investor nodes (outer ring) */}
            {investorPositions.map((ip) => (
              <g
                key={ip.id}
                onMouseEnter={() => setHoverInvestorId(ip.id)}
                onMouseLeave={() => setHoverInvestorId(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={ip.x}
                  cy={ip.y}
                  r={OUTER_NODE_R}
                  fill={ip.color}
                  stroke={hoverInvestorId === ip.id ? '#fff' : '#1a1a24'}
                  strokeWidth={hoverInvestorId === ip.id ? 2.5 : 2}
                />
                <text x={ip.x} y={ip.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={10} fontWeight="600">
                  {getInitials(ip.label)}
                </text>
              </g>
            ))}
            {/* Suggestion nodes (inner rings): color by connection_count, show number if >= 2 */}
            {suggestionPositions.map((sp) => {
              const count = sp.suggestion.connection_count
              const fill = count >= 3 ? CONN3_COLOR : CONN2_COLOR
              const isHover = hoverSuggestionLabel === sp.label
              return (
                <g
                  key={sp.label || sp.suggestion.label}
                  onMouseEnter={() => setHoverSuggestionLabel(sp.label)}
                  onMouseLeave={() => setHoverSuggestionLabel(null)}
                  onClick={() => setSelectedSuggestion(sp.suggestion)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={sp.x}
                    cy={sp.y}
                    r={sp.nodeR}
                    fill={fill}
                    stroke={isHover ? '#fff' : '#1a1a24'}
                    strokeWidth={isHover ? 2.5 : 2}
                  />
                  <text x={sp.x} y={sp.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={count >= 2 ? 9 : 8} fontWeight="600">
                    {count >= 2 ? String(count) : getInitials(sp.label)}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
        {hoverSuggestionLabel && (() => {
          const s = suggestions.find((x) => x.label === hoverSuggestionLabel || (x as { name?: string }).name === hoverSuggestionLabel)
          if (!s) return null
          return (
            <div className="absolute top-2 right-2 max-w-[220px] rounded-lg border border-border bg-background/95 px-3 py-2 text-xs shadow-lg z-10" style={{ pointerEvents: 'none' }}>
              <p className="font-semibold text-foreground">{s.label}</p>
              {s.firm && <p className="text-muted-foreground">Firm: {s.firm}</p>}
              {s.position && <p className="text-muted-foreground">Position: {s.position}</p>}
              {s.score != null && <p className="text-muted-foreground">Score: {s.score}</p>}
              <p className="text-muted-foreground mt-1">Connected to: {s.connected_to.map((c) => c.name).join(', ')}</p>
            </div>
          )
        })()}
        <p className="absolute bottom-2 left-2 right-2 text-center text-[10px] text-white/70">
          Shows all investors and their shared connections. Hover over shared connections to see which investors share them.
        </p>
      </div>

      {/* Detail panel - hidden in fullscreen so graph fills */}
      {!fullscreen && (
      <Card className="flex-1 min-w-0">
        <CardContent className="pt-4">
          {selectedSuggestion ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{selectedSuggestion.label}</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSuggestion(null)}>
                  Close
                </Button>
              </div>
              <div className="text-sm space-y-2 text-muted-foreground">
                {selectedSuggestion.position && <p>Position: {selectedSuggestion.position}</p>}
                {selectedSuggestion.firm && <p>Firm: {selectedSuggestion.firm}</p>}
                {selectedSuggestion.location && <p>Location: {selectedSuggestion.location}</p>}
                {selectedSuggestion.score != null && <p>Score: {selectedSuggestion.score}</p>}
                <p className="font-medium text-foreground">
                  Connected to {selectedSuggestion.connection_count} investor(s):{' '}
                  {selectedSuggestion.connected_to.map((c) => `${c.name}${c.reasons?.length ? ` (${c.reasons.join(', ')})` : ''}`).join(', ')}
                </p>
              </div>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link
                  to={buildTargetedInvestorAddUrl(companyId, selectedSuggestion.label, selectedSuggestion.location)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add to targeted investors
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Hover investors or suggestions to highlight connections. Click a suggestion to see details.
            </p>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  )
}
