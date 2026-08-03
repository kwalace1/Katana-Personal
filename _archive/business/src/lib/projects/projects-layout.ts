/**
 * Projects module layout definitions (portfolio + project detail surfaces).
 */

import {
  normalizeHiddenSections,
  normalizeModuleLayoutBase,
  normalizeSectionOrder,
  toggleOrderedItemHidden,
  type ModuleLayoutBase,
  type ModuleSectionMeta,
} from '@/lib/module-layout'

export const PROJECTS_MODULE_ID = 'projects'
export const PROJECTS_PORTFOLIO_SURFACE = 'portfolio'
export const PROJECTS_DETAIL_SURFACE = 'project_detail'

// --- Portfolio ---

export type ProjectsPortfolioSectionId =
  | 'stats'
  | 'portfolio_views'
  | 'work_items'
  | 'recent_activity'

export const DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER: ProjectsPortfolioSectionId[] = [
  'stats',
  'portfolio_views',
  'work_items',
  'recent_activity',
]

export const PROJECTS_PORTFOLIO_SECTION_META: Record<
  ProjectsPortfolioSectionId,
  ModuleSectionMeta
> = {
  stats: {
    label: 'Stats',
    description: 'Project totals, deadlines, and team size',
  },
  portfolio_views: {
    label: 'Portfolio views',
    description: 'Grid, list, and timeline of projects',
  },
  work_items: {
    label: 'Work items',
    description: 'Task checklist across your projects',
  },
  recent_activity: {
    label: 'Recent activity',
    description: 'Latest project activity feed',
  },
}

export type PortfolioTabId = 'grid' | 'list' | 'timeline'

export const DEFAULT_PORTFOLIO_TAB_ORDER: PortfolioTabId[] = ['grid', 'list', 'timeline']

export const PORTFOLIO_TAB_META: Record<PortfolioTabId, { label: string }> = {
  grid: { label: 'Grid View' },
  list: { label: 'List View' },
  timeline: { label: 'Timeline' },
}

export interface ProjectsPortfolioExtras {
  [key: string]: unknown
  defaultPortfolioTab: PortfolioTabId
  hiddenPortfolioTabs: PortfolioTabId[]
}

export type ProjectsPortfolioLayout = ModuleLayoutBase<ProjectsPortfolioSectionId> & {
  extras: ProjectsPortfolioExtras
}

export const DEFAULT_PROJECTS_PORTFOLIO_EXTRAS: ProjectsPortfolioExtras = {
  defaultPortfolioTab: 'grid',
  hiddenPortfolioTabs: [],
}

function isPortfolioTabId(value: unknown): value is PortfolioTabId {
  return value === 'grid' || value === 'list' || value === 'timeline'
}

export function normalizeProjectsPortfolioLayout(
  raw: Partial<ModuleLayoutBase<ProjectsPortfolioSectionId>> | null | undefined
): ProjectsPortfolioLayout {
  const base = normalizeModuleLayoutBase(
    DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER,
    DEFAULT_PROJECTS_PORTFOLIO_EXTRAS as unknown as Record<string, unknown>,
    raw
  )
  const extrasRaw = base.extras as Partial<ProjectsPortfolioExtras>
  let hiddenPortfolioTabs = Array.isArray(extrasRaw.hiddenPortfolioTabs)
    ? extrasRaw.hiddenPortfolioTabs.filter(isPortfolioTabId)
    : []
  // Always keep at least one tab visible
  if (hiddenPortfolioTabs.length >= DEFAULT_PORTFOLIO_TAB_ORDER.length) {
    hiddenPortfolioTabs = DEFAULT_PORTFOLIO_TAB_ORDER.slice(1)
  }
  let defaultPortfolioTab = isPortfolioTabId(extrasRaw.defaultPortfolioTab)
    ? extrasRaw.defaultPortfolioTab
    : 'grid'
  if (hiddenPortfolioTabs.includes(defaultPortfolioTab)) {
    defaultPortfolioTab =
      DEFAULT_PORTFOLIO_TAB_ORDER.find((id) => !hiddenPortfolioTabs.includes(id)) ?? 'grid'
  }
  return {
    sectionOrder: base.sectionOrder,
    hiddenSections: base.hiddenSections,
    extras: { defaultPortfolioTab, hiddenPortfolioTabs },
  }
}

export function togglePortfolioTabHidden(
  layout: ProjectsPortfolioLayout,
  tabId: PortfolioTabId
): ProjectsPortfolioLayout {
  const result = toggleOrderedItemHidden(
    DEFAULT_PORTFOLIO_TAB_ORDER,
    layout.extras.hiddenPortfolioTabs,
    tabId,
    1
  )
  if (!result) return layout
  let defaultPortfolioTab = layout.extras.defaultPortfolioTab
  if (result.hidden.includes(defaultPortfolioTab)) {
    defaultPortfolioTab =
      DEFAULT_PORTFOLIO_TAB_ORDER.find((id) => !result.hidden.includes(id)) ?? 'grid'
  }
  return {
    ...layout,
    extras: {
      ...layout.extras,
      hiddenPortfolioTabs: result.hidden,
      defaultPortfolioTab,
    },
  }
}

// --- Project detail ---

export type ProjectsDetailSectionId =
  | 'stats'
  | 'linked_records'
  | 'discussion'
  | 'main_view'
  | 'recent_activity'

export const DEFAULT_PROJECTS_DETAIL_SECTION_ORDER: ProjectsDetailSectionId[] = [
  'stats',
  'linked_records',
  'discussion',
  'main_view',
  'recent_activity',
]

export const PROJECTS_DETAIL_SECTION_META: Record<ProjectsDetailSectionId, ModuleSectionMeta> = {
  stats: {
    label: 'Stats',
    description: 'Progress and task counts',
  },
  linked_records: {
    label: 'Linked records',
    description: 'Workforce jobs linked to this project',
  },
  discussion: {
    label: 'Discussion',
    description: 'Project conversation thread',
  },
  main_view: {
    label: 'Main view',
    description: 'Active project capability (board, table, …)',
  },
  recent_activity: {
    label: 'Recent activity',
    description: 'Filterable project activity feed',
  },
}

export type ProjectDetailViewId =
  | 'board'
  | 'table'
  | 'plan'
  | 'timeline'
  | 'calendar'
  | 'sprint'
  | 'team'
  | 'files'
  | 'share'
  | 'reports'

export const DEFAULT_DETAIL_VIEW_ORDER: ProjectDetailViewId[] = [
  'board',
  'table',
  'plan',
  'timeline',
  'calendar',
  'sprint',
  'team',
  'files',
  'share',
  'reports',
]

export const DETAIL_VIEW_META: Record<ProjectDetailViewId, { label: string }> = {
  board: { label: 'Board' },
  table: { label: 'Table' },
  plan: { label: 'Plan' },
  timeline: { label: 'Timeline' },
  calendar: { label: 'Calendar' },
  sprint: { label: 'Sprint' },
  team: { label: 'Team' },
  files: { label: 'Files' },
  share: { label: 'Share' },
  reports: { label: 'Reports' },
}

export interface ProjectsDetailExtras {
  [key: string]: unknown
  defaultView: ProjectDetailViewId
  viewModeOrder: ProjectDetailViewId[]
  hiddenViewModes: ProjectDetailViewId[]
}

export type ProjectsDetailLayout = ModuleLayoutBase<ProjectsDetailSectionId> & {
  extras: ProjectsDetailExtras
}

export const DEFAULT_PROJECTS_DETAIL_EXTRAS: ProjectsDetailExtras = {
  defaultView: 'board',
  viewModeOrder: [...DEFAULT_DETAIL_VIEW_ORDER],
  hiddenViewModes: [],
}

function isDetailViewId(value: unknown): value is ProjectDetailViewId {
  return typeof value === 'string' && (DEFAULT_DETAIL_VIEW_ORDER as string[]).includes(value)
}

export function normalizeProjectsDetailLayout(
  raw: Partial<ModuleLayoutBase<ProjectsDetailSectionId>> | null | undefined
): ProjectsDetailLayout {
  const base = normalizeModuleLayoutBase(
    DEFAULT_PROJECTS_DETAIL_SECTION_ORDER,
    {
      defaultView: 'board',
      viewModeOrder: [...DEFAULT_DETAIL_VIEW_ORDER],
      hiddenViewModes: [],
    },
    raw
  )
  const extrasRaw = base.extras as Partial<ProjectsDetailExtras>
  const viewModeOrder = normalizeSectionOrder(DEFAULT_DETAIL_VIEW_ORDER, extrasRaw.viewModeOrder)
  let hiddenViewModes = normalizeHiddenSections(DEFAULT_DETAIL_VIEW_ORDER, extrasRaw.hiddenViewModes)
  if (hiddenViewModes.length >= viewModeOrder.length) {
    hiddenViewModes = viewModeOrder.slice(1)
  }
  let defaultView = isDetailViewId(extrasRaw.defaultView) ? extrasRaw.defaultView : 'board'
  if (hiddenViewModes.includes(defaultView)) {
    defaultView = viewModeOrder.find((id) => !hiddenViewModes.includes(id)) ?? 'board'
  }
  return {
    sectionOrder: base.sectionOrder,
    hiddenSections: base.hiddenSections,
    extras: {
      defaultView,
      viewModeOrder,
      hiddenViewModes,
    },
  }
}

export function toggleDetailViewHidden(
  layout: ProjectsDetailLayout,
  viewId: ProjectDetailViewId
): ProjectsDetailLayout {
  const result = toggleOrderedItemHidden(
    layout.extras.viewModeOrder,
    layout.extras.hiddenViewModes,
    viewId,
    1
  )
  if (!result) return layout
  let defaultView = layout.extras.defaultView
  if (result.hidden.includes(defaultView)) {
    defaultView = result.order.find((id) => !result.hidden.includes(id)) ?? 'board'
  }
  return {
    ...layout,
    extras: {
      ...layout.extras,
      viewModeOrder: result.order,
      hiddenViewModes: result.hidden,
      defaultView,
    },
  }
}

export function reorderDetailViews(
  layout: ProjectsDetailLayout,
  fromIndex: number,
  toIndex: number
): ProjectsDetailLayout {
  const order = [...layout.extras.viewModeOrder]
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length ||
    fromIndex === toIndex
  ) {
    return layout
  }
  const [moved] = order.splice(fromIndex, 1)
  if (!moved) return layout
  order.splice(toIndex, 0, moved)
  return {
    ...layout,
    extras: {
      ...layout.extras,
      viewModeOrder: order,
    },
  }
}

/** Resolve extras bag blindly for module-layout cache write. */
export function portfolioLayoutToBase(layout: ProjectsPortfolioLayout): ModuleLayoutBase {
  return {
    sectionOrder: layout.sectionOrder,
    hiddenSections: layout.hiddenSections,
    extras: layout.extras as unknown as Record<string, unknown>,
  }
}

export function detailLayoutToBase(layout: ProjectsDetailLayout): ModuleLayoutBase {
  return {
    sectionOrder: layout.sectionOrder,
    hiddenSections: layout.hiddenSections,
    extras: layout.extras as unknown as Record<string, unknown>,
  }
}
