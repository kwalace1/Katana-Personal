import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { EsignField } from '@/lib/esign-types'
import { ESIGN_FIELD_DEFAULTS } from '@/lib/esign-types'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

const FIELD_COLORS: Record<string, string> = {
  signature: 'border-blue-500 bg-blue-500/20',
  name: 'border-emerald-500 bg-emerald-500/20',
  date: 'border-amber-500 bg-amber-500/20',
}

interface EsignSigningViewerProps {
  pdfUrl: string
  fields: EsignField[]
  activeFieldId: string | null
  onSelectField: (fieldId: string) => void
}

function PageCanvas({
  pdfUrl,
  pageIndex,
  fields,
  activeFieldId,
  onSelectField,
  fieldRefs,
}: {
  pdfUrl: string
  pageIndex: number
  fields: EsignField[]
  activeFieldId: string | null
  onSelectField: (id: string) => void
  fieldRefs: MutableRefObject<Map<string, HTMLButtonElement>>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const task = pdfjs.getDocument(pdfUrl)
      const pdf = await task.promise
      if (cancelled) return
      const page = await pdf.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: 1.35 })
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
      if (!cancelled) setReady(true)
    })().catch((err) => console.error('Signing PDF render failed', err))
    return () => {
      cancelled = true
    }
  }, [pdfUrl, pageIndex])

  const pageFields = fields.filter((f) => f.page_index === pageIndex)

  return (
    <div className="relative rounded-lg border bg-white overflow-hidden shadow-sm">
      <p className="absolute top-2 left-2 z-10 text-[10px] font-medium uppercase tracking-wide bg-background/90 border rounded px-1.5 py-0.5 text-muted-foreground">
        Page {pageIndex + 1}
      </p>
      <canvas ref={canvasRef} className="block w-full h-auto" />
      {ready &&
        pageFields.map((f) => {
          const active = f.id === activeFieldId
          return (
            <button
              key={f.id}
              type="button"
              ref={(el) => {
                if (el) fieldRefs.current.set(f.id, el)
                else fieldRefs.current.delete(f.id)
              }}
              onClick={() => onSelectField(f.id)}
              className={`absolute rounded border-2 text-left transition-shadow ${
                FIELD_COLORS[f.field_type] ?? 'border-primary bg-primary/15'
              } ${active ? 'ring-2 ring-offset-2 ring-primary z-20 shadow-md' : 'z-10 opacity-90 hover:opacity-100'}`}
              style={{
                left: `${f.x_pct}%`,
                top: `${f.y_pct}%`,
                width: `${f.width_pct}%`,
                height: `${f.height_pct}%`,
              }}
              aria-label={`${ESIGN_FIELD_DEFAULTS[f.field_type].label}${active ? ' (current)' : ''}`}
            >
              <span className="block px-1 text-[10px] sm:text-xs font-medium truncate text-foreground/90">
                {active ? 'Sign here' : ESIGN_FIELD_DEFAULTS[f.field_type].label}
              </span>
            </button>
          )
        })}
    </div>
  )
}

export function EsignSigningViewer({
  pdfUrl,
  fields,
  activeFieldId,
  onSelectField,
}: EsignSigningViewerProps) {
  const [pageCount, setPageCount] = useState(1)
  const fieldRefs = useRef(new Map<string, HTMLButtonElement>())

  const ordered = useMemo(
    () =>
      [...fields].sort(
        (a, b) =>
          a.page_index - b.page_index || a.y_pct - b.y_pct || a.x_pct - b.x_pct,
      ),
    [fields],
  )

  const activeIndex = ordered.findIndex((f) => f.id === activeFieldId)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const pdf = await pdfjs.getDocument(pdfUrl).promise
      if (!cancelled) setPageCount(pdf.numPages)
    })().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [pdfUrl])

  useEffect(() => {
    if (!activeFieldId) return
    const el = fieldRefs.current.get(activeFieldId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeFieldId])

  const go = (delta: number) => {
    if (!ordered.length) return
    const next = Math.min(ordered.length - 1, Math.max(0, (activeIndex < 0 ? 0 : activeIndex) + delta))
    onSelectField(ordered[next]!.id)
  }

  return (
    <div className="space-y-3">
      {ordered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-sm">
            <span className="font-medium text-primary">Highlighted boxes</span>
            <span className="text-muted-foreground">
              {' '}
              show where you need to sign
              {activeIndex >= 0
                ? ` · ${activeIndex + 1} of ${ordered.length}`
                : ` · ${ordered.length} field${ordered.length === 1 ? '' : 's'}`}
            </span>
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={activeIndex <= 0}
              onClick={() => go(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={activeIndex >= ordered.length - 1}
              onClick={() => go(1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {Array.from({ length: pageCount }, (_, i) => (
          <PageCanvas
            key={i}
            pdfUrl={pdfUrl}
            pageIndex={i}
            fields={fields}
            activeFieldId={activeFieldId}
            onSelectField={onSelectField}
            fieldRefs={fieldRefs}
          />
        ))}
      </div>
    </div>
  )
}
