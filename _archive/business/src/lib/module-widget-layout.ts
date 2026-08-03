/**
 * Freeform (v2) module widget layouts: x/y/w/h on a 12-col grid.
 * Compatible with react-grid-layout item shape (`i`, `x`, `y`, `w`, `h`).
 */

export const MODULE_WIDGET_LAYOUT_VERSION = 2 as const

export interface ModuleWidgetItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

export interface ModuleWidgetLayout {
  version: typeof MODULE_WIDGET_LAYOUT_VERSION
  widgets: ModuleWidgetItem[]
  extras: Record<string, unknown>
}

export interface WidgetCatalogEntry {
  id: string
  label: string
  description: string
  defaultW: number
  defaultH: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

export function isModuleWidgetLayoutV2(raw: unknown): raw is ModuleWidgetLayout {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const obj = raw as Record<string, unknown>
  return obj.version === 2 && Array.isArray(obj.widgets)
}

export function normalizeWidgetItem(
  raw: unknown,
  catalog: ReadonlyMap<string, WidgetCatalogEntry>
): ModuleWidgetItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const id = typeof obj.i === 'string' ? obj.i : typeof obj.id === 'string' ? obj.id : null
  if (!id || !catalog.has(id)) return null
  const meta = catalog.get(id)!
  const x = typeof obj.x === 'number' && Number.isFinite(obj.x) ? Math.max(0, Math.floor(obj.x)) : 0
  const y = typeof obj.y === 'number' && Number.isFinite(obj.y) ? Math.max(0, Math.floor(obj.y)) : 0
  const w =
    typeof obj.w === 'number' && Number.isFinite(obj.w)
      ? Math.max(meta.minW ?? 1, Math.floor(obj.w))
      : meta.defaultW
  const h =
    typeof obj.h === 'number' && Number.isFinite(obj.h)
      ? Math.max(meta.minH ?? 1, Math.floor(obj.h))
      : meta.defaultH
  return {
    i: id,
    x,
    y,
    w: meta.maxW ? Math.min(w, meta.maxW) : w,
    h: meta.maxH ? Math.min(h, meta.maxH) : h,
    minW: meta.minW,
    minH: meta.minH,
    maxW: meta.maxW,
    maxH: meta.maxH,
  }
}

export function normalizeModuleWidgetLayout(
  raw: unknown,
  catalog: readonly WidgetCatalogEntry[],
  defaultWidgets: readonly ModuleWidgetItem[],
  defaultExtras: Record<string, unknown> = {}
): ModuleWidgetLayout {
  const catalogMap = new Map(catalog.map((entry) => [entry.id, entry]))
  const extras =
    raw && typeof raw === 'object' && !Array.isArray(raw) && 'extras' in raw
      ? {
          ...defaultExtras,
          ...((raw as { extras?: Record<string, unknown> }).extras ?? {}),
        }
      : { ...defaultExtras }

  let widgets: ModuleWidgetItem[] = []
  if (isModuleWidgetLayoutV2(raw)) {
    const seen = new Set<string>()
    for (const item of raw.widgets) {
      const normalized = normalizeWidgetItem(item, catalogMap)
      if (!normalized || seen.has(normalized.i)) continue
      seen.add(normalized.i)
      widgets.push(normalized)
    }
  }

  if (widgets.length === 0) {
    widgets = defaultWidgets
      .map((item) => normalizeWidgetItem(item, catalogMap))
      .filter((item): item is ModuleWidgetItem => item !== null)
  }

  return {
    version: MODULE_WIDGET_LAYOUT_VERSION,
    widgets,
    extras,
  }
}

/** Stack section-order layouts into a full-width column (migration from Hub-style v1). */
export function migrateSectionLayoutToWidgets(
  sectionOrder: readonly string[],
  hiddenSections: readonly string[],
  catalog: readonly WidgetCatalogEntry[],
  rowHeights: Record<string, number> = {}
): ModuleWidgetItem[] {
  const catalogMap = new Map(catalog.map((entry) => [entry.id, entry]))
  const hidden = new Set(hiddenSections)
  const widgets: ModuleWidgetItem[] = []
  let y = 0
  for (const id of sectionOrder) {
    if (hidden.has(id)) continue
    const meta = catalogMap.get(id)
    if (!meta) continue
    const h = rowHeights[id] ?? meta.defaultH
    widgets.push({
      i: id,
      x: 0,
      y,
      w: 12,
      h,
      minW: meta.minW,
      minH: meta.minH,
      maxW: meta.maxW,
      maxH: meta.maxH,
    })
    y += h
  }
  return widgets
}

export function layoutHasWidget(layout: ModuleWidgetLayout, widgetId: string): boolean {
  return layout.widgets.some((w) => w.i === widgetId)
}

export function addWidgetToLayout(
  layout: ModuleWidgetLayout,
  entry: WidgetCatalogEntry
): ModuleWidgetLayout {
  if (layoutHasWidget(layout, entry.id)) return layout
  const maxY = layout.widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0)
  return {
    ...layout,
    widgets: [
      ...layout.widgets,
      {
        i: entry.id,
        x: 0,
        y: maxY,
        w: entry.defaultW,
        h: entry.defaultH,
        minW: entry.minW,
        minH: entry.minH,
        maxW: entry.maxW,
        maxH: entry.maxH,
      },
    ],
  }
}

export function removeWidgetFromLayout(
  layout: ModuleWidgetLayout,
  widgetId: string
): ModuleWidgetLayout {
  return {
    ...layout,
    widgets: layout.widgets.filter((w) => w.i !== widgetId),
  }
}

export function applyGridLayoutChange(
  layout: ModuleWidgetLayout,
  next: Array<{ i: string; x: number; y: number; w: number; h: number }>
): ModuleWidgetLayout {
  const byId = new Map(next.map((item) => [item.i, item]))
  return {
    ...layout,
    widgets: layout.widgets.map((widget) => {
      const updated = byId.get(widget.i)
      if (!updated) return widget
      return {
        ...widget,
        x: updated.x,
        y: updated.y,
        w: updated.w,
        h: updated.h,
      }
    }),
  }
}

export function availableCatalogEntries(
  layout: ModuleWidgetLayout,
  catalog: readonly WidgetCatalogEntry[]
): WidgetCatalogEntry[] {
  const present = new Set(layout.widgets.map((w) => w.i))
  return catalog.filter((entry) => !present.has(entry.id))
}
