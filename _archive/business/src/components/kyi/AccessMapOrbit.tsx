import { useState, useEffect, useCallback } from 'react'
import { useMapViewport } from '@/components/kyi/use-map-viewport'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Loader2, Home } from 'lucide-react'
import {
  getAccessMap,
  getSolarNetworkInvestors,
  getSolarNetworkNode,
  type AccessMapNode,
  type AccessMapOverlap,
  type AccessMapEdge,
} from '@/lib/kyi-api'

const ORBIT_RADIUS = 165
const CENTER_R = 52
const NODE_R_NORMAL = 26
const NODE_R_FULLSCREEN = 30

/** Center can be the company (virtual) or a stored node (investor/person/org). */
type CenterNode =
  | (AccessMapNode & { id: number })
  | { id: 'company'; label: string; node_type: 'company'; meta: Record<string, unknown> }

/** Breadcrumb entry for Back/Home: company or a node id we can load. */
type BreadcrumbEntry = { id: number | 'company'; label: string; node_type: string }

function getInitials(label: string): string {
  const parts = (label || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (label || '?').slice(0, 2).toUpperCase()
}

/** Truncate for center node display per spec: max 12 chars */
function truncateCenterLabel(label: string, maxLen = 12): string {
  const s = (label || '').trim()
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen - 2) + '..'
}

/** Orbit node label: initials (first letter of first 3 words) or first 5 chars for single word (ORBIT 5.6) */
function getNodeDisplayText(label: string): string {
  const parts = (label || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 3) return (parts[0][0] + parts[1][0] + parts[2][0]).toUpperCase()
  if (parts.length === 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 5).toUpperCase()
  return '?'
}

function nodeColor(nodeType: string): string {
  if (nodeType === 'company') return '#0ea5e9'
  if (nodeType === 'investor') return '#7c5cff'
  if (nodeType === 'person') return '#3b82f6'
  return '#22c55e'
}

function isCompanyCenter(center: CenterNode): center is { id: 'company'; label: string; node_type: 'company'; meta: Record<string, unknown> } {
  return center.id === 'company'
}

const DEFAULT_MAX_VISIBLE_NODES = 24
const FULLSCREEN_MAX_VISIBLE_NODES = 85

interface AccessMapOrbitProps {
  companyId: number
  companyName: string
  maxVisibleNodes?: number
  fullscreen?: boolean
  /** Fills parent card height (company tab) instead of fixed aspect-ratio box */
  embedded?: boolean
}

export function AccessMapOrbit({
  companyId,
  companyName,
  maxVisibleNodes = DEFAULT_MAX_VISIBLE_NODES,
  fullscreen = false,
  embedded = false,
}: AccessMapOrbitProps) {
  const NODE_R = fullscreen ? NODE_R_FULLSCREEN : NODE_R_NORMAL
  const [mapData, setMapData] = useState<{ metrics: Record<string, number>; overlap: AccessMapOverlap } | null>(null)
  const [center, setCenter] = useState<CenterNode | null>(null)
  const [connections, setConnections] = useState<AccessMapNode[]>([])
  const [edges, setEdges] = useState<{ from_node_id: number; to_node_id: number }[]>([])
  const [mapNodes, setMapNodes] = useState<AccessMapNode[]>([])
  const [mapEdges, setMapEdges] = useState<AccessMapEdge[]>([])
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([])
  const [homeInvestors, setHomeInvestors] = useState<AccessMapNode[]>([])
  const [hoverNode, setHoverNode] = useState<AccessMapNode | null>(null)
  const [showMutual, setShowMutual] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildMessage, setRebuildMessage] = useState<string | null>(null)
  const [rebuildError, setRebuildError] = useState<string | null>(null)
  const [allConnectionsOpen, setAllConnectionsOpen] = useState(false)
  const { mapContainerRef, zoomK, panOffset, resetViewport } = useMapViewport()

  const virtualCompany = useCallback((): CenterNode => ({
    id: 'company',
    label: companyName,
    node_type: 'company',
    meta: {},
  }), [companyName])

  const loadNodeView = useCallback(
    async (nodeId: number) => {
      setLoading(true)
      setError(null)
      try {
        const res = await getSolarNetworkNode(companyId, nodeId)
        if (res.center) {
          const meta = res.center.meta_json
            ? (() => {
                try {
                  return JSON.parse(res.center.meta_json as string) as Record<string, unknown>
                } catch {
                  return {}
                }
              })()
            : {}
          setCenter({ ...res.center, meta })
        } else {
          setCenter(null)
        }
        setConnections(
          (res.connections || []).map((n) => ({
            ...n,
            meta: n.meta_json ? (() => {
              try {
                return JSON.parse(n.meta_json as string) as Record<string, unknown>
              } catch {
                return {}
              }
            })() : {},
          })),
        )
        setEdges(res.edges || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    },
    [companyId],
  )

  const showHomeView = useCallback(() => {
    setBreadcrumb([])
    setCenter(virtualCompany())
    setConnections(homeInvestors)
    setEdges([])
  }, [virtualCompany, homeInvestors])

  const loadInitial = useCallback(async () => {
    resetViewport()
    setLoading(true)
    setError(null)
    try {
      const map = await getAccessMap(companyId)
      setMapData({
        metrics: map.metrics || {},
        overlap: map.overlap || {
          unique_people_count: 0,
          unique_org_count: 0,
          overlap_people_count: 0,
          overlap_org_count: 0,
          overlap_percentage: 0,
          top_overlapping_people: [],
          top_overlapping_orgs: [],
        },
      })
      setMapNodes(map.nodes || [])
      setMapEdges(map.edges || [])
      const solar = await getSolarNetworkInvestors(companyId)
      const investors = solar.investors || []
      setHomeInvestors(investors)
      if (investors.length === 0) {
        setCenter(null)
        setConnections([])
        setEdges([])
        setLoading(false)
        return
      }
      // Original KYI: multiple investors → company at center, investors in first ring; one investor → zoom into them
      if (investors.length === 1) {
        await loadNodeView(investors[0].id)
        return
      }
      // Home = virtual company center + investors as orbits only (per ACCESS_MAP_PAGE_SPEC 5.3)
      setCenter(virtualCompany())
      setConnections(investors)
      setEdges([])
      setBreadcrumb([])
      setLoading(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load access map')
      setLoading(false)
    }
  }, [companyId, virtualCompany, resetViewport])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await loadInitial()
    })()
    return () => {
      cancelled = true
    }
  }, [loadInitial])

  const handleRebuildNetwork = async () => {
    setRebuilding(true)
    setRebuildMessage(null)
    setRebuildError(null)
    try {
      await loadInitial()
      setRebuildMessage('Network rebuilt from current public-records dataset.')
    } catch (e) {
      setRebuildError(e instanceof Error ? e.message : 'Failed to rebuild network. Try again shortly.')
    } finally {
      setRebuilding(false)
    }
  }


  const handleNodeClick = (node: AccessMapNode) => {
    if (!center || node.id === (center as AccessMapNode).id) return
    if (isCompanyCenter(center)) {
      setBreadcrumb((prev) => [...prev, { id: 'company', label: companyName, node_type: 'company' }])
    } else {
      setBreadcrumb((prev) => [...prev, { id: (center as AccessMapNode).id, label: center.label, node_type: center.node_type }])
    }
    loadNodeView(node.id)
  }

  const handleBack = () => {
    if (breadcrumb.length === 0) return
    const prev = breadcrumb[breadcrumb.length - 1]
    setBreadcrumb((b) => b.slice(0, -1))
    if (prev.id === 'company') {
      showHomeView()
    } else {
      loadNodeView(prev.id)
    }
  }

  const numConnections = connections.length
  const cap = Math.max(1, maxVisibleNodes)
  const visibleConnections = connections.slice(0, cap)
  const overflowCount = Math.max(0, numConnections - cap)
  const isHome = !!center && isCompanyCenter(center)

  // Compute orbit positions from visible connections. In home view we use two rings: inner = investors, outer = suggested people.
  const orbitPositions = (() => {
    const n = visibleConnections.length
    if (!n) return [] as { x: number; y: number }[]

    // When zoomed into a node (non-home), only position the capped visible connections
    if (!isHome) {
      return visibleConnections.map((_, i) => {
        const angle = (i / Math.max(n, 1)) * 2 * Math.PI - Math.PI / 2
        return {
          x: ORBIT_RADIUS * Math.cos(angle),
          y: ORBIT_RADIUS * Math.sin(angle),
        }
      })
    }

    // Home view: inner ring = investors, outer ring = suggested people / orgs.
    // Positions are computed from the full connection set, then sampled for the visible subset.
    const inner = connections.filter((node) => node.node_type === 'investor')
    const outer = connections.filter((node) => node.node_type !== 'investor')
    const innerRadius = ORBIT_RADIUS * 0.65
    const outerRadius = ORBIT_RADIUS + 32

    const innerPositions = new Map<number, { x: number; y: number }>()
    inner.forEach((node, idx) => {
      const angle = (idx / Math.max(inner.length, 1)) * 2 * Math.PI - Math.PI / 2
      innerPositions.set(node.id, {
        x: innerRadius * Math.cos(angle),
        y: innerRadius * Math.sin(angle),
      })
    })

    const outerPositions = new Map<number, { x: number; y: number }>()
    outer.forEach((node, idx) => {
      const angle = (idx / Math.max(outer.length, 1)) * 2 * Math.PI - Math.PI / 2
      outerPositions.set(node.id, {
        x: outerRadius * Math.cos(angle),
        y: outerRadius * Math.sin(angle),
      })
    })

    return visibleConnections.map((node) => {
      if (node.node_type === 'investor') {
        return innerPositions.get(node.id) || { x: 0, y: 0 }
      }
      return outerPositions.get(node.id) || { x: 0, y: 0 }
    })
  })()

  const connectionInfo = (node: AccessMapNode) => {
    const meta = node.meta || (node as AccessMapNode & { meta?: Record<string, unknown> }).meta as Record<string, unknown> | undefined
    if (!meta) return null
    const parts: string[] = []
    if (meta.firm) parts.push(String(meta.firm))
    if (meta.title) parts.push(String(meta.title))
    if (typeof meta.shared_investors_count === 'number' && meta.shared_investors_count > 0) {
      parts.push(`Shared by ${meta.shared_investors_count} investor(s)`)
    }
    if (meta.position) parts.push(String(meta.position))
    if (meta.location) parts.push(String(meta.location))
    return parts.length ? parts.join(' · ') : null
  }

  // Position of a node by id (center is at 0,0 when zoomed into an investor)
  const getPositionByNodeId = (nodeId: number): { x: number; y: number } | null => {
    if (!center || visibleConnections.length === 0) return null
    if (!isCompanyCenter(center) && (center as AccessMapNode).id === nodeId) return { x: 0, y: 0 }
    const idx = visibleConnections.findIndex((c) => c.id === nodeId)
    if (idx < 0 || !orbitPositions[idx]) return null
    return orbitPositions[idx]
  }

  // When hovering a node, show lines to every node it's connected to (so you see HOW they're connected)
  const hoverRelationshipLines = (() => {
    if (!hoverNode || connections.length === 0) return []
    const fromPos = getPositionByNodeId(hoverNode.id)
    if (!fromPos) return []
    const used = new Set<string>()
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
    const edgeList = isHome ? mapEdges : edges
    for (const edge of edgeList) {
      const fromId = edge.from_node_id
      const toId = edge.to_node_id
      if (fromId !== hoverNode.id && toId !== hoverNode.id) continue
      const otherId = fromId === hoverNode.id ? toId : fromId
      const key = [fromId, toId].sort().join('-')
      if (used.has(key)) continue
      used.add(key)
      const isCenterNode = !isHome && center && !isCompanyCenter(center) && (center as AccessMapNode).id === otherId
      const toPos = isCenterNode ? { x: 0, y: 0 } : getPositionByNodeId(otherId)
      if (toPos) {
        lines.push({ x1: fromPos.x, y1: fromPos.y, x2: toPos.x, y2: toPos.y })
      }
    }
    return lines
  })()

  // Node IDs that are connected to the hovered node (so we can light them up as "mutual" and "overlapping" connections)
  const hoverConnectedIds = (() => {
    if (!hoverNode || connections.length === 0) return new Set<number>()
    const ids = new Set<number>()
    const edgeList = isHome ? mapEdges : edges
    for (const edge of edgeList) {
      if (edge.from_node_id === hoverNode.id) ids.add(edge.to_node_id)
      if (edge.to_node_id === hoverNode.id) ids.add(edge.from_node_id)
    }
    return ids
  })()

  const breadcrumbLabels = [
    'Home',
    ...breadcrumb.map((b) => b.label),
  ]
  const currentFocusLabel = center ? (isCompanyCenter(center) ? companyName : center.label) : ''
  const breadcrumbText = breadcrumbLabels.join(' › ')

  const fillLayout = fullscreen || embedded

  return (
    <div className={fillLayout ? 'flex flex-col flex-1 min-h-0 h-full' : 'space-y-4'}>
      {/* Nav: Back, Home, current focus (reference style) - compact when fullscreen */}
      <div className={`flex flex-wrap items-center gap-2 shrink-0 ${fillLayout ? 'py-1' : ''}`}>
        {breadcrumb.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleBack} className="bg-white/5 border-white/20 text-white hover:bg-white/10">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
        {(breadcrumb.length > 0 || (center && !isCompanyCenter(center))) && (
          <Button variant="outline" size="sm" onClick={showHomeView} className="bg-white/5 border-white/20 text-white hover:bg-white/10">
            <Home className="w-4 h-4 mr-1" />
            Home
          </Button>
        )}
        {currentFocusLabel && (
          <Button
            variant="secondary"
            size="sm"
            className="bg-primary text-primary-foreground rounded-md pointer-events-none"
            title={breadcrumbText}
          >
            {truncateCenterLabel(currentFocusLabel)}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRebuildNetwork}
          disabled={rebuilding}
        >
          {rebuilding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Build network
        </Button>
      </div>
      {rebuildMessage && (
        <p className="text-xs text-emerald-500">{rebuildMessage}</p>
      )}
      {rebuildError && (
        <p className="text-xs text-red-500">{rebuildError}</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
        {loading && !center ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
      ) : center ? (
        <div
          className={
            fillLayout
              ? 'flex flex-1 min-h-0 min-w-0 gap-3 flex-col lg:flex-row'
              : 'flex flex-col lg:flex-row gap-6 flex-1 min-h-0'
          }
        >
          <div
            ref={mapContainerRef}
            className={`relative rounded-xl border border-border kyi-network-map-bg flex items-center justify-center min-h-0 ${
              fillLayout ? 'flex-1 min-h-[320px] w-full' : 'flex-1 aspect-square max-h-[min(60vh,600px)]'
            }`}
          >
              <svg
                viewBox="-210 -210 420 420"
                className="overflow-visible"
                width="100%"
                height="100%"
                preserveAspectRatio="xMidYMid meet"
              >
                <g transform={`translate(${panOffset.x / zoomK},${panOffset.y / zoomK}) scale(${zoomK})`}>
                  <circle
                    cx={0}
                    cy={0}
                    r={ORBIT_RADIUS}
                    fill="none"
                    className="stroke-border"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    opacity={0.85}
                  />
                  {isHome && (
                    <>
                      <circle
                        cx={0}
                        cy={0}
                        r={ORBIT_RADIUS * 0.65}
                        fill="none"
                        className="stroke-border"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        opacity={0.85}
                      />
                      <circle
                        cx={0}
                        cy={0}
                        r={ORBIT_RADIUS + 32}
                        fill="none"
                        className="stroke-border"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        opacity={0.85}
                      />
                    </>
                  )}
                  {visibleConnections.map((conn, i) => {
                    const pos = orbitPositions[i]
                    if (!pos) return null
                    const isActive = hoverNode?.id === conn.id
                    return (
                      <line
                        key={`e-${conn.id}`}
                        x1={0}
                        y1={0}
                        x2={pos.x}
                        y2={pos.y}
                        className={isActive ? 'stroke-amber-400' : 'stroke-muted-foreground/45'}
                        strokeWidth={isActive ? 2 : 1.1}
                        opacity={isActive ? 0.95 : 0.65}
                      />
                    )
                  })}
                  {hoverRelationshipLines.map((line, idx) => (
                    <line
                      key={`hover-rel-${idx}`}
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      stroke="rgba(250, 204, 21, 0.95)"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                    />
                  ))}
                  {visibleConnections.map((node, i) => {
                    const pos = orbitPositions[i]
                    if (!pos) return null
                    const meta = node.meta as Record<string, unknown> | undefined
                    const isMutualPerson =
                      node.node_type === 'person' &&
                      meta &&
                      typeof meta.shared_investors_count === 'number' &&
                      (meta.shared_investors_count as number) >= 2
                    const isHovered = hoverNode?.id === node.id
                    const isConnectedToHover = hoverNode ? hoverConnectedIds.has(node.id) : false
                    const isOverlappingConnection = isConnectedToHover && isMutualPerson
                    let fill = isMutualPerson ? '#f59e0b' : nodeColor(node.node_type)
                    if (isHovered) fill = nodeColor(node.node_type)
                    if (isOverlappingConnection) fill = '#fbbf24'
                    if (isConnectedToHover && !isOverlappingConnection) fill = '#93c5fd'
                    const stroke = isHovered || isConnectedToHover ? '#fff' : '#1a1a24'
                    const sw = isHovered ? 2.5 : isConnectedToHover ? 2.2 : 2
                    const r = isOverlappingConnection ? NODE_R + 2 : isHovered ? NODE_R + 1 : NODE_R
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${pos.x},${pos.y})`}
                        onMouseEnter={() => setHoverNode(node)}
                        onMouseLeave={() => setHoverNode(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          cx={0}
                          cy={0}
                          r={r}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={sw}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleNodeClick(node)
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <text
                          x={0}
                          y={0}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize={r > NODE_R ? 11 : 10}
                          fontWeight="600"
                          pointerEvents="none"
                        >
                          {getNodeDisplayText(node.label)}
                        </text>
                      </g>
                    )
                  })}
                  <g
                    onClick={() => connections.length > 0 && setAllConnectionsOpen(true)}
                    style={{ cursor: connections.length > 0 ? 'pointer' : 'default' }}
                  >
                    <circle
                      cx={0}
                      cy={0}
                      r={CENTER_R}
                      fill={nodeColor(center.node_type)}
                      stroke="#1a1a24"
                      strokeWidth={2}
                    />
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={isCompanyCenter(center) ? 9 : 11}
                      fontWeight="700"
                      pointerEvents="none"
                    >
                      {isCompanyCenter(center) ? truncateCenterLabel(companyName) : truncateCenterLabel(center.label)}
                    </text>
                  </g>
                </g>
                </svg>
            {/* Footer instruction - in fullscreen also show center name in footer */}
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-muted-foreground">
              {fullscreen
                ? `Center: ${isCompanyCenter(center) ? companyName : center.label} • Click any orbiting node to zoom into their connections.`
                : 'Click any orbiting node to zoom into their connections. The center node shows the current focus.'}
            </p>
            {/* Hover info tooltip on canvas */}
            {hoverNode && (
              <div
                className="absolute top-2 right-2 max-w-[200px] rounded-lg border border-border bg-background/95 px-3 py-2 text-xs shadow-lg z-10"
                style={{ pointerEvents: 'none' }}
              >
                <p className="font-semibold text-foreground">{hoverNode.label}</p>
                <p className="text-muted-foreground capitalize">{hoverNode.node_type}</p>
                {connectionInfo(hoverNode) && (
                  <p className="text-muted-foreground mt-1 border-t border-border pt-1">{connectionInfo(hoverNode)}</p>
                )}
              </div>
            )}
          </div>
          {!fullscreen && (
            <div
              className={`shrink-0 min-w-0 space-y-2 overflow-y-auto ${
                embedded ? 'lg:w-56 xl:w-64 max-h-[180px] lg:max-h-full lg:flex-1 lg:min-h-0' : 'lg:w-72 xl:w-80 lg:max-h-[500px]'
              }`}
            >
              <p className="font-medium text-muted-foreground">
                Center: {isCompanyCenter(center) ? companyName : center.label}
              </p>
              <p className="text-sm text-muted-foreground">
                Click any orbiting node to zoom into their connections. The center node shows the current focus.
              </p>
              {overflowCount > 0 && (
                <button
                  type="button"
                  onClick={() => setAllConnectionsOpen(true)}
                  className="rounded-full bg-primary/20 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/30"
                >
                  +{overflowCount} more
                </button>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {visibleConnections.map((node) => {
                  const info = connectionInfo(node)
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => handleNodeClick(node)}
                      onMouseEnter={() => setHoverNode(node)}
                      onMouseLeave={() => setHoverNode(null)}
                      className="text-left px-3 py-2 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 text-sm transition-colors"
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: nodeColor(node.node_type) }}
                      />
                      <span className="font-medium">{node.label}</span>
                      {info && <p className="text-xs text-muted-foreground mt-0.5 ml-4">{info}</p>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground py-8 text-center max-w-md mx-auto">
          No network data yet. Upload your personal connections under{' '}
          <span className="font-medium text-foreground">Contacts → My network</span>, add investors,
          then use <span className="font-medium">Build network</span> above to generate the access map.
        </p>
      )}
      {!fullscreen && allConnectionsOpen && center && (
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">
              All Connections for {center.label} ({connections.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setAllConnectionsOpen(false)}>
              Close
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {connections.map((node) => {
              const info = connectionInfo(node)
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    handleNodeClick(node)
                    setAllConnectionsOpen(false)
                  }}
                  onMouseEnter={() => setHoverNode(node)}
                  onMouseLeave={() => setHoverNode(null)}
                  className="text-left px-3 py-2 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/50 text-sm transition-colors"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0"
                    style={{ backgroundColor: nodeColor(node.node_type) }}
                  />
                  <span className="font-medium">{node.label}</span>
                  {info && <p className="text-xs text-muted-foreground mt-0.5 ml-4">{info}</p>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
