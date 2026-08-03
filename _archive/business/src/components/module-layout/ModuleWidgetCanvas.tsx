import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ModuleWidgetItem, WidgetCatalogEntry } from '@/lib/module-widget-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ReactGridLayout = WidthProvider(GridLayout)

interface ModuleWidgetCanvasProps {
  widgets: ModuleWidgetItem[]
  catalog: readonly WidgetCatalogEntry[]
  customizeMode: boolean
  onLayoutChange: (layout: Layout[]) => void
  onRemoveWidget?: (widgetId: string) => void
  renderWidget: (widgetId: string) => ReactNode
  className?: string
  rowHeight?: number
  cols?: number
}

/**
 * Only enables overflow scrolling when content actually overflows.
 * Always-on overflow:auto traps wheel events and blocks parent page scroll.
 */
function WidgetScrollBody({
  customizeMode,
  children,
}: {
  customizeMode: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      setCanScroll(el.scrollHeight > el.clientHeight + 1)
    }
    update()

    const observer = new ResizeObserver(update)
    observer.observe(el)
    for (const child of Array.from(el.children)) {
      observer.observe(child)
    }
    return () => observer.disconnect()
  }, [children, customizeMode])

  return (
    <div
      ref={ref}
      className={cn(
        // Do not use overscroll-contain when the cell isn't scrollable — it blocks page scroll.
        'h-full min-h-0',
        canScroll ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden',
        customizeMode && 'pt-8'
      )}
    >
      {children}
    </div>
  )
}

export function ModuleWidgetCanvas({
  widgets,
  catalog,
  customizeMode,
  onLayoutChange,
  onRemoveWidget,
  renderWidget,
  className,
  rowHeight = 36,
  cols = 12,
}: ModuleWidgetCanvasProps) {
  const catalogMap = useMemo(
    () => new Map(catalog.map((entry) => [entry.id, entry])),
    [catalog]
  )

  const gridLayout: Layout[] = useMemo(
    () =>
      widgets.map((widget) => ({
        i: widget.i,
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        minW: widget.minW,
        minH: widget.minH,
        maxW: widget.maxW,
        maxH: widget.maxH,
        static: !customizeMode,
        isDraggable: customizeMode,
        isResizable: customizeMode,
      })),
    [widgets, customizeMode]
  )

  return (
    <div
      className={cn(
        'module-widget-canvas min-w-0',
        customizeMode && 'rounded-xl border border-dashed border-primary/30 bg-muted/10 p-2',
        className
      )}
    >
      <ReactGridLayout
        className="layout"
        layout={gridLayout}
        cols={cols}
        rowHeight={rowHeight}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        onLayoutChange={(next) => {
          if (!customizeMode) return
          onLayoutChange(next)
        }}
        draggableHandle=".module-widget-drag-handle"
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms
      >
        {widgets.map((widget) => {
          const meta = catalogMap.get(widget.i)
          const content = renderWidget(widget.i)
          return (
            <div
              key={widget.i}
              data-module-widget={widget.i}
              className={cn(
                'relative min-h-0 overflow-hidden rounded-lg',
                customizeMode && 'ring-1 ring-primary/25 bg-background/80'
              )}
            >
              {customizeMode ? (
                <div className="module-widget-drag-handle absolute inset-x-0 top-0 z-20 flex h-8 cursor-grab items-center justify-between gap-2 border-b border-border/60 bg-muted/80 px-2 backdrop-blur-sm active:cursor-grabbing">
                  <span className="truncate text-xs font-medium text-foreground">
                    {meta?.label ?? widget.i}
                  </span>
                  {onRemoveWidget ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      aria-label={`Remove ${meta?.label ?? widget.i}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveWidget(widget.i)
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <WidgetScrollBody customizeMode={customizeMode}>
                {content ?? (
                  <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                    Unknown widget
                  </div>
                )}
              </WidgetScrollBody>
            </div>
          )
        })}
      </ReactGridLayout>
    </div>
  )
}
