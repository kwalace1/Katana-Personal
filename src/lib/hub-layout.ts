export type HubSectionId =
  | 'profile_setup'
  | 'performance_overview'
  | 'key_metrics'
  | 'launchpad'
  | 'your_tools'
  | 'activity_feed'

export const DEFAULT_HUB_SECTION_ORDER: HubSectionId[] = [
  'profile_setup',
  'performance_overview',
  'key_metrics',
  'launchpad',
  'your_tools',
  'activity_feed',
]

export const HUB_SECTION_META: Record<
  HubSectionId,
  { label: string; description: string }
> = {
  profile_setup: {
    label: 'Profile Setup',
    description: 'Onboarding and profile completeness',
  },
  performance_overview: {
    label: 'Performance Overview',
    description: 'Cross-module performance snapshot',
  },
  key_metrics: {
    label: 'Key Metrics',
    description: 'KPI cards for your modules',
  },
  launchpad: {
    label: 'Launchpad',
    description: 'Employee portal quick access',
  },
  your_tools: {
    label: 'Your Tools',
    description: 'Module widgets and shortcuts',
  },
  activity_feed: {
    label: 'Activity Feed',
    description: 'Recent activity across Katana',
  },
}

const HUB_LAYOUT_KEY = 'katana_hub_layout'

export interface HubLayoutPreferences {
  sectionOrder: HubSectionId[]
  hiddenSections: HubSectionId[]
}

const VALID_SECTION_IDS = new Set<string>(DEFAULT_HUB_SECTION_ORDER)

function isHubSectionId(value: unknown): value is HubSectionId {
  return typeof value === 'string' && VALID_SECTION_IDS.has(value)
}

export function normalizeHubLayout(
  raw: Partial<HubLayoutPreferences> | null | undefined
): HubLayoutPreferences {
  const incomingOrder = Array.isArray(raw?.sectionOrder)
    ? raw.sectionOrder.filter(isHubSectionId)
    : []
  const sectionOrder = [
    ...incomingOrder,
    ...DEFAULT_HUB_SECTION_ORDER.filter((id) => !incomingOrder.includes(id)),
  ]

  const hiddenSections = Array.isArray(raw?.hiddenSections)
    ? raw.hiddenSections.filter(isHubSectionId)
    : []

  return { sectionOrder, hiddenSections }
}

export function loadHubLayout(): HubLayoutPreferences {
  if (typeof window === 'undefined') {
    return normalizeHubLayout(null)
  }
  try {
    const raw = localStorage.getItem(HUB_LAYOUT_KEY)
    if (!raw) return normalizeHubLayout(null)
    return normalizeHubLayout(JSON.parse(raw) as Partial<HubLayoutPreferences>)
  } catch {
    return normalizeHubLayout(null)
  }
}

export function saveHubLayout(preferences: HubLayoutPreferences): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(HUB_LAYOUT_KEY, JSON.stringify(normalizeHubLayout(preferences)))
}

export function resetHubLayout(): HubLayoutPreferences {
  const defaults = normalizeHubLayout(null)
  saveHubLayout(defaults)
  return defaults
}

export function toggleHubSectionHidden(
  preferences: HubLayoutPreferences,
  sectionId: HubSectionId
): HubLayoutPreferences {
  const hidden = new Set(preferences.hiddenSections)
  if (hidden.has(sectionId)) hidden.delete(sectionId)
  else hidden.add(sectionId)
  return {
    ...preferences,
    hiddenSections: [...hidden],
  }
}

export function isHubSectionHidden(
  preferences: HubLayoutPreferences,
  sectionId: HubSectionId
): boolean {
  return preferences.hiddenSections.includes(sectionId)
}

/** Sections to render, respecting order and visibility (hidden sections show only while customizing). */
export function resolveHubSectionsForDisplay(
  preferences: HubLayoutPreferences,
  customizeMode: boolean
): HubSectionId[] {
  return preferences.sectionOrder.filter(
    (sectionId) => customizeMode || !preferences.hiddenSections.includes(sectionId)
  )
}

export function reorderHubSections(
  order: HubSectionId[],
  fromIndex: number,
  toIndex: number
): HubSectionId[] {
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
