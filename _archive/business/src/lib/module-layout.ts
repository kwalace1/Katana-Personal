/**
 * Generic module layout helpers (Hub-style section order + visibility).
 * Surface-specific extras (tabs, view modes) live in the layout jsonb extras bag.
 */

export interface ModuleSectionMeta {
  label: string
  description: string
}

export interface ModuleLayoutBase<TSectionId extends string = string> {
  sectionOrder: TSectionId[]
  hiddenSections: TSectionId[]
  extras: Record<string, unknown>
}

export function cacheKeyForModuleLayout(moduleId: string, surfaceId: string): string {
  return `katana_module_layout:${moduleId}:${surfaceId}`
}

export function normalizeSectionOrder<TSectionId extends string>(
  defaultOrder: readonly TSectionId[],
  incoming: unknown
): TSectionId[] {
  const valid = new Set<string>(defaultOrder)
  const filtered = Array.isArray(incoming)
    ? (incoming.filter((id): id is TSectionId => typeof id === 'string' && valid.has(id)) as TSectionId[])
    : []
  return [
    ...filtered,
    ...defaultOrder.filter((id) => !filtered.includes(id)),
  ]
}

export function normalizeHiddenSections<TSectionId extends string>(
  defaultOrder: readonly TSectionId[],
  incoming: unknown
): TSectionId[] {
  const valid = new Set<string>(defaultOrder)
  if (!Array.isArray(incoming)) return []
  return incoming.filter((id): id is TSectionId => typeof id === 'string' && valid.has(id))
}

export function normalizeExtras(
  defaults: Record<string, unknown>,
  incoming: unknown
): Record<string, unknown> {
  const base = { ...defaults }
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return base
  }
  return { ...base, ...(incoming as Record<string, unknown>) }
}

export function normalizeModuleLayoutBase<TSectionId extends string>(
  defaultOrder: readonly TSectionId[],
  defaultExtras: Record<string, unknown>,
  raw: Partial<ModuleLayoutBase<TSectionId>> | null | undefined
): ModuleLayoutBase<TSectionId> {
  return {
    sectionOrder: normalizeSectionOrder(defaultOrder, raw?.sectionOrder),
    hiddenSections: normalizeHiddenSections(defaultOrder, raw?.hiddenSections),
    extras: normalizeExtras(defaultExtras, raw?.extras),
  }
}

export function toggleSectionHidden<TSectionId extends string>(
  preferences: ModuleLayoutBase<TSectionId>,
  sectionId: TSectionId
): ModuleLayoutBase<TSectionId> {
  const hidden = new Set(preferences.hiddenSections)
  if (hidden.has(sectionId)) hidden.delete(sectionId)
  else hidden.add(sectionId)
  return {
    ...preferences,
    hiddenSections: [...hidden],
  }
}

export function isSectionHidden<TSectionId extends string>(
  preferences: ModuleLayoutBase<TSectionId>,
  sectionId: TSectionId
): boolean {
  return preferences.hiddenSections.includes(sectionId)
}

/** Sections to render, respecting order and visibility (hidden sections show only while customizing). */
export function resolveSectionsForDisplay<TSectionId extends string>(
  preferences: ModuleLayoutBase<TSectionId>,
  customizeMode: boolean
): TSectionId[] {
  return preferences.sectionOrder.filter(
    (sectionId) => customizeMode || !preferences.hiddenSections.includes(sectionId)
  )
}

export function reorderSections<TSectionId extends string>(
  order: TSectionId[],
  fromIndex: number,
  toIndex: number
): TSectionId[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length ||
    fromIndex === toIndex
  ) {
    return order
  }
  const next = [...order]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return order
  next.splice(toIndex, 0, moved)
  return next
}

/**
 * Hide/show an item in an ordered list while ensuring at least `minVisible` remain visible.
 * Returns null if the toggle would violate the minimum.
 */
export function toggleOrderedItemHidden<TId extends string>(
  order: readonly TId[],
  hidden: readonly TId[],
  itemId: TId,
  minVisible = 1
): { order: TId[]; hidden: TId[] } | null {
  const valid = new Set<string>(order)
  if (!valid.has(itemId)) return null

  const hiddenSet = new Set(hidden.filter((id) => valid.has(id)))
  if (hiddenSet.has(itemId)) {
    hiddenSet.delete(itemId)
  } else {
    const visibleCount = order.filter((id) => !hiddenSet.has(id)).length
    if (visibleCount <= minVisible) return null
    hiddenSet.add(itemId)
  }
  return { order: [...order], hidden: [...hiddenSet] }
}

export function resolveOrderedVisible<TId extends string>(
  order: readonly TId[],
  hidden: readonly TId[],
  customizeMode: boolean
): TId[] {
  const hiddenSet = new Set(hidden)
  return order.filter((id) => customizeMode || !hiddenSet.has(id))
}

export function readLayoutCache(moduleId: string, surfaceId: string): unknown | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(cacheKeyForModuleLayout(moduleId, surfaceId))
    if (!raw) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function writeLayoutCache(
  moduleId: string,
  surfaceId: string,
  layout: unknown
): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(cacheKeyForModuleLayout(moduleId, surfaceId), JSON.stringify(layout))
  } catch {
    // ignore quota / private mode
  }
}
