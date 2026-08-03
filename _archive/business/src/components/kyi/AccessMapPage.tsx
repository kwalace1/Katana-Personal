import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Maximize2, Minimize2, Compass, UserPlus, X } from 'lucide-react'
import { getAccessMap, type AccessMapOverlap } from '@/lib/kyi-api'
import { AccessMapOrbit } from '@/components/kyi/AccessMapOrbit'
import { MetricModal } from '@/components/kyi/access-map-metric-modals'
import { AccessMapSuggestedView } from '@/components/kyi/AccessMapSuggestedView'
import { AccessMapOverlapStrip } from '@/components/kyi/AccessMapOverlapStrip'

const FULLSCREEN_MAX_NODES = 85
const DEFAULT_MAX_NODES = 24

type ViewMode = 'explore' | 'suggested'

type MetricKey =
  | 'nodes'
  | 'edges'
  | 'unique_people'
  | 'unique_orgs'
  | 'overlap_people'
  | 'graph_density'
  | 'overlap_percentage'

const METRIC_BAR_ITEMS: {
  key: MetricKey
  label: string
  getValue: (
    metrics: Record<string, number>,
    overlap: AccessMapOverlap | undefined,
  ) => string
}[] = [
  {
    key: 'nodes',
    label: 'Investors',
    getValue: (m) => String(m.investor_count ?? m.node_count ?? 0),
  },
  {
    key: 'edges',
    label: 'Connections',
    getValue: (m) => String(m.edge_count ?? 0),
  },
  {
    key: 'unique_people',
    label: 'People',
    getValue: (_, o) => String(o?.unique_people_count ?? 0),
  },
  {
    key: 'unique_orgs',
    label: 'Organizations',
    getValue: (_, o) => String(o?.unique_org_count ?? 0),
  },
  {
    key: 'overlap_people',
    label: 'Connected',
    getValue: (_, o) => String(o?.overlap_people_count ?? 0),
  },
  {
    key: 'graph_density',
    label: 'Network density',
    getValue: (m, o) =>
      m.graph_density != null
        ? `${Math.round(Number(m.graph_density) * 100)}%`
        : o?.overlap_percentage != null
          ? `${Math.round(o.overlap_percentage)}%`
          : '—',
  },
]

interface AccessMapPageProps {
  companyId: number
  companyName: string
  title?: string
}

export function AccessMapPage({ companyId, companyName, title: _titleProp }: AccessMapPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('explore')
  const [fullscreen, setFullscreen] = useState(false)
  const [mapData, setMapData] = useState<{
    metrics: Record<string, number>
    overlap: AccessMapOverlap
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metricModal, setMetricModal] = useState<keyof typeof import('./access-map-metric-modals').METRIC_COPY | null>(null)
  const [metricModalOpen, setMetricModalOpen] = useState(false)
  const [overlapStripOpen, setOverlapStripOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAccessMap(companyId)
      .then((res) => {
        if (cancelled) return
        setMapData({
          metrics: res.metrics || {},
          overlap: res.overlap || {
            unique_people_count: 0,
            unique_org_count: 0,
            overlap_people_count: 0,
            overlap_org_count: 0,
            overlap_percentage: 0,
            top_overlapping_people: [],
            top_overlapping_orgs: [],
          },
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load access map')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  const openMetricModal = (key: MetricKey) => {
    const modalKey =
      key === 'graph_density' && metrics.graph_density == null ? 'overlap_percentage' : key
    setMetricModal(modalKey)
    setMetricModalOpen(true)
  }

  const handleMetricBarClick = (key: MetricKey) => {
    if (key === 'overlap_people' || key === 'unique_people' || key === 'unique_orgs') {
      const hasOverlap =
        (overlap?.top_overlapping_people.length ?? 0) > 0 ||
        (overlap?.top_overlapping_orgs.length ?? 0) > 0
      if (hasOverlap) {
        setOverlapStripOpen(true)
        return
      }
    }
    openMetricModal(key)
  }

  useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen])

  const metrics = mapData?.metrics ?? {}
  const overlap = mapData?.overlap

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-[9999] flex flex-col gap-2 bg-background p-2'
          : 'flex flex-col gap-2 min-h-[calc(100dvh-11rem)]'
      }
    >
      {!fullscreen && (
        <p className="text-xs text-muted-foreground shrink-0">
          Click any node to zoom in. Use back or home to navigate.
        </p>
      )}

      {loading && !mapData && (
        <div className="flex flex-1 items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <p className="text-sm text-red-500 shrink-0">{error}</p>}

      {mapData && (
        <>
          {/* Unified metrics bar */}
          <div className="shrink-0 rounded-xl border border-border bg-card/50 overflow-hidden flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
            {METRIC_BAR_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleMetricBarClick(item.key)}
                className="flex flex-1 min-w-0 items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors sm:flex-col sm:items-start sm:justify-center sm:py-3"
              >
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                  {item.label}
                </span>
                <span className="text-lg font-semibold tabular-nums tracking-tight shrink-0">
                  {item.getValue(metrics, overlap)}
                </span>
              </button>
            ))}
          </div>

          {/* Network Explorer — fills remaining height, no inner page scroll */}
          <Card
            className={
              fullscreen
                ? 'flex flex-1 min-h-0 flex-col rounded-none border-0 bg-card'
                : 'flex flex-col flex-1 min-h-[560px] h-[calc(100dvh-11rem)] max-h-[min(92dvh,960px)] overflow-hidden'
            }
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 flex-wrap shrink-0 py-3 px-4">
              <CardTitle className="text-lg">Network Explorer</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border border-border p-0.5 bg-muted/40">
                  <Button
                    variant={viewMode === 'explore' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-md h-8"
                    onClick={() => setViewMode('explore')}
                  >
                    <Compass className="w-4 h-4 mr-1.5" />
                    Explore
                  </Button>
                  <Button
                    variant={viewMode === 'suggested' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-md h-8"
                    onClick={() => setViewMode('suggested')}
                  >
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    Suggested
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setFullscreen((f) => !f)}
                  title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
                  {fullscreen ? 'Exit' : 'Fullscreen'}
                </Button>
                {fullscreen && (
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setFullscreen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            {overlap &&
              (overlap.top_overlapping_people.length > 0 || overlap.top_overlapping_orgs.length > 0) && (
                <AccessMapOverlapStrip
                  companyId={companyId}
                  overlap={overlap}
                  open={overlapStripOpen}
                  onOpenChange={setOverlapStripOpen}
                  onHelpClick={() => openMetricModal('overlap_people')}
                />
              )}
            <CardContent className="flex flex-1 min-h-0 flex-col overflow-hidden px-4 pb-4 pt-0">
              {viewMode === 'explore' && (
                <AccessMapOrbit
                  companyId={companyId}
                  companyName={companyName}
                  maxVisibleNodes={fullscreen ? FULLSCREEN_MAX_NODES : DEFAULT_MAX_NODES}
                  fullscreen={fullscreen}
                  embedded={!fullscreen}
                />
              )}
              {viewMode === 'suggested' && (
                <AccessMapSuggestedView
                  companyId={companyId}
                  companyName={companyName}
                  fullscreen={fullscreen}
                  embedded={!fullscreen}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      <MetricModal
        metricKey={metricModal}
        open={metricModalOpen}
        onOpenChange={setMetricModalOpen}
      />
    </div>
  )
}
