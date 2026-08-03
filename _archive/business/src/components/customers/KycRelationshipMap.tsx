import { useEffect, useMemo, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Client } from '@/lib/customer-success-api'
import { getClientRelationshipMap, type KycRelationshipMapData } from '@/lib/kyc-api'
import { useMapViewport } from '@/components/kyi/use-map-viewport'

const CONTACT_COLORS = ['#7c5cff', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6']
const ACTION_COLOR = '#f97316'
const EXTERNAL_COLORS: Record<string, string> = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#38bdf8',
}

interface KycRelationshipMapProps {
  client: Client
  embedded?: boolean
}

function polarToXY(angle: number, radius: number, cx: number, cy: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  }
}

export function KycRelationshipMap({ client, embedded }: KycRelationshipMapProps) {
  const [data, setData] = useState<KycRelationshipMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const { mapContainerRef, zoomK, panOffset, resetViewport } = useMapViewport()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getClientRelationshipMap(client).then((result) => {
      if (cancelled) return
      setData(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [client])

  const layout = useMemo(() => {
    if (!data) return null
    const w = 520
    const h = 400
    const cx = w / 2
    const cy = h / 2
    const contactRadius = Math.min(w, h) * 0.18
    const actionRadius = Math.min(w, h) * 0.32
    const externalRadius = Math.min(w, h) * 0.44

    const contacts = data.contacts.map((c, i) => {
      const angle = (2 * Math.PI * i) / Math.max(data.contacts.length, 1) - Math.PI / 2
      const pos = polarToXY(angle, contactRadius, cx, cy)
      return { ...c, ...pos, color: CONTACT_COLORS[i % CONTACT_COLORS.length], kind: 'contact' as const }
    })

    const actions = data.suggested_actions.map((a, i) => {
      const angle = (2 * Math.PI * i) / Math.max(data.suggested_actions.length, 1) - Math.PI / 2
      const pos = polarToXY(angle, actionRadius, cx, cy)
      return { ...a, ...pos, kind: 'action' as const }
    })

    const external = data.external_nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(data.external_nodes.length, 1) - Math.PI / 2
      const pos = polarToXY(angle, externalRadius, cx, cy)
      return {
        ...n,
        ...pos,
        kind: 'external' as const,
        color: EXTERNAL_COLORS[n.sentiment] ?? EXTERNAL_COLORS.neutral,
      }
    })

    return { w, h, cx, cy, contacts, actions, external }
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading relationship map…
      </div>
    )
  }

  if (!data || !layout) return null

  const hovered =
    hoverId != null
      ? layout.contacts.find((c) => c.id === hoverId) ??
        layout.actions.find((a) => a.id === hoverId) ??
        layout.external.find((n) => n.id === hoverId)
      : null

  return (
    <div className="space-y-3">
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Relationship map</p>
            <p className="text-xs text-muted-foreground">
              Contacts · suggested plays · external signals — scroll to zoom, drag to pan, double-click to reset
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={resetViewport}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={resetViewport}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset view
          </Button>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className="rounded-xl border bg-gradient-to-br from-muted/30 to-muted/10 overflow-hidden touch-none cursor-grab active:cursor-grabbing shadow-inner"
        onDoubleClick={resetViewport}
      >
        <svg
          viewBox={`0 0 ${layout.w} ${layout.h}`}
          className="w-full h-auto min-h-[320px] max-h-[420px]"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomK})`,
            transformOrigin: 'center center',
          }}
        >
          {layout.contacts.map((c) => (
            <line
              key={`line-c-${c.id}`}
              x1={layout.cx}
              y1={layout.cy}
              x2={c.x}
              y2={c.y}
              stroke={c.color}
              strokeOpacity={hoverId === c.id || hoverId === null ? 0.25 : 0.06}
            />
          ))}

          {layout.actions.map((a) => (
            <line
              key={`line-a-${a.id}`}
              x1={layout.cx}
              y1={layout.cy}
              x2={a.x}
              y2={a.y}
              stroke={ACTION_COLOR}
              strokeOpacity={hoverId === a.id || hoverId === null ? 0.15 : 0.04}
              strokeDasharray="4 3"
            />
          ))}

          <circle cx={layout.cx} cy={layout.cy} r={36} fill="#1a1f2e" stroke="#3a4a66" strokeWidth={2} />
          <text
            x={layout.cx}
            y={layout.cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#e2e8f0"
            fontSize={11}
            fontWeight={600}
          >
            {(data.client_name || 'Account').slice(0, 14)}
          </text>

          {layout.contacts.map((c) => (
            <g
              key={c.id}
              onMouseEnter={() => setHoverId(c.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={c.x}
                cy={c.y}
                r={hoverId === c.id ? 16 : 14}
                fill={c.color}
                stroke={c.is_primary ? '#fff' : '#0c1322'}
                strokeWidth={c.is_primary ? 2 : 1}
              />
              <text
                x={c.x}
                y={c.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={9}
                fontWeight={700}
              >
                {c.name
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </text>
            </g>
          ))}

          {layout.actions.map((a) => (
            <g
              key={a.id}
              onMouseEnter={() => setHoverId(a.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={a.x}
                cy={a.y}
                r={a.priority === 'high' ? 10 : 8}
                fill={ACTION_COLOR}
                fillOpacity={hoverId === a.id ? 1 : 0.75}
                stroke="#fff"
                strokeWidth={1}
              />
            </g>
          ))}

          {layout.external.map((n) => (
            <g
              key={n.id}
              onMouseEnter={() => setHoverId(n.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={hoverId === n.id ? 9 : 7}
                fill={n.color}
                fillOpacity={0.85}
                stroke="#fff"
                strokeWidth={1}
              />
            </g>
          ))}
        </svg>

        {hovered && (
          <div className="border-t px-3 py-2 text-xs bg-card">
            {'name' in hovered ? (
              <>
                <p className="font-medium">{hovered.name}</p>
                <p className="text-muted-foreground">
                  {hovered.job_title ?? 'Contact'}
                  {hovered.is_decision_maker ? ' · Decision maker' : ''}
                  {hovered.is_primary ? ' · Primary' : ''}
                </p>
              </>
            ) : 'label' in hovered && hovered.kind === 'external' ? (
              <>
                <p className="font-medium">{hovered.label}</p>
                <p className="text-muted-foreground">External signal · {hovered.category}</p>
              </>
            ) : (
              <>
                <p className="font-medium">{hovered.label}</p>
                <p className="text-muted-foreground">{hovered.reason}</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#7c5cff]" /> Contacts
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#f97316]" /> Suggested plays
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400" /> External signals
        </span>
      </div>
    </div>
  )
}
