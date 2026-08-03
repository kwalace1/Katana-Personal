import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  isSectionHidden,
  reorderSections,
  resolveSectionsForDisplay,
  toggleSectionHidden,
  type ModuleLayoutBase,
} from '@/lib/module-layout'
import { loadModuleLayout, saveModuleLayout } from '@/lib/module-layout-api'
import { toast } from 'sonner'

export interface UseModuleLayoutOptions<TLayout extends ModuleLayoutBase> {
  moduleId: string
  surfaceId: string
  normalize: (raw: unknown) => TLayout
  toBase: (layout: TLayout) => ModuleLayoutBase
  successMessage?: string
}

export function useModuleLayout<TLayout extends ModuleLayoutBase, TSectionId extends string>({
  moduleId,
  surfaceId,
  normalize,
  toBase,
  successMessage = 'Layout saved',
}: UseModuleLayoutOptions<TLayout>) {
  const [layout, setLayout] = useState<TLayout>(() => normalize(null))
  const [isCustomizeMode, setIsCustomizeMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const normalizeRef = useRef(normalize)
  normalizeRef.current = normalize
  const toBaseRef = useRef(toBase)
  toBaseRef.current = toBase

  useEffect(() => {
    let cancelled = false
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

  const displaySections = useMemo(
    () => resolveSectionsForDisplay(layout, isCustomizeMode) as TSectionId[],
    [layout, isCustomizeMode]
  )

  const enterCustomize = useCallback(() => {
    setIsCustomizeMode(true)
    toast.info('Drag sections to reorder. Hide sections you don’t need.')
  }, [])

  const saveAndExit = useCallback(async () => {
    setSaving(true)
    const ok = await saveModuleLayout(moduleId, surfaceId, toBaseRef.current(layoutRef.current))
    setSaving(false)
    setIsCustomizeMode(false)
    setDraggedSectionIndex(null)
    if (ok) toast.success(successMessage)
    else toast.warning('Saved locally. Cloud sync unavailable — layout may not sync across devices.')
  }, [moduleId, surfaceId, successMessage])

  const updateLayout = useCallback((updater: (prev: TLayout) => TLayout) => {
    setLayout((prev) => updater(prev))
  }, [])

  const handleToggleSectionHidden = useCallback(
    (sectionId: TSectionId) => {
      setLayout((prev) => toggleSectionHidden(prev, sectionId) as TLayout)
    },
    []
  )

  const reorderDisplayedSections = useCallback(
    (fromDisplayIndex: number, toDisplayIndex: number) => {
      setLayout((prev) => {
        const displayed = resolveSectionsForDisplay(prev, true)
        const fromId = displayed[fromDisplayIndex]
        const toId = displayed[toDisplayIndex]
        if (!fromId || !toId) return prev
        const fromIndex = prev.sectionOrder.indexOf(fromId)
        const toIndex = prev.sectionOrder.indexOf(toId)
        if (fromIndex < 0 || toIndex < 0) return prev
        return {
          ...prev,
          sectionOrder: reorderSections(prev.sectionOrder, fromIndex, toIndex),
        } as TLayout
      })
    },
    []
  )

  const handleSectionDragStart = useCallback((displayIndex: number) => {
    setDraggedSectionIndex(displayIndex)
  }, [])

  const handleSectionDragEnter = useCallback(
    (displayIndex: number, reorder: (from: number, to: number) => void) => {
      setDraggedSectionIndex((from) => {
        if (from === null || from === displayIndex) return from
        reorder(from, displayIndex)
        return displayIndex
      })
    },
    []
  )

  const handleSectionDragEnd = useCallback(() => {
    setDraggedSectionIndex(null)
  }, [])

  const handleSectionKeyDown = useCallback(
    (
      event: React.KeyboardEvent,
      displayIndex: number,
      reorder: (from: number, to: number) => void
    ) => {
      if (!isCustomizeMode) return
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        if (displayIndex > 0) reorder(displayIndex, displayIndex - 1)
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        if (displayIndex < displaySections.length - 1) {
          reorder(displayIndex, displayIndex + 1)
        }
      }
    },
    [isCustomizeMode, displaySections.length]
  )

  const sectionIsHidden = useCallback(
    (sectionId: TSectionId) => isSectionHidden(layout, sectionId),
    [layout]
  )

  return {
    layout,
    setLayout,
    updateLayout,
    loading,
    saving,
    isCustomizeMode,
    displaySections,
    draggedSectionIndex,
    enterCustomize,
    saveAndExit,
    handleToggleSectionHidden,
    reorderDisplayedSections,
    handleSectionDragStart,
    handleSectionDragEnter,
    handleSectionDragEnd,
    handleSectionKeyDown,
    sectionIsHidden,
  }
}
