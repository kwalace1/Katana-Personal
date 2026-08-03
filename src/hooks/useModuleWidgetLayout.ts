import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Layout } from 'react-grid-layout'
import {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  removeWidgetFromLayout,
  type ModuleWidgetLayout,
  type WidgetCatalogEntry,
} from '@/lib/module-widget-layout'
import { loadModuleLayout, saveModuleLayout } from '@/lib/module-layout-api'
import { toast } from 'sonner'

export interface UseModuleWidgetLayoutOptions<TLayout extends ModuleWidgetLayout> {
  moduleId: string
  surfaceId: string
  catalog: readonly WidgetCatalogEntry[]
  normalize: (raw: unknown) => TLayout
  toBase: (layout: TLayout) => ModuleWidgetLayout
  successMessage?: string
}

export function useModuleWidgetLayout<TLayout extends ModuleWidgetLayout>({
  moduleId,
  surfaceId,
  catalog,
  normalize,
  toBase,
  successMessage = 'Layout saved',
}: UseModuleWidgetLayoutOptions<TLayout>) {
  const [layout, setLayout] = useState<TLayout>(() => normalize(null))
  const [isCustomizeMode, setIsCustomizeMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const normalizeRef = useRef(normalize)
  normalizeRef.current = normalize
  const toBaseRef = useRef(toBase)
  toBaseRef.current = toBase

  useEffect(() => {
    let cancelled = false
    setIsCustomizeMode(false)
    setLayout(normalizeRef.current(null))
    ;(async () => {
      setLoading(true)
      const raw = await loadModuleLayout(moduleId, surfaceId)
      if (cancelled) return
      setLayout(normalizeRef.current(raw))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [moduleId, surfaceId])

  const enterCustomize = useCallback(() => {
    setIsCustomizeMode(true)
    toast.info('Drag to move, resize from corners, or add widgets from the catalog.')
  }, [])

  const saveAndExit = useCallback(async () => {
    setSaving(true)
    const ok = await saveModuleLayout(moduleId, surfaceId, toBaseRef.current(layoutRef.current))
    setSaving(false)
    setIsCustomizeMode(false)
    if (ok) toast.success(successMessage)
    else toast.warning('Saved locally. Cloud sync unavailable — layout may not sync across devices.')
  }, [moduleId, surfaceId, successMessage])

  const onLayoutChange = useCallback((next: Layout[]) => {
    if (!isCustomizeMode) return
    setLayout(
      (prev) =>
        applyGridLayoutChange(prev, next) as TLayout
    )
  }, [isCustomizeMode])

  const addWidget = useCallback(
    (entry: WidgetCatalogEntry) => {
      setLayout((prev) => addWidgetToLayout(prev, entry) as TLayout)
    },
    []
  )

  const removeWidget = useCallback((widgetId: string) => {
    setLayout((prev) => removeWidgetFromLayout(prev, widgetId) as TLayout)
  }, [])

  const availableWidgets = useMemo(
    () => availableCatalogEntries(layout, catalog),
    [layout, catalog]
  )

  const resetToDefault = useCallback(() => {
    setLayout(normalize(null))
    toast.info('Layout reset to default. Click Done to save.')
  }, [normalize])

  return {
    layout,
    setLayout,
    loading,
    saving,
    isCustomizeMode,
    enterCustomize,
    saveAndExit,
    onLayoutChange,
    addWidget,
    removeWidget,
    availableWidgets,
    resetToDefault,
  }
}
