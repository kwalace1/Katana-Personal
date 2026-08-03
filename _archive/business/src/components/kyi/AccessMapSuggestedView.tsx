import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useMapViewport } from '@/components/kyi/use-map-viewport'
import { Loader2, Search, MapPin, Star, UserPlus, ChevronDown, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildTargetedInvestorAddUrl,
  getCompanyAggregatedLeads,
  type CompanyAggregatedLeadsResponse,
  type AggregatedLead,
} from '@/lib/kyi-api'

const COMPANY_R = 30
const INVESTOR_R = 20
/** Uniform lead bubble radius — large enough to read initials. */
const ORBIT_LEAD_NODE_R = 11
const INNER_RING = 90
const ORBIT_BASE = 148
const RING_GAP = 42
const PER_RING = 18
/** Cap orbit nodes — keeps SVG DOM + hover work bounded. */
const MAX_VISIBLE = 60

/**
 * Orbit SVG caps at MAX_VISIBLE nodes. A plain score sort leaves small investors (e.g. few
 * geo hits) with zero visible leads. Round-robin across investors after multi-investor rows.
 */
function fairOrbitLeadSample(
  leads: AggregatedLead[],
  investorIdsOrdered: number[],
  maxN: number,
): AggregatedLead[] {
  const multi = leads.filter((l) => l.from_investors.length > 1)
  const single = leads.filter((l) => l.from_investors.length === 1)

  const queues = new Map<number, AggregatedLead[]>()
  for (const id of investorIdsOrdered) queues.set(id, [])
  for (const l of single) {
    const id = l.from_investors[0]?.id
    if (id != null && queues.has(id)) queues.get(id)!.push(l)
  }
  for (const id of investorIdsOrdered) {
    queues.get(id)!.sort((a, b) => b.raw_score - a.raw_score)
  }

  const out: AggregatedLead[] = []
  const seen = new Set<number>()

  for (const l of multi) {
    if (out.length >= maxN) break
    out.push(l)
    seen.add(l.id)
  }

  let roundIds = investorIdsOrdered.filter((id) => (queues.get(id)?.length ?? 0) > 0)
  let ri = 0
  let noProgress = 0
  while (out.length < maxN && roundIds.length > 0) {
    const id = roundIds[ri % roundIds.length]
    const q = queues.get(id)!
    const next = q.shift()
    if (next && !seen.has(next.id)) {
      out.push(next)
      seen.add(next.id)
      noProgress = 0
    } else {
      noProgress++
      if (noProgress > roundIds.length * 8) break
    }
    roundIds = investorIdsOrdered.filter((i) => (queues.get(i)?.length ?? 0) > 0)
    if (roundIds.length === 0) break
    ri = (ri + 1) % roundIds.length
  }

  if (out.length < maxN) {
    const rest = leads
      .filter((l) => !seen.has(l.id))
      .sort((a, b) => {
        const d = b.from_investors.length - a.from_investors.length
        return d !== 0 ? d : b.raw_score - a.raw_score
      })
    for (const l of rest) {
      if (out.length >= maxN) break
      out.push(l)
      seen.add(l.id)
    }
  }

  return out
}

function sortByMultiThenScore(a: AggregatedLead, b: AggregatedLead): number {
  const d = b.from_investors.length - a.from_investors.length
  return d !== 0 ? d : b.raw_score - a.raw_score
}

/**
 * Reorder leads so each SVG ring (chunks of `perRing`) is one color: amber multi-investor
 * ring(s) first, then one investor per ring cycling Kevin → … in roster order.
 */
function reorderForMonoColorRings(
  picked: AggregatedLead[],
  investorsOrdered: Array<{ id: number }>,
  perRing: number,
): AggregatedLead[] {
  const multi = picked.filter((l) => l.from_investors.length > 1).sort(sortByMultiThenScore)
  const singleByInv = new Map<number, AggregatedLead[]>()
  for (const inv of investorsOrdered) singleByInv.set(inv.id, [])
  for (const l of picked) {
    if (l.from_investors.length !== 1) continue
    const id = l.from_investors[0].id
    singleByInv.get(id)?.push(l)
  }
  for (const inv of investorsOrdered) {
    singleByInv.get(inv.id)!.sort((a, b) => b.raw_score - a.raw_score)
  }

  const out: AggregatedLead[] = []
  for (let i = 0; i < multi.length; i += perRing) {
    out.push(...multi.slice(i, i + perRing))
  }

  const invIds = investorsOrdered.map((i) => i.id)
  let invPtr = 0
  let guard = 0
  const maxGuard = picked.length * 6 + 64

  while (out.length < picked.length && guard < maxGuard) {
    guard++
    const id = invIds[invPtr % invIds.length]
    const q = singleByInv.get(id) ?? []
    const slots = Math.min(perRing, picked.length - out.length, q.length)
    if (slots > 0) {
      for (let k = 0; k < slots; k++) out.push(q.shift()!)
      invPtr++
      continue
    }
    const anyLeft = invIds.some((i) => (singleByInv.get(i)?.length ?? 0) > 0)
    if (!anyLeft) break
    invPtr++
  }

  const placed = new Set(out.map((l) => l.id))
  for (const l of picked) {
    if (!placed.has(l.id)) out.push(l)
  }
  return out
}

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name || '?').slice(0, 2).toUpperCase()
}

function truncateLabel(label: string, max = 12): string {
  const s = (label || '').trim()
  return s.length <= max ? s : s.slice(0, max - 2) + '..'
}

type SuggestedInvestor = { id: number; full_name: string; lead_count: number; color: string }

function SuggestedFilterBar({
  data,
  investors,
  filterInvestor,
  onFilterInvestor,
  filterType,
  onFilterType,
  searchQuery,
  onSearchQuery,
  filteredCount,
  personCount,
  firmCount,
}: {
  data: CompanyAggregatedLeadsResponse
  investors: SuggestedInvestor[]
  filterInvestor: number | null
  onFilterInvestor: (id: number | null) => void
  filterType: 'all' | 'person' | 'firm'
  onFilterType: (t: 'all' | 'person' | 'firm') => void
  searchQuery: string
  onSearchQuery: (q: string) => void
  filteredCount: number
  personCount: number
  firmCount: number
}) {
  return (
    <div className="shrink-0 rounded-lg border border-border bg-card px-3 py-2.5 space-y-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex flex-1 min-w-0 flex-wrap items-center gap-2">
          <Select
            value={filterInvestor == null ? 'all' : String(filterInvestor)}
            onValueChange={(v) => onFilterInvestor(v === 'all' ? null : Number(v))}
          >
            <SelectTrigger className="h-8 w-[min(100%,200px)] bg-background border-input text-foreground text-xs">
              <SelectValue placeholder="Investor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All investors ({investors.length})</SelectItem>
              {investors.map((inv) => (
                <SelectItem key={inv.id} value={String(inv.id)}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: inv.color }}
                    />
                    {inv.full_name.split(' ')[0]} ({inv.lead_count})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border border-border overflow-hidden divide-x divide-border shrink-0">
            {(
              [
                ['all', `All (${filteredCount})`],
                ['person', `People (${personCount})`],
                ['firm', `Firms (${firmCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onFilterType(key)}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  filterType === key
                    ? 'bg-primary/15 text-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:w-56 lg:shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => onSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-background border border-input text-foreground text-xs placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        <span className="font-medium text-foreground">{data.total_unique.toLocaleString()} suggested</span>
        {' '}from {investors.length} investors&apos; geo areas.
        {data.multi_investor_count > 0 && (
          <span className="text-amber-600 dark:text-amber-400"> {data.multi_investor_count} shared by 2+ investors.</span>
        )}
      </p>
    </div>
  )
}

interface AccessMapSuggestedViewProps {
  companyId: number
  companyName: string
  fullscreen?: boolean
  embedded?: boolean
}

export function AccessMapSuggestedView({
  companyId,
  companyName,
  fullscreen = false,
  embedded = false,
}: AccessMapSuggestedViewProps) {
  const [data, setData] = useState<CompanyAggregatedLeadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterInvestor, setFilterInvestor] = useState<number | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'person' | 'firm'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLead, setSelectedLead] = useState<AggregatedLead | null>(null)
  const [hoverLead, setHoverLead] = useState<AggregatedLead | null>(null)
  const [hoverInvestorId, setHoverInvestorId] = useState<number | null>(null)
  const [legendOpen, setLegendOpen] = useState(false)
  const { mapContainerRef, zoomK, panOffset } = useMapViewport()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getCompanyAggregatedLeads(companyId)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [companyId])

  const filteredLeads = useMemo(() => {
    if (!data) return []
    let list = data.leads
    if (filterInvestor != null) {
      list = list.filter((l) => l.from_investors.some((fi) => fi.id === filterInvestor))
    }
    if (filterType !== 'all') {
      list = list.filter((l) => l.entity_type === filterType)
    }
    return list
  }, [data, filterInvestor, filterType])

  const investors = data?.investors ?? []

  const orbitDisplayLeads = useMemo(() => {
    let picked: AggregatedLead[]
    if (filteredLeads.length <= MAX_VISIBLE) {
      picked = [...filteredLeads].sort(sortByMultiThenScore)
    } else {
      const order = investors.map((i) => i.id)
      picked = fairOrbitLeadSample(filteredLeads, order, MAX_VISIBLE)
    }
    return reorderForMonoColorRings(picked, investors, PER_RING)
  }, [filteredLeads, investors])

  const investorNodes = useMemo(() => {
    const count = Math.max(investors.length, 1)
    return investors.map((inv, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2
      return {
        ...inv,
        x: INNER_RING * Math.cos(angle),
        y: INNER_RING * Math.sin(angle),
        angle,
      }
    })
  }, [investors])

  const orbitNodes = useMemo(() => {
    const visible = orbitDisplayLeads
    return visible.map((lead, i) => {
      const ringIdx = Math.floor(i / PER_RING)
      const posInRing = i % PER_RING
      const ringCount = Math.min(PER_RING, visible.length - ringIdx * PER_RING)
      const radius = ORBIT_BASE + ringIdx * RING_GAP
      const angle = (2 * Math.PI * posInRing) / ringCount - Math.PI / 2
      return {
        lead,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        r: ORBIT_LEAD_NODE_R,
      }
    })
  }, [orbitDisplayLeads])

  const maxRing = useMemo(() => {
    if (orbitNodes.length === 0) return ORBIT_BASE
    const ringCount = Math.ceil(orbitDisplayLeads.length / PER_RING)
    return ORBIT_BASE + (ringCount - 1) * RING_GAP
  }, [orbitNodes.length, orbitDisplayLeads.length])

  const searchFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return filteredLeads
    return filteredLeads.filter((l) =>
      [l.display_name, l.entity_type, l.city, l.state, ...l.from_investors.map((fi) => fi.name)]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [filteredLeads, searchQuery])

  const personCount = useMemo(() => filteredLeads.filter((l) => l.entity_type === 'person').length, [filteredLeads])
  const firmCount = useMemo(() => filteredLeads.filter((l) => l.entity_type === 'firm').length, [filteredLeads])


  const investorById = useMemo(() => new Map(investors.map((inv) => [inv.id, inv])), [investors])

  const investorPositionById = useMemo(
    () => new Map(investorNodes.map((inv) => [inv.id, { x: inv.x, y: inv.y, color: inv.color }])),
    [investorNodes],
  )

  const investorColor = useCallback(
    (investorId: number) => investorById.get(investorId)?.color ?? '#6b7280',
    [investorById],
  )

  const ringCount = useMemo(
    () => Math.max(1, Math.ceil(orbitDisplayLeads.length / PER_RING)),
    [orbitDisplayLeads.length],
  )

  /** Only draw edges on hover — avoids thousands of animated lines. */
  const highlightEdges = useMemo(() => {
    const edges: { key: string; x1: number; y1: number; x2: number; y2: number; stroke: string }[] = []
    if (hoverLead) {
      const node = orbitNodes.find((n) => n.lead.id === hoverLead.id)
      if (!node) return edges
      for (const fi of hoverLead.from_investors) {
        const invPos = investorPositionById.get(fi.id)
        if (!invPos) continue
        edges.push({
          key: `hl-${hoverLead.id}-${fi.id}`,
          x1: node.x,
          y1: node.y,
          x2: invPos.x,
          y2: invPos.y,
          stroke: invPos.color,
        })
      }
      return edges
    }
    if (hoverInvestorId != null) {
      const invPos = investorPositionById.get(hoverInvestorId)
      if (!invPos) return edges
      for (const node of orbitNodes) {
        if (!node.lead.from_investors.some((fi) => fi.id === hoverInvestorId)) continue
        edges.push({
          key: `hi-${node.lead.id}-${hoverInvestorId}`,
          x1: node.x,
          y1: node.y,
          x2: invPos.x,
          y2: invPos.y,
          stroke: invPos.color,
        })
      }
    }
    return edges
  }, [hoverLead, hoverInvestorId, orbitNodes, investorPositionById])

  const leadNodeColor = useCallback(
    (lead: AggregatedLead) => {
      if (lead.from_investors.length > 1) return '#f59e0b'
      return investorColor(lead.from_investors[0]?.id ?? 0)
    },
    [investorColor],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 rounded-xl border border-border bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return <p className="text-sm text-red-500 py-4">{error}</p>
  }

  const viewSize = (maxRing + 80) * 2

  const selectedLeadDetail = selectedLead ? (
    <div className="shrink-0 border-b border-border p-3 space-y-2 bg-muted/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: leadNodeColor(selectedLead) }} />
          <p className="font-semibold text-foreground text-sm truncate">{selectedLead.display_name}</p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedLead(null)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p className="capitalize">
          {selectedLead.entity_type} · Fit {selectedLead.fit_percent}%
        </p>
        {(selectedLead.city || selectedLead.state) && (
          <p className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-red-400 shrink-0" />
            {[selectedLead.city, selectedLead.state].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
      <Link
        to={buildTargetedInvestorAddUrl(
          companyId,
          selectedLead.display_name,
          [selectedLead.city, selectedLead.state].filter(Boolean).join(', ') || undefined,
          selectedLead.id,
        )}
        className="inline-flex items-center gap-1.5 text-xs text-[#7c5cff] hover:underline font-medium"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Add to targeted
      </Link>
    </div>
  ) : null

  return (
    <div className={`flex flex-col flex-1 min-h-0 min-w-0 h-full gap-2 ${fullscreen ? 'relative' : ''}`}>
      {!fullscreen && data && (
        <SuggestedFilterBar
          data={data}
          investors={investors}
          filterInvestor={filterInvestor}
          onFilterInvestor={setFilterInvestor}
          filterType={filterType}
          onFilterType={setFilterType}
          searchQuery={searchQuery}
          onSearchQuery={setSearchQuery}
          filteredCount={filteredLeads.length}
          personCount={personCount}
          firmCount={firmCount}
        />
      )}

      <div className="flex flex-1 min-h-0 min-w-0 gap-3 flex-col lg:flex-row">
        {/* Orbit — full canvas, no blocking legend */}
        <div
          ref={mapContainerRef}
          className="relative flex-1 min-h-[280px] min-w-0 rounded-xl border border-border kyi-network-map-bg overflow-hidden flex items-center justify-center"
        >
        <svg
          width="100%"
          height="100%"
          viewBox={`${-viewSize / 2} ${-viewSize / 2} ${viewSize} ${viewSize}`}
          className="overflow-visible block"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={`translate(${panOffset.x / zoomK},${panOffset.y / zoomK}) scale(${zoomK})`}>
            {Array.from({ length: ringCount }, (_, i) => (
              <circle
                key={`ring-${i}`}
                cx={0}
                cy={0}
                r={ORBIT_BASE + i * RING_GAP}
                fill="none"
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.85}
              />
            ))}
            <circle
              cx={0}
              cy={0}
              r={INNER_RING}
              fill="none"
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="6 3"
              opacity={0.5}
            />

            {investorNodes.map((inv) => (
              <line
                key={`inv-center-${inv.id}`}
                x1={0}
                y1={0}
                x2={inv.x}
                y2={inv.y}
                stroke={inv.color}
                strokeWidth={1.2}
                opacity={0.28}
              />
            ))}

            {highlightEdges.map((e) => (
              <line
                key={e.key}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke={e.stroke}
                strokeWidth={1.8}
                opacity={0.75}
              />
            ))}

            {orbitNodes.map((node) => {
              const isHovered = hoverLead?.id === node.lead.id
              const isSelected = selectedLead?.id === node.lead.id
              const isMulti = node.lead.from_investors.length > 1
              const fill = leadNodeColor(node.lead)
              return (
                <g
                  key={node.lead.id}
                  transform={`translate(${node.x},${node.y})`}
                  onMouseEnter={() => setHoverLead(node.lead)}
                  onMouseLeave={() => setHoverLead(null)}
                  onClick={() => setSelectedLead(node.lead)}
                  style={{ cursor: 'pointer' }}
                >
                  {isMulti && (
                    <circle
                      cx={0}
                      cy={0}
                      r={node.r + 3}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={1}
                      opacity={0.45}
                    />
                  )}
                  <circle
                    cx={0}
                    cy={0}
                    r={isHovered ? node.r + 2 : node.r}
                    fill={fill}
                    stroke={isHovered || isSelected ? '#fff' : '#0c1322'}
                    strokeWidth={isHovered || isSelected ? 2 : 1.5}
                  />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={8.5}
                    fontWeight="600"
                    pointerEvents="none"
                  >
                    {getInitials(node.lead.display_name)}
                  </text>
                </g>
              )
            })}

            {investorNodes.map((inv) => {
              const isHovered = hoverInvestorId === inv.id
              const isFiltered = filterInvestor === inv.id
              return (
                <g
                  key={inv.id}
                  transform={`translate(${inv.x},${inv.y})`}
                  onMouseEnter={() => setHoverInvestorId(inv.id)}
                  onMouseLeave={() => setHoverInvestorId(null)}
                  onClick={() => setFilterInvestor((prev) => (prev === inv.id ? null : inv.id))}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={isFiltered ? INVESTOR_R + 2 : isHovered ? INVESTOR_R + 1 : INVESTOR_R}
                    fill={inv.color}
                    stroke={isHovered || isFiltered ? '#fff' : '#0c1322'}
                    strokeWidth={2}
                  />
                  <text
                    x={0}
                    y={-2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={8}
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {inv.full_name.split(' ')[0]}
                  </text>
                  <text
                    x={0}
                    y={8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="rgba(255,255,255,0.6)"
                    fontSize={6}
                    pointerEvents="none"
                  >
                    {inv.lead_count}
                  </text>
                </g>
              )
            })}

            <g>
              <circle cx={0} cy={0} r={COMPANY_R} className="fill-card stroke-border" strokeWidth={2} />
              <text
                x={0}
                y={-3}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground"
                fontSize={9}
                fontWeight="700"
                pointerEvents="none"
              >
                {truncateLabel(companyName, 10)}
              </text>
              <text
                x={0}
                y={9}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                fontSize={7}
                pointerEvents="none"
              >
                company
              </text>
            </g>
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoverLead && !selectedLead && (
            <div
              className="absolute top-3 right-3 max-w-[240px] rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg z-10"
              style={{ pointerEvents: 'none' }}
            >
              <p className="font-semibold text-popover-foreground">{hoverLead.display_name}</p>
              <p className="text-muted-foreground capitalize">{hoverLead.entity_type}</p>
              {(hoverLead.city || hoverLead.state) && (
                <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-red-500" />
                  {[hoverLead.city, hoverLead.state].filter(Boolean).join(', ')}
                </p>
              )}
              <p className="text-muted-foreground mt-0.5">Fit: {hoverLead.fit_percent}%</p>
              {hoverLead.from_investors.length > 1 && (
                <p className="text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {hoverLead.from_investors.length} investor connections
                </p>
              )}
              <p className="text-muted-foreground/80 mt-0.5">
                Via: {hoverLead.from_investors.map((fi) => fi.name.split(' ')[0]).join(', ')}
              </p>
            </div>
          )}

        {hoverInvestorId && !hoverLead && (
            <div
              className="absolute top-3 right-3 max-w-[200px] rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg z-10"
              style={{ pointerEvents: 'none' }}
            >
              <p className="font-semibold text-popover-foreground">
                {investors.find((inv) => inv.id === hoverInvestorId)?.full_name}
              </p>
              <p className="text-muted-foreground">
                {investors.find((inv) => inv.id === hoverInvestorId)?.lead_count ?? 0} leads
              </p>
              <p className="text-muted-foreground/80 mt-0.5">Click to filter</p>
            </div>
          )}

        {/* Collapsible color legend — does not cover the orbit */}
        <div className="absolute bottom-10 left-3 z-10 flex flex-col items-start gap-1 max-w-[calc(100%-1.5rem)]">
          <button
            type="button"
            onClick={() => setLegendOpen((o) => !o)}
            className="flex items-center gap-1 rounded-md border border-border bg-popover/95 px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/50"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${legendOpen ? 'rotate-180' : ''}`} />
            Legend
          </button>
          {legendOpen && (
            <div className="rounded-lg border border-border bg-popover/95 px-2 py-1.5 max-w-full">
              <div className="flex flex-wrap gap-x-2 gap-y-1 max-h-24 overflow-y-auto">
                {investors.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => setFilterInvestor((prev) => (prev === inv.id ? null : inv.id))}
                    className={`inline-flex items-center gap-1 text-[10px] whitespace-nowrap rounded px-1 py-0.5 ${
                      filterInvestor === inv.id
                        ? 'bg-primary/15 text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: inv.color }} />
                    {inv.full_name.split(' ')[0]}
                  </button>
                ))}
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/90 px-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Multi ({data?.multi_investor_count ?? 0})
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-2 left-0 right-0 z-[5] pointer-events-none text-center px-3">
          <p className="text-[10px] text-muted-foreground">
            Scroll zoom · Drag pan · Click orbit or list · Showing {orbitDisplayLeads.length}
            {filteredLeads.length > MAX_VISIBLE ? ` of ${filteredLeads.length}` : ''}
          </p>
        </div>
      </div>

      {/* Lead list panel */}
      {!fullscreen && data && (
        <aside className="flex flex-col w-full lg:w-[min(380px,42%)] lg:max-w-[400px] shrink-0 min-h-[200px] lg:min-h-0 rounded-xl border border-border bg-card overflow-hidden">
          {selectedLeadDetail}
          <div className="shrink-0 px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-foreground">
              Leads ({searchFiltered.length.toLocaleString()})
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1.5">
            {searchFiltered.slice(0, 80).map((lead) => {
              const isActive = selectedLead?.id === lead.id
              const isMulti = lead.from_investors.length > 1
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedLead(isActive ? null : lead)}
                  onMouseEnter={() => setHoverLead(lead)}
                  onMouseLeave={() => setHoverLead(null)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                    isActive
                      ? 'border-primary bg-muted/60'
                      : isMulti
                        ? 'border-amber-500/40 bg-card hover:border-amber-500/60 hover:bg-muted/40'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {isMulti && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#ef4444] text-white mb-1">
                          <Star className="w-3 h-3" />
                          {lead.from_investors.length} INVESTORS
                        </span>
                      )}
                      <p className="font-medium text-[13px] text-foreground truncate">{lead.display_name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{lead.entity_type}</p>
                      {(lead.city || lead.state) && (
                        <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                          {[lead.city, lead.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lead.from_investors.map((fi) => (
                          <span
                            key={fi.id}
                            className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{ backgroundColor: `${investorColor(fi.id)}30`, color: investorColor(fi.id) }}
                          >
                            via {fi.name.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[14px] font-bold text-emerald-600 dark:text-emerald-400">
                        {lead.fit_percent}%
                      </span>
                      <p className="text-[9px] text-muted-foreground">fit</p>
                    </div>
                  </div>
                </button>
              )
            })}
            {searchFiltered.length > 80 && (
              <p className="text-xs text-muted-foreground text-center py-2">Showing 80 of {searchFiltered.length}</p>
            )}
            {searchFiltered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No leads match your filters.</p>
            )}
          </div>
        </aside>
      )}
      </div>

      {/* Fullscreen: floating detail card */}
      <AnimatePresence>
        {fullscreen && selectedLead && (
          <motion.div
            className="absolute bottom-4 left-4 right-4 max-w-md z-20 rounded-xl border border-border bg-card p-4 shadow-2xl mx-auto"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {selectedLeadDetail}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
