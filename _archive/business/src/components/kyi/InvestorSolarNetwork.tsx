import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type { WheelEvent as ReactWheelEvent, PointerEvent as ReactPointerEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, Star, Loader2, Save } from 'lucide-react'
import { getLeadNoteForPair, upsertLeadNote, type KYILead } from '@/lib/kyi-api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const CENTER_R = 40
const NODE_R_MIN = 10
const NODE_R_SCORE = 10
const ORBIT_BASE = 140
const RING_GAP = 50
const ZOOM_EXTENT: [number, number] = [0.3, 3]

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function nodeRadius(score: number): number {
  return NODE_R_MIN + Math.min(1, (score ?? 0) / 60) * NODE_R_SCORE
}

function nodeColor(entityType: string): string {
  return entityType === 'firm' ? '#22c55e' : '#3b82f6'
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

interface InvestorSolarNetworkProps {
  investorName: string
  leads: KYILead[]
  totalCount: number
  /** When set, Orbit detail panel can load/save per-lead notes (kyi_lead_notes). */
  investorId?: number
}

export function InvestorSolarNetwork({ investorName, leads, totalCount, investorId }: InvestorSolarNetworkProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLead, setSelectedLead] = useState<KYILead | null>(null)
  const [hoverLead, setHoverLead] = useState<KYILead | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'person' | 'firm'>('all')
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 })
  const panRef = useRef({ panning: false, lastX: 0, lastY: 0 })

  const [leadNoteText, setLeadNoteText] = useState('')
  const [leadNoteLoading, setLeadNoteLoading] = useState(false)
  const [leadNoteSaving, setLeadNoteSaving] = useState(false)
  const [leadNoteError, setLeadNoteError] = useState<string | null>(null)
  const [leadNoteSavedFlash, setLeadNoteSavedFlash] = useState(false)

  useEffect(() => {
    if (!selectedLead || investorId == null) {
      setLeadNoteText('')
      setLeadNoteError(null)
      return
    }
    let cancelled = false
    setLeadNoteLoading(true)
    setLeadNoteError(null)
    getLeadNoteForPair(investorId, selectedLead.id)
      .then((n) => {
        if (!cancelled) setLeadNoteText(n?.body ?? '')
      })
      .catch((e) => {
        if (!cancelled) setLeadNoteError(e instanceof Error ? e.message : 'Could not load note')
      })
      .finally(() => {
        if (!cancelled) setLeadNoteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedLead, investorId])

  const handleSaveLeadNote = useCallback(async () => {
    if (!selectedLead || investorId == null) return
    setLeadNoteSaving(true)
    setLeadNoteError(null)
    setLeadNoteSavedFlash(false)
    try {
      const row = await upsertLeadNote(investorId, selectedLead.id, leadNoteText)
      setLeadNoteText(row.body)
      setLeadNoteSavedFlash(true)
      window.setTimeout(() => setLeadNoteSavedFlash(false), 2000)
    } catch (e) {
      setLeadNoteError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLeadNoteSaving(false)
    }
  }, [selectedLead, investorId, leadNoteText])

  const filteredLeads = useMemo(() => {
    let list = leads
    if (filterType !== 'all') list = list.filter((l) => l.entity_type === filterType)
    return list
  }, [leads, filterType])

  const orbitNodes = useMemo(() => {
    const cap = Math.min(filteredLeads.length, 60)
    const visible = filteredLeads.slice(0, cap)
    const perRing = 16
    return visible.map((lead, i) => {
      const ringIdx = Math.floor(i / perRing)
      const posInRing = i % perRing
      const ringCount = Math.min(perRing, visible.length - ringIdx * perRing)
      const radius = ORBIT_BASE + ringIdx * RING_GAP
      const angle = (2 * Math.PI * posInRing) / ringCount - Math.PI / 2
      return {
        lead,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        r: nodeRadius(lead.raw_score),
      }
    })
  }, [filteredLeads])

  const maxRing = useMemo(() => {
    if (orbitNodes.length === 0) return ORBIT_BASE
    const perRing = 16
    const ringCount = Math.ceil(Math.min(filteredLeads.length, 60) / perRing)
    return ORBIT_BASE + (ringCount - 1) * RING_GAP
  }, [orbitNodes.length, filteredLeads.length])

  const searchFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return filteredLeads
    return filteredLeads.filter((l) =>
      [l.display_name, l.entity_type, l.city, l.state].join(' ').toLowerCase().includes(q),
    )
  }, [filteredLeads, searchQuery])

  const personCount = leads.filter((l) => l.entity_type === 'person').length
  const firmCount = leads.filter((l) => l.entity_type === 'firm').length

  const handleWheel = useCallback((e: ReactWheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const factor = Math.exp(-e.deltaY * 0.001)
    setZoomTransform((prev) => ({ ...prev, k: clamp(prev.k * factor, ZOOM_EXTENT[0], ZOOM_EXTENT[1]) }))
  }, [])

  const handlePointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* */ }
    panRef.current = { panning: true, lastX: e.clientX, lastY: e.clientY }
  }, [])

  const handlePointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (!panRef.current.panning) return
    const dx = e.clientX - panRef.current.lastX
    const dy = e.clientY - panRef.current.lastY
    panRef.current.lastX = e.clientX
    panRef.current.lastY = e.clientY
    setZoomTransform((prev) => ({ ...prev, x: prev.x + dx / prev.k, y: prev.y + dy / prev.k }))
  }, [])

  const endPan = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current.panning) {
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* */ }
    }
    panRef.current.panning = false
  }, [])

  const handleDoubleClick = useCallback(() => {
    setZoomTransform({ k: 1, x: 0, y: 0 })
  }, [])

  const viewSize = (maxRing + 60) * 2

  return (
    <div className="flex flex-col xl:flex-row xl:items-start gap-4 min-w-0">
      {/* Solar network SVG */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[480px] rounded-xl border border-border overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at center, #0f1729 0%, #070a0f 100%)' }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${-viewSize / 2} ${-viewSize / 2} ${viewSize} ${viewSize}`}
          className="overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          style={{ minHeight: 480 }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerLeave={endPan}
          onDoubleClick={handleDoubleClick}
        >
          <g transform={`scale(${zoomTransform.k}) translate(${zoomTransform.x},${zoomTransform.y})`}>
            {/* Dashed orbit rings */}
            {Array.from({ length: Math.ceil(Math.min(filteredLeads.length, 60) / 16) }).map((_, i) => (
              <motion.circle
                key={`ring-${i}`}
                cx={0}
                cy={0}
                fill="none"
                stroke="#1a2333"
                strokeWidth={1}
                strokeDasharray="4 4"
                initial={{ r: 0, opacity: 0 }}
                animate={{ r: ORBIT_BASE + i * RING_GAP, opacity: 1 }}
                transition={{ duration: 0.7, delay: i * 0.1, ease: 'easeOut' }}
              />
            ))}

            {/* Edges from center to each node */}
            {orbitNodes.map((node) => {
              const isActive = hoverLead?.id === node.lead.id || selectedLead?.id === node.lead.id
              return (
                <motion.line
                  key={`e-${node.lead.id}`}
                  x1={0}
                  y1={0}
                  x2={node.x}
                  y2={node.y}
                  stroke={isActive ? 'rgba(250, 204, 21, 0.7)' : 'rgba(255, 255, 255, 0.08)'}
                  strokeWidth={isActive ? 1.5 : 0.5}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isActive ? 0.7 : 0.08 }}
                  transition={{ duration: 0.3 }}
                />
              )
            })}

            {/* Orbit nodes */}
            <AnimatePresence>
              {orbitNodes.map((node, i) => {
                const isHovered = hoverLead?.id === node.lead.id
                const isSelected = selectedLead?.id === node.lead.id
                const fill = nodeColor(node.lead.entity_type)
                const stroke = isHovered || isSelected ? '#fff' : '#0c1322'
                const sw = isHovered || isSelected ? 2.5 : 1.5
                return (
                  <motion.g
                    key={node.lead.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: 1,
                      scale: isHovered ? 1.25 : 1,
                      x: node.x,
                      y: node.y,
                    }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{
                      opacity: { duration: 0.4, delay: i * 0.015 },
                      scale: { type: 'spring', stiffness: 300, damping: 20 },
                      x: { type: 'spring', stiffness: 80, damping: 15 },
                      y: { type: 'spring', stiffness: 80, damping: 15 },
                    }}
                    onMouseEnter={() => setHoverLead(node.lead)}
                    onMouseLeave={() => setHoverLead(null)}
                    onClick={() => setSelectedLead(node.lead)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle cx={0} cy={0} r={node.r} fill={fill} stroke={stroke} strokeWidth={sw} />
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize={8}
                      fontWeight="600"
                    >
                      {getInitials(node.lead.display_name)}
                    </text>
                  </motion.g>
                )
              })}
            </AnimatePresence>

            {/* Center node — the investor */}
            <motion.g
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            >
              <circle cx={0} cy={0} r={CENTER_R} fill="#7c5cff" stroke="#0c1322" strokeWidth={2} />
              <text x={0} y={-4} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={10} fontWeight="700">
                {truncateLabel(investorName, 10)}
              </text>
              <text x={0} y={10} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.6)" fontSize={8}>
                investor
              </text>
            </motion.g>
          </g>
        </svg>

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoverLead && !selectedLead && (
            <motion.div
              className="absolute top-3 right-3 max-w-[220px] rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs shadow-lg z-10"
              style={{ pointerEvents: 'none' }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <p className="font-semibold text-white">{hoverLead.display_name}</p>
              <p className="text-white/70 capitalize">{hoverLead.entity_type}</p>
              {(hoverLead.city || hoverLead.state) && (
                <p className="text-white/60 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-red-400" />
                  {[hoverLead.city, hoverLead.state].filter(Boolean).join(', ')}
                </p>
              )}
              <p className="text-white/60 mt-0.5">Fit: {hoverLead.fit_percent}%</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend */}
        <div className="absolute top-3 left-3 rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-[10px] text-white/90 z-10">
          <p className="text-[11px] font-bold mb-1">LEGEND</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#7c5cff]" />
              <span>Your Investor (center)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
              <span>Person ({personCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
              <span>Firm ({firmCount})</span>
            </div>
          </div>
          <p className="mt-1 text-[9px] text-white/50">Scroll to zoom · Drag to pan</p>
        </div>

        {/* Status bar */}
        <div className="absolute bottom-3 left-0 right-0 z-10 text-center">
          <p className="text-[10px] text-white/70">
            {totalCount} lead{totalCount !== 1 ? 's' : ''} in your geo area · Showing {Math.min(filteredLeads.length, 60)} · Hover for details
          </p>
        </div>
      </div>

      {/* Side list panel */}
      <div className="w-full xl:w-72 shrink-0 rounded-xl border border-border bg-[#0f1729] p-4 overflow-auto max-h-[560px]">
        <p className="text-sm text-white/90 font-medium mb-1">
          Suggested Investors ({totalCount})
        </p>
        <p className="text-xs text-white/60 mb-3">
          From public records, filtered by your geo targeting area.
        </p>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(['all', 'person', 'firm'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterType === t
                  ? 'bg-[#7c5cff] text-white'
                  : 'bg-[#1f2937] text-white/80 border border-white/15 hover:bg-[#1f2937]/80'
              }`}
            >
              {t === 'all' ? `All (${leads.length})` : t === 'person' ? `People (${personCount})` : `Firms (${firmCount})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search name, city, state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm placeholder:text-white/35"
          />
        </div>

        {/* Lead list */}
        <div className="space-y-1.5">
          {searchFiltered.slice(0, 80).map((lead) => {
            const isActive = selectedLead?.id === lead.id
            return (
              <motion.button
                key={lead.id}
                type="button"
                layout
                onClick={() => setSelectedLead(isActive ? null : lead)}
                onMouseEnter={() => setHoverLead(lead)}
                onMouseLeave={() => setHoverLead(null)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                  isActive
                    ? 'border-[#7c5cff] bg-[#1a2332]'
                    : 'border-[#1f2937] bg-[#0f1729] hover:border-[#3b82f6]/50 hover:bg-[#1a2332]'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[13px] text-[#e8eef7] truncate">{lead.display_name}</p>
                    <p className="text-[11px] text-[#9ca3af] capitalize">{lead.entity_type}</p>
                    {(lead.city || lead.state) && (
                      <p className="flex items-center gap-1 text-[10px] text-white/60 mt-0.5">
                        <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                        {[lead.city, lead.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[14px] font-bold text-[#22c55e]">{lead.fit_percent}%</span>
                    <p className="text-[9px] text-white/40">fit</p>
                  </div>
                </div>
              </motion.button>
            )
          })}
          {searchFiltered.length > 80 && (
            <p className="text-xs text-white/50 text-center py-2">
              Showing 80 of {searchFiltered.length}
            </p>
          )}
          {searchFiltered.length === 0 && (
            <p className="text-xs text-white/50 text-center py-6">No leads match your search.</p>
          )}
        </div>
      </div>

      {/* Detail panel for selected lead */}
      <AnimatePresence>
        {selectedLead && (
          <motion.div
            className="fixed inset-x-4 bottom-4 z-30 max-w-sm max-h-[85vh] overflow-y-auto rounded-xl border border-white/20 bg-[#0f1729] p-4 shadow-2xl xl:static xl:inset-auto xl:w-80 xl:max-w-none xl:shrink-0"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: nodeColor(selectedLead.entity_type) }}
                />
                <p className="font-semibold text-white truncate">{selectedLead.display_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="text-white/60 hover:text-white text-sm shrink-0"
              >
                Close
              </button>
            </div>
            <div className="grid gap-1.5 text-sm text-white/80 mb-3">
              <p>Type: <span className="capitalize">{selectedLead.entity_type}</span></p>
              {(selectedLead.city || selectedLead.state) && (
                <p className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-400" />
                  {[selectedLead.city, selectedLead.state].filter(Boolean).join(', ')}
                </p>
              )}
              <p>
                Fit: <span className="font-bold text-[#22c55e]">{selectedLead.fit_percent}%</span>
              </p>
              {selectedLead.signals && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedLead.signals.fec_donor && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1f2937] text-white/80 border border-white/10">
                      <Star className="w-3 h-3 inline mr-0.5" />FEC Donor
                    </span>
                  )}
                  {selectedLead.signals.sec_form_d && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1f2937] text-white/80 border border-white/10">
                      SEC Form D
                    </span>
                  )}
                  {selectedLead.signals.sec_13f && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1f2937] text-white/80 border border-white/10">
                      SEC 13F
                    </span>
                  )}
                </div>
              )}
            </div>
            {investorId != null && (
              <div className="border-t border-white/10 pt-3 space-y-2">
                <p className="text-xs font-medium text-white/70">Your note on this lead</p>
                {leadNoteError && <p className="text-xs text-red-400">{leadNoteError}</p>}
                {leadNoteLoading ? (
                  <div className="flex py-2 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-white/50" />
                  </div>
                ) : (
                  <>
                    <Textarea
                      rows={4}
                      value={leadNoteText}
                      onChange={(e) => setLeadNoteText(e.target.value)}
                      placeholder="Outreach angle, intro path, follow-up…"
                      className="bg-[#1a1f2e] border-white/15 text-white text-xs resize-y min-h-[80px]"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs"
                        onClick={handleSaveLeadNote}
                        disabled={leadNoteSaving}
                      >
                        {leadNoteSaving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-3 h-3 mr-1 inline" />
                            Save note
                          </>
                        )}
                      </Button>
                      {leadNoteSavedFlash && <span className="text-[10px] text-emerald-400">Saved</span>}
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
