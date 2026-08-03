import { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import type { EsignField, EsignFieldType, EsignSigner } from '@/lib/esign-types'
import { ESIGN_FIELD_DEFAULTS } from '@/lib/esign-types'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export type DraftField = Omit<EsignField, 'id' | 'organization_id' | 'document_id' | 'created_at'> & {
  localId: string
}

interface EsignFieldPlacerProps {
  pdfUrl: string
  signers: EsignSigner[]
  initialFields: EsignField[]
  onChange: (fields: DraftField[]) => void
}

const FIELD_COLORS: Record<EsignFieldType, string> = {
  signature: 'border-blue-500 bg-blue-500/15',
  name: 'border-emerald-500 bg-emerald-500/15',
  date: 'border-amber-500 bg-amber-500/15',
}

const SIZE_PRESETS: Record<
  EsignFieldType,
  { label: string; width_pct: number; height_pct: number }[]
> = {
  signature: [
    { label: 'S', width_pct: 18, height_pct: 6 },
    { label: 'M', width_pct: 28, height_pct: 9 },
    { label: 'L', width_pct: 38, height_pct: 12 },
  ],
  name: [
    { label: 'S', width_pct: 16, height_pct: 4 },
    { label: 'M', width_pct: 24, height_pct: 5 },
    { label: 'L', width_pct: 32, height_pct: 7 },
  ],
  date: [
    { label: 'S', width_pct: 12, height_pct: 4 },
    { label: 'M', width_pct: 16, height_pct: 5 },
    { label: 'L', width_pct: 22, height_pct: 6 },
  ],
}

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5]
const BASE_PDF_SCALE = 1.6

const MIN_W = 8
const MIN_H = 3
const MAX_W = 60
const MAX_H = 25

function toDraft(fields: EsignField[]): DraftField[] {
  return fields.map((f) => ({
    localId: f.id,
    signer_id: f.signer_id,
    field_type: f.field_type,
    page_index: f.page_index,
    x_pct: f.x_pct,
    y_pct: f.y_pct,
    width_pct: f.width_pct,
    height_pct: f.height_pct,
  }))
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function EsignFieldPlacer({ pdfUrl, signers, initialFields, onChange }: EsignFieldPlacerProps) {
  const [pageCount, setPageCount] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)
  const [fields, setFields] = useState<DraftField[]>(() => toDraft(initialFields))
  const [activeSignerId, setActiveSignerId] = useState<string | null>(signers[0]?.id ?? null)
  const [activeType, setActiveType] = useState<EsignFieldType>('signature')
  const [sizePreset, setSizePreset] = useState<'S' | 'M' | 'L'>('M')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1.25)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFields(toDraft(initialFields))
  }, [initialFields])

  useEffect(() => {
    onChange(fields)
  }, [fields, onChange])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const task = pdfjs.getDocument(pdfUrl)
      const pdf = await task.promise
      if (cancelled) return
      setPageCount(pdf.numPages)
      const page = await pdf.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: BASE_PDF_SCALE * zoom })
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      // Keep CSS size equal to pixel size so the page stays large / crisp (no max-w shrink).
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
    })().catch((err) => console.error('PDF render failed', err))
    return () => {
      cancelled = true
    }
  }, [pdfUrl, pageIndex, zoom])

  const pageFields = useMemo(
    () => fields.filter((f) => f.page_index === pageIndex),
    [fields, pageIndex],
  )

  const selected = fields.find((f) => f.localId === selectedId) ?? null

  const signerName = (id: string | null) =>
    signers.find((s) => s.id === id)?.name ?? 'Any signer'

  const currentPreset = SIZE_PRESETS[activeType].find((p) => p.label === sizePreset)
    ?? SIZE_PRESETS[activeType][1]!

  const addFieldAt = (xPct: number, yPct: number) => {
    if (!activeSignerId) return
    const next: DraftField = {
      localId: crypto.randomUUID(),
      signer_id: activeSignerId,
      field_type: activeType,
      page_index: pageIndex,
      x_pct: clamp(xPct, 0, 100 - currentPreset.width_pct),
      y_pct: clamp(yPct, 0, 100 - currentPreset.height_pct),
      width_pct: currentPreset.width_pct,
      height_pct: currentPreset.height_pct,
    }
    setFields((prev) => [...prev, next])
    setSelectedId(next.localId)
  }

  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingId || resizingId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xPct = ((e.clientX - rect.left) / rect.width) * 100
    const yPct = ((e.clientY - rect.top) / rect.height) * 100
    addFieldAt(xPct, yPct)
  }

  const onFieldPointerDown = (e: React.PointerEvent, localId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(localId)
    setDraggingId(localId)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onFieldPointerMove = (e: React.PointerEvent, localId: string) => {
    if (draggingId !== localId || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const field = fields.find((f) => f.localId === localId)
    if (!field) return
    const xPct = ((e.clientX - rect.left) / rect.width) * 100 - field.width_pct / 2
    const yPct = ((e.clientY - rect.top) / rect.height) * 100 - field.height_pct / 2
    setFields((prev) =>
      prev.map((f) =>
        f.localId === localId
          ? {
              ...f,
              x_pct: clamp(xPct, 0, 100 - f.width_pct),
              y_pct: clamp(yPct, 0, 100 - f.height_pct),
            }
          : f,
      ),
    )
  }

  const onFieldPointerUp = (e: React.PointerEvent) => {
    setDraggingId(null)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onResizePointerDown = (e: React.PointerEvent, localId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(localId)
    setResizingId(localId)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onResizePointerMove = (e: React.PointerEvent, localId: string) => {
    if (resizingId !== localId || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const field = fields.find((f) => f.localId === localId)
    if (!field) return
    const endX = ((e.clientX - rect.left) / rect.width) * 100
    const endY = ((e.clientY - rect.top) / rect.height) * 100
    const width_pct = clamp(endX - field.x_pct, MIN_W, MAX_W)
    const height_pct = clamp(endY - field.y_pct, MIN_H, MAX_H)
    setFields((prev) =>
      prev.map((f) =>
        f.localId === localId
          ? {
              ...f,
              width_pct: Math.min(width_pct, 100 - f.x_pct),
              height_pct: Math.min(height_pct, 100 - f.y_pct),
            }
          : f,
      ),
    )
  }

  const onResizePointerUp = (e: React.PointerEvent) => {
    setResizingId(null)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const bumpZoom = (dir: 1 | -1) => {
    const idx = ZOOM_STEPS.findIndex((z) => z >= zoom - 0.001)
    const i = idx < 0 ? 0 : idx
    const next = ZOOM_STEPS[clamp(i + dir, 0, ZOOM_STEPS.length - 1)]!
    setZoom(next)
  }

  const updateSelectedSize = (width_pct: number, height_pct: number) => {
    if (!selectedId) return
    setFields((prev) =>
      prev.map((f) =>
        f.localId === selectedId
          ? {
              ...f,
              width_pct: clamp(width_pct, MIN_W, Math.min(MAX_W, 100 - f.x_pct)),
              height_pct: clamp(height_pct, MIN_H, Math.min(MAX_H, 100 - f.y_pct)),
            }
          : f,
      ),
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
      <div className="space-y-4 rounded-xl border p-4 h-fit xl:sticky xl:top-4">
        <div className="space-y-2">
          <Label>Signer</Label>
          <div className="space-y-1">
            {signers.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  activeSignerId === s.id ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
                }`}
                onClick={() => setActiveSignerId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Field type</Label>
          <div className="flex flex-wrap gap-2">
            {(['signature', 'name', 'date'] as EsignFieldType[]).map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={activeType === t ? 'default' : 'outline'}
                onClick={() => setActiveType(t)}
              >
                {ESIGN_FIELD_DEFAULTS[t].label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>New box size</Label>
          <div className="flex gap-2">
            {SIZE_PRESETS[activeType].map((p) => (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant={sizePreset === p.label ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setSizePreset(p.label as 'S' | 'M' | 'L')}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium">
              Selected: {ESIGN_FIELD_DEFAULTS[selected.field_type].label}
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Width</span>
                <span>{Math.round(selected.width_pct)}%</span>
              </div>
              <input
                type="range"
                min={MIN_W}
                max={MAX_W}
                value={Math.round(selected.width_pct)}
                onChange={(e) => updateSelectedSize(Number(e.target.value), selected.height_pct)}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Height</span>
                <span>{Math.round(selected.height_pct)}%</span>
              </div>
              <input
                type="range"
                min={MIN_H}
                max={MAX_H}
                value={Math.round(selected.height_pct)}
                onChange={(e) => updateSelectedSize(selected.width_pct, Number(e.target.value))}
                className="w-full"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-destructive"
              onClick={() => {
                setFields((prev) => prev.filter((x) => x.localId !== selected.localId))
                setSelectedId(null)
              }}
            >
              Remove field
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground leading-relaxed">
          Zoom in for accurate placement. Click the page to add a box, drag to move, drag the corner
          handle to resize.
        </p>

        <div className="space-y-1">
          {pageFields.map((f) => (
            <button
              key={f.localId}
              type="button"
              className={`w-full flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs text-left ${
                selectedId === f.localId ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
              }`}
              onClick={() => setSelectedId(f.localId)}
            >
              <span className="truncate">
                {ESIGN_FIELD_DEFAULTS[f.field_type].label} · {signerName(f.signer_id)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2 sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageIndex <= 0}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          >
            Prev
          </Button>
          <Badge variant="secondary">
            Page {pageIndex + 1} / {pageCount}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </Button>

          <div className="h-5 w-px bg-border mx-1" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={zoom <= ZOOM_STEPS[0]!}
            onClick={() => bumpZoom(-1)}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]!}
            onClick={() => bumpZoom(1)}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom(1.5)}
            title="Reset zoom"
          >
            <Maximize2 className="h-3.5 w-3.5 mr-1" />
            Fit work
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="overflow-auto rounded-lg border bg-muted/30 max-h-[min(78vh,900px)] p-3"
        >
          <div
            ref={wrapRef}
            className="relative inline-block origin-top-left shadow-sm"
            onClick={onCanvasClick}
          >
            <canvas ref={canvasRef} className="block bg-white" />
            {pageFields.map((f) => {
              const active = selectedId === f.localId
              return (
                <div
                  key={f.localId}
                  className={`absolute cursor-move rounded border-2 px-1 py-0.5 text-[10px] font-medium leading-tight select-none ${
                    FIELD_COLORS[f.field_type]
                  } ${active ? 'ring-2 ring-offset-1 ring-primary z-20' : 'z-10'}`}
                  style={{
                    left: `${f.x_pct}%`,
                    top: `${f.y_pct}%`,
                    width: `${f.width_pct}%`,
                    height: `${f.height_pct}%`,
                  }}
                  onPointerDown={(e) => onFieldPointerDown(e, f.localId)}
                  onPointerMove={(e) => onFieldPointerMove(e, f.localId)}
                  onPointerUp={onFieldPointerUp}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedId(f.localId)
                  }}
                >
                  <span className="block truncate">{ESIGN_FIELD_DEFAULTS[f.field_type].label}</span>
                  <span className="block truncate opacity-70">{signerName(f.signer_id)}</span>
                  <div
                    className="absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 rounded-sm border-2 border-primary bg-background cursor-se-resize shadow-sm"
                    onPointerDown={(e) => onResizePointerDown(e, f.localId)}
                    onPointerMove={(e) => onResizePointerMove(e, f.localId)}
                    onPointerUp={onResizePointerUp}
                    title="Drag to resize"
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
