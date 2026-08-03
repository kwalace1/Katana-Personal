import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  Loader2,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Flashlight,
  Package,
  MapPin,
  ChevronRight,
  Sparkles,
  Warehouse,
  X,
  Radar,
  Plane,
  Scan,
  Flame,
  Eye,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getInventoryItems, type InventoryItem } from '@/lib/inventory-api'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  buildStockroomScene,
  binStatusColor,
  type SceneBin,
  type StockroomViewMode,
} from '@/lib/inventory-stockroom-scene'
import { useStockroomCamera } from '@/components/inventory/stockroom-camera'
import { StockroomAtmosphere } from '@/components/inventory/stockroom-atmosphere'
import {
  StockroomIsometricFloor,
  StockroomDroneMarker,
  StockroomLaserBeam,
  StockroomPulseRing,
} from '@/components/inventory/stockroom-isometric-floor'
import {
  InventoryShell,
  InventoryContent,
  InventoryStatusBadge,
  InventoryNotConfigured,
  InventoryEmptyState,
  formatCurrency,
} from '@/components/inventory/InventoryUi'
import { cn } from '@/lib/utils'
import { KATANA_BLUE_RGB } from '@/lib/inventory-stockroom'

const STATUS_LEGEND = [
  { key: 'in-stock', label: 'In stock', color: binStatusColor('in-stock') },
  { key: 'low-stock', label: 'Low stock', color: binStatusColor('low-stock') },
  { key: 'out-of-stock', label: 'Out', color: binStatusColor('out-of-stock') },
  { key: 'mixed', label: 'Mixed', color: binStatusColor('mixed') },
] as const

const VIEW_MODES: { id: StockroomViewMode; label: string; icon: typeof Square }[] = [
  { id: 'status', label: 'Status', icon: Square },
  { id: 'heatmap', label: 'Heatmap', icon: Flame },
  { id: 'xray', label: 'X-Ray', icon: Eye },
]

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Hub teaser ──────────────────────────────────────────────────────────────

export function StockroomTeaserBanner() {
  return (
    <Link to="/inventory/stockroom" className="block group">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-border/60',
          'bg-card/70 backdrop-blur-sm',
          'p-5 sm:p-6 transition-all duration-300',
          'hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5',
        )}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(74,144,226,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(74,144,226,0.04)_1px,transparent_1px)] bg-[size:18px_18px]" />
          <motion.div
            className="absolute -right-8 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-primary/10 blur-3xl"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/15">
              <Warehouse className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-base font-bold tracking-tight sm:text-lg">Your Virtual Stockroom</h2>
                <Badge variant="outline" className="border-primary/25 text-primary text-[10px] uppercase tracking-wider px-1.5 py-0">
                  3D Floor
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                Isometric warehouse · drone tours · pulse scans · live inventory hologram
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-primary shrink-0">
            <Plane className="h-4 w-4" />
            Enter Stockroom
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Hologram detail panel ───────────────────────────────────────────────────

function HologramPanel({ bin, onClose }: { bin: SceneBin; onClose: () => void }) {
  const color = binStatusColor(bin.status)
  return (
    <motion.div
      initial={{ opacity: 0, x: 16, filter: 'blur(4px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: 16, filter: 'blur(4px)' }}
      transition={{ duration: 0.22 }}
      className="relative flex flex-col h-full min-h-[240px] lg:min-h-0 overflow-hidden bg-card"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-card to-card pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,hsl(var(--primary)/0.5)_2px,hsl(var(--primary)/0.5)_3px)]" />
      <motion.div
        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative p-4 border-b border-border shrink-0">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 shadow-[0_0_20px_rgba(74,144,226,0.12)]"
            style={{ background: `color-mix(in srgb, ${color} 25%, transparent)` }}
          >
            <Box className="h-4 w-4" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/80 mb-0.5 font-mono">◈ Hologram · Bin</p>
            <h3 className="text-base font-bold text-white font-mono leading-tight break-words">{bin.displayLocation}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 break-words">
              {bin.zoneName}
              {bin.parsed.shelf ? ` · ${bin.parsed.shelf}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge variant="outline" className="border-border text-foreground/80 text-[11px] font-mono">
            {bin.totalQty} units
          </Badge>
          <Badge variant="outline" className="border-border text-foreground/80 text-[11px] font-mono">
            {formatCurrency(bin.totalValue)}
          </Badge>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto p-3 space-y-1.5">
        {bin.items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={`/inventory/items/${item.id}`}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {item.product_name}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{item.sku}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{item.on_hand_qty}</p>
                <InventoryStatusBadge status={item.status} className="text-[9px] mt-0.5" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function StatPill({ label, value, icon: Icon, warn }: { label: string; value: number; icon: typeof Package; warn?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1">
      <Icon className={cn('h-3 w-3 shrink-0', warn ? 'text-amber-500' : 'text-muted-foreground')} />
      <span className="text-[10px] text-muted-foreground hidden sm:inline">{label}</span>
      <span className={cn('text-xs font-bold tabular-nums font-mono', warn ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{value}</span>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function VirtualStockroom() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedBin, setSelectedBin] = useState<SceneBin | null>(null)
  const [spotlight, setSpotlight] = useState(false)
  const [viewMode, setViewMode] = useState<StockroomViewMode>('status')
  const [touring, setTouring] = useState(false)
  const [tourBinId, setTourBinId] = useState<string | null>(null)
  const [scanPhase, setScanPhase] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [liveFlash, setLiveFlash] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const tourAbort = useRef(false)
  const { surfaceRef, camera, resetCamera, zoomBy, flyTo, cancelFly } = useStockroomCamera()

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getInventoryItems()
      setItems(data)
      if (silent) {
        setLiveFlash(true)
        setTimeout(() => setLiveFlash(false), 600)
      }
    } catch (err) {
      console.error('Stockroom fetch failed:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchItems()
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('stockroom_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        void fetchItems(true)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [fetchItems])

  const scene = useMemo(() => buildStockroomScene(items), [items])
  const { zones: sceneZones, bins, stats, maxBinValue, tourStops } = scene

  useEffect(() => {
    if (!loading && bins.length > 0 && !introDone) {
      const t = setTimeout(async () => {
        await flyTo(0, 0, 0.85, 1800)
        setIntroDone(true)
      }, 400)
      return () => clearTimeout(t)
    }
  }, [loading, bins.length, introDone, flyTo])

  const highlightBinId = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    for (const bin of bins) {
      const match =
        bin.displayLocation.toLowerCase().includes(q) ||
        bin.items.some(
          (i) =>
            i.sku.toLowerCase().includes(q) ||
            i.product_name.toLowerCase().includes(q) ||
            (i.category?.toLowerCase().includes(q) ?? false),
        )
      if (match) return bin.id
    }
    return null
  }, [search, bins])

  const runPulseScan = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setScanPhase(0)
    const start = performance.now()
    const duration = 2200

    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        setScanPhase(t)
        if (t < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })

    setScanPhase(0)
    setScanning(false)
  }, [scanning])

  const runDroneTour = useCallback(async () => {
    if (touring || tourStops.length === 0) return
    tourAbort.current = false
    setTouring(true)
    setSpotlight(true)

    for (const stop of tourStops) {
      if (tourAbort.current) break
      setTourBinId(stop.id)
      setSelectedBin(stop)
      await flyTo(stop.isoX, stop.isoY, 1.5, 1600)
      await sleep(1800)
    }

    setTourBinId(null)
    setTouring(false)
    if (!tourAbort.current) await flyTo(0, 0, 0.9, 1200)
  }, [touring, tourStops, flyTo])

  const stopTour = useCallback(() => {
    tourAbort.current = true
    cancelFly()
    setTouring(false)
    setTourBinId(null)
  }, [cancelFly])

  const activeBin = selectedBin ?? bins.find((b) => b.id === tourBinId) ?? null

  if (!isSupabaseConfigured) {
    return <InventoryNotConfigured title="Database Not Configured" />
  }

  return (
    <InventoryShell>
      <InventoryContent className="max-w-[1700px] pb-8">
        {/* HUD header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <Link to="/inventory">
              <Button variant="outline" size="icon" className="shrink-0 rounded-xl h-10 w-10">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/15">
                  <Warehouse className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Virtual Stockroom</h1>
                <Badge variant="outline" className="border-primary/25 text-primary text-[10px] font-mono uppercase tracking-widest">
                  Live floor
                </Badge>
              </div>
              <p className="text-slate-400 mt-1 font-mono text-[12px]">◈ isometric floor · live sync enabled</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {VIEW_MODES.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={viewMode === id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode(id)}
                className="h-8 text-xs"
              >
                <Icon className="h-3 w-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Command deck */}
        <div className="rounded-2xl border border-border overflow-hidden shadow-lg relative bg-card">
          {liveFlash && (
            <motion.div
              className="absolute inset-0 z-30 pointer-events-none bg-primary/10"
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            />
          )}

          <div className="flex flex-wrap items-center gap-2 p-2.5 border-b border-border bg-card/95 backdrop-blur-md">
            <div className="relative flex-1 min-w-[160px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Locate SKU, product, bin…"
                className="w-full h-8 pl-8 pr-3 rounded-md bg-input border border-border text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center rounded-md border border-border bg-muted/30">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-r-none" onClick={() => zoomBy(0.82)}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] text-muted-foreground tabular-nums font-mono w-10 text-center border-x border-border">
                {Math.round(camera.zoom * 100)}%
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-l-none" onClick={() => zoomBy(1.22)}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => void runPulseScan()}
              disabled={scanning || loading}
            >
              <Scan className="h-3.5 w-3.5 mr-1" />
              Pulse Scan
            </Button>

            {touring ? (
              <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={stopTour}>
                Stop Tour
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 text-xs"
                onClick={() => void runDroneTour()}
                disabled={loading || bins.length === 0}
              >
                <Plane className="h-3.5 w-3.5 mr-1" />
                Drone Tour
              </Button>
            )}

            <Button
              variant={spotlight ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSpotlight((s) => !s)}
            >
              <Flashlight className="h-3.5 w-3.5 mr-1" />
              Spotlight
            </Button>

            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground text-xs" onClick={resetCamera}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>

            <div className="hidden lg:flex items-center gap-1 ml-auto">
              <StatPill label="Zones" value={stats.zoneCount} icon={MapPin} />
              <StatPill label="Bins" value={stats.totalBins} icon={Box} />
              <StatPill label="Alerts" value={stats.lowStockBins} icon={Radar} warn={stats.lowStockBins > 0} />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:h-[min(78vh,720px)]">
            {/* Isometric canvas */}
            <div
              ref={surfaceRef}
              className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing min-h-[400px] lg:min-h-0 stockroom-canvas-bg"
            >
              <StockroomAtmosphere active={!loading && bins.length > 0} />

              {/* ceiling lights */}
              <div className="absolute inset-0 pointer-events-none z-[2]">
                {[22, 50, 78].map((pct) => (
                  <div
                    key={pct}
                    className="absolute top-0 w-32 h-full opacity-30"
                    style={{
                      left: `${pct}%`,
                      transform: 'translateX(-50%)',
                      background: `linear-gradient(180deg, rgba(${KATANA_BLUE_RGB}, 0.1) 0%, transparent 55%)`,
                    }}
                  />
                ))}
              </div>

              <div className="absolute inset-0 pointer-events-none z-[2] stockroom-canvas-vignette" />

              {!loading && bins.length > 0 && (
                <div className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-white/10 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 pointer-events-none">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono mr-0.5">Legend</span>
                  {(viewMode === 'heatmap'
                    ? [
                        { label: 'Low value', color: 'hsl(199 76% 61%)' },
                        { label: 'High value', color: 'hsl(241 91% 67%)' },
                      ]
                    : STATUS_LEGEND
                  ).map(({ label, color }) => (
                    <span key={label} className="flex items-center gap-1.5 text-[10px] text-slate-300 font-mono">
                      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {touring && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-primary/30 bg-card/90 backdrop-blur-md px-3 py-1">
                  <Plane className="h-3 w-3 text-primary animate-pulse" />
                  <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Drone tour active</span>
                </div>
              )}

              {loading ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                  <p className="text-sm font-mono">Initializing warehouse floor…</p>
                </div>
              ) : bins.length === 0 ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
                  <InventoryEmptyState
                    icon={Package}
                    title="Floor is empty"
                    description="Add items with locations to materialize your stockroom."
                    action={
                      <Link to="/inventory">
                        <Button size="sm">Go to Inventory</Button>
                      </Link>
                    }
                  />
                </div>
              ) : (
                <motion.div
                  className="absolute left-1/2 top-1/2 z-[5]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: introDone ? 1 : 0.3 }}
                  style={{
                    // No will-change/transform layer promotion here: it rasterizes the
                    // SVG once and bitmap-scales it on zoom, which blurs crate numbers
                    // and labels. Re-rastering on transform keeps vector text crisp.
                    transform: `translate(calc(-50% + ${camera.x}px), calc(-50% + ${camera.y}px)) scale(${camera.zoom})`,
                    transformOrigin: 'center center',
                  }}
                >
                  <svg className="overflow-visible" width={1} height={1} style={{ overflow: 'visible' }}>
                    <StockroomPulseRing phase={scanPhase} />
                    {activeBin && (
                      <StockroomLaserBeam
                        fromX={activeBin.isoX}
                        fromY={-120}
                        toX={activeBin.isoX}
                        toY={activeBin.isoY - activeBin.stackHeight * 5 - 10}
                        active
                      />
                    )}
                    {tourBinId && (() => {
                      const b = bins.find((x) => x.id === tourBinId)
                      return b ? <StockroomDroneMarker x={b.isoX} y={b.isoY} visible /> : null
                    })()}
                  </svg>
                  <StockroomIsometricFloor
                    sceneZones={sceneZones}
                    bins={bins}
                    maxValue={maxBinValue}
                    viewMode={viewMode}
                    selectedBinId={selectedBin?.id ?? null}
                    highlightBinId={highlightBinId}
                    spotlight={spotlight}
                    scanPhase={scanPhase}
                    tourBinId={tourBinId}
                    onSelectBin={(b) => {
                      if (touring) stopTour()
                      setSelectedBin(b)
                    }}
                  />
                </motion.div>
              )}
            </div>

            {/* Detail sidebar */}
            <div className="w-full lg:w-72 xl:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card">
              <AnimatePresence mode="wait">
                {activeBin && !touring ? (
                  <HologramPanel key={activeBin.id} bin={activeBin} onClose={() => setSelectedBin(null)} />
                ) : touring && tourBinId ? (
                  <HologramPanel key={tourBinId} bin={bins.find((b) => b.id === tourBinId)!} onClose={stopTour} />
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full min-h-[200px] p-8 text-center relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.06)_0%,transparent_70%)]" />
                    <motion.div
                      className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 mb-4"
                      animate={{ boxShadow: ['0 0 20px rgba(74,144,226,0.08)', '0 0 40px rgba(74,144,226,0.15)', '0 0 20px rgba(74,144,226,0.08)'] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <Sparkles className="h-6 w-6 text-primary/60" />
                    </motion.div>
                    <p className="text-sm font-medium text-slate-300 font-mono">Awaiting selection</p>
                    <p className="text-xs text-slate-500 mt-2 max-w-[220px] leading-relaxed">
                      Hover a bin to read its label, then click to inspect its contents — or launch Drone Tour to fly through stock alerts.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex lg:hidden gap-1.5 p-2 border-t border-border bg-card overflow-x-auto">
            <StatPill label="Zones" value={stats.zoneCount} icon={MapPin} />
            <StatPill label="Bins" value={stats.totalBins} icon={Box} />
            <StatPill label="SKUs" value={stats.totalSkus} icon={Package} />
            <StatPill label="Alerts" value={stats.lowStockBins} icon={Radar} warn={stats.lowStockBins > 0} />
          </div>
        </div>
      </InventoryContent>
    </InventoryShell>
  )
}
