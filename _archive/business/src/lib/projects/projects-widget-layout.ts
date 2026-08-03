/**
 * Projects freeform (v2) widget catalog + defaults + v1→v2 migration.
 */

import {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  isModuleWidgetLayoutV2,
  migrateSectionLayoutToWidgets,
  normalizeModuleWidgetLayout,
  removeWidgetFromLayout,
  type ModuleWidgetItem,
  type ModuleWidgetLayout,
  type WidgetCatalogEntry,
} from '@/lib/module-widget-layout'
import {
  DEFAULT_DETAIL_VIEW_ORDER,
  DEFAULT_PORTFOLIO_TAB_ORDER,
  DEFAULT_PROJECTS_DETAIL_SECTION_ORDER,
  DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER,
  DETAIL_VIEW_META,
  normalizeProjectsDetailLayout,
  normalizeProjectsPortfolioLayout,
  type PortfolioTabId,
  type ProjectDetailViewId,
  type ProjectsDetailExtras,
  type ProjectsPortfolioExtras,
} from '@/lib/projects/projects-layout'

export const PROJECTS_MODULE_ID = 'projects'
export const PROJECTS_PORTFOLIO_SURFACE = 'portfolio'
export const PROJECTS_DETAIL_SURFACE = 'project_detail'

// --- Portfolio catalog ---

export const PROJECTS_PORTFOLIO_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: 'stats',
    label: 'Stats',
    description: 'Project totals, deadlines, and team size',
    defaultW: 12,
    defaultH: 3,
    minW: 4,
    minH: 2,
  },
  {
    id: 'portfolio_views',
    label: 'Portfolio views',
    description: 'Grid, list, and timeline of projects',
    defaultW: 12,
    defaultH: 12,
    minW: 6,
    minH: 6,
  },
  {
    id: 'work_items',
    label: 'Work items',
    description: 'Open task checklist across your projects',
    defaultW: 6,
    defaultH: 8,
    minW: 3,
    minH: 4,
  },
  {
    id: 'recent_activity',
    label: 'Recent activity',
    description: 'Latest project activity feed',
    defaultW: 6,
    defaultH: 8,
    minW: 3,
    minH: 4,
  },
  {
    id: 'metric_total_projects',
    label: 'Total projects',
    description: 'Single metric: total projects in scope',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
  },
  {
    id: 'metric_upcoming_deadlines',
    label: 'Upcoming deadlines',
    description: 'Single metric: deadlines in the next 7 days',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
  },
  {
    id: 'metric_team_members',
    label: 'Team members',
    description: 'Single metric: unique team members across projects',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
  },
  {
    id: 'metric_active_projects',
    label: 'Active projects',
    description: 'Single metric: active projects in scope',
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 2,
  },
]

export type ProjectsPortfolioWidgetId =
  (typeof PROJECTS_PORTFOLIO_WIDGET_CATALOG)[number]['id']

export const DEFAULT_PROJECTS_PORTFOLIO_WIDGETS: ModuleWidgetItem[] = [
  { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 2 },
  { i: 'portfolio_views', x: 0, y: 3, w: 12, h: 12, minW: 6, minH: 6 },
  { i: 'work_items', x: 0, y: 15, w: 6, h: 8, minW: 3, minH: 4 },
  { i: 'recent_activity', x: 6, y: 15, w: 6, h: 8, minW: 3, minH: 4 },
]

export type ProjectsPortfolioWidgetLayout = ModuleWidgetLayout & {
  extras: ProjectsPortfolioExtras
}

function normalizePortfolioExtras(raw: unknown): ProjectsPortfolioExtras {
  return normalizeProjectsPortfolioLayout({
    extras: (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) as never,
  }).extras
}

export function normalizeProjectsPortfolioWidgetLayout(
  raw: unknown
): ProjectsPortfolioWidgetLayout {
  if (isModuleWidgetLayoutV2(raw)) {
    const layout = normalizeModuleWidgetLayout(
      raw,
      PROJECTS_PORTFOLIO_WIDGET_CATALOG,
      DEFAULT_PROJECTS_PORTFOLIO_WIDGETS,
      normalizePortfolioExtras(raw.extras) as unknown as Record<string, unknown>
    )
    return {
      ...layout,
      extras: normalizePortfolioExtras(layout.extras),
    }
  }

  // v1 section layout → stacked widgets
  if (raw && typeof raw === 'object' && Array.isArray((raw as { sectionOrder?: unknown }).sectionOrder)) {
    const v1 = normalizeProjectsPortfolioLayout(raw as never)
    const widgets = migrateSectionLayoutToWidgets(
      v1.sectionOrder,
      v1.hiddenSections,
      PROJECTS_PORTFOLIO_WIDGET_CATALOG,
      {
        stats: 3,
        portfolio_views: 12,
        work_items: 8,
        recent_activity: 8,
      }
    )
    const layout = normalizeModuleWidgetLayout(
      { version: 2, widgets, extras: v1.extras },
      PROJECTS_PORTFOLIO_WIDGET_CATALOG,
      DEFAULT_PROJECTS_PORTFOLIO_WIDGETS,
      v1.extras as unknown as Record<string, unknown>
    )
    return { ...layout, extras: normalizePortfolioExtras(layout.extras) }
  }

  const layout = normalizeModuleWidgetLayout(
    null,
    PROJECTS_PORTFOLIO_WIDGET_CATALOG,
    DEFAULT_PROJECTS_PORTFOLIO_WIDGETS,
    {
      defaultPortfolioTab: 'grid',
      hiddenPortfolioTabs: [],
    }
  )
  return { ...layout, extras: normalizePortfolioExtras(layout.extras) }
}

export function portfolioWidgetLayoutToBase(
  layout: ProjectsPortfolioWidgetLayout
): ModuleWidgetLayout {
  return {
    version: 2,
    widgets: layout.widgets,
    extras: layout.extras as unknown as Record<string, unknown>,
  }
}

// --- Detail catalog ---

export const PROJECTS_DETAIL_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  {
    id: 'stats',
    label: 'Stats',
    description: 'Progress and task counts',
    defaultW: 12,
    defaultH: 3,
    minW: 4,
    minH: 2,
  },
  {
    id: 'linked_records',
    label: 'Linked records',
    description: 'Workforce jobs linked to this project',
    defaultW: 12,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
  {
    id: 'discussion',
    label: 'Discussion',
    description: 'Project conversation thread',
    defaultW: 12,
    defaultH: 6,
    minW: 4,
    minH: 4,
  },
  {
    id: 'main_view',
    label: 'Main view',
    description: 'Active project capability (board, table, …)',
    defaultW: 12,
    defaultH: 14,
    minW: 6,
    minH: 8,
  },
  {
    id: 'recent_activity',
    label: 'Recent activity',
    description: 'Filterable project activity feed',
    defaultW: 12,
    defaultH: 8,
    minW: 4,
    minH: 4,
  },
]

export type ProjectsDetailWidgetId = (typeof PROJECTS_DETAIL_WIDGET_CATALOG)[number]['id']

export const DEFAULT_PROJECTS_DETAIL_WIDGETS: ModuleWidgetItem[] = [
  { i: 'stats', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 2 },
  { i: 'linked_records', x: 0, y: 3, w: 12, h: 4, minW: 4, minH: 3 },
  { i: 'discussion', x: 0, y: 7, w: 12, h: 6, minW: 4, minH: 4 },
  { i: 'main_view', x: 0, y: 13, w: 12, h: 14, minW: 6, minH: 8 },
  { i: 'recent_activity', x: 0, y: 27, w: 12, h: 8, minW: 4, minH: 4 },
]

export type ProjectsDetailWidgetLayout = ModuleWidgetLayout & {
  extras: ProjectsDetailExtras
}

function normalizeDetailExtras(raw: unknown): ProjectsDetailExtras {
  return normalizeProjectsDetailLayout({
    extras: (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}) as never,
  }).extras
}

export function normalizeProjectsDetailWidgetLayout(raw: unknown): ProjectsDetailWidgetLayout {
  if (isModuleWidgetLayoutV2(raw)) {
    const layout = normalizeModuleWidgetLayout(
      raw,
      PROJECTS_DETAIL_WIDGET_CATALOG,
      DEFAULT_PROJECTS_DETAIL_WIDGETS,
      normalizeDetailExtras(raw.extras) as unknown as Record<string, unknown>
    )
    return { ...layout, extras: normalizeDetailExtras(layout.extras) }
  }

  if (raw && typeof raw === 'object' && Array.isArray((raw as { sectionOrder?: unknown }).sectionOrder)) {
    const v1 = normalizeProjectsDetailLayout(raw as never)
    const widgets = migrateSectionLayoutToWidgets(
      v1.sectionOrder,
      v1.hiddenSections,
      PROJECTS_DETAIL_WIDGET_CATALOG,
      {
        stats: 3,
        linked_records: 4,
        discussion: 6,
        main_view: 14,
        recent_activity: 8,
      }
    )
    const layout = normalizeModuleWidgetLayout(
      { version: 2, widgets, extras: v1.extras },
      PROJECTS_DETAIL_WIDGET_CATALOG,
      DEFAULT_PROJECTS_DETAIL_WIDGETS,
      v1.extras as unknown as Record<string, unknown>
    )
    return { ...layout, extras: normalizeDetailExtras(layout.extras) }
  }

  const layout = normalizeModuleWidgetLayout(
    null,
    PROJECTS_DETAIL_WIDGET_CATALOG,
    DEFAULT_PROJECTS_DETAIL_WIDGETS,
    {
      defaultView: 'board',
      viewModeOrder: [...DEFAULT_DETAIL_VIEW_ORDER],
      hiddenViewModes: [],
    }
  )
  return { ...layout, extras: normalizeDetailExtras(layout.extras) }
}

export function detailWidgetLayoutToBase(
  layout: ProjectsDetailWidgetLayout
): ModuleWidgetLayout {
  return {
    version: 2,
    widgets: layout.widgets,
    extras: layout.extras as unknown as Record<string, unknown>,
  }
}

export {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  removeWidgetFromLayout,
  DEFAULT_PORTFOLIO_TAB_ORDER,
  DEFAULT_DETAIL_VIEW_ORDER,
  DETAIL_VIEW_META,
  DEFAULT_PROJECTS_PORTFOLIO_SECTION_ORDER,
  DEFAULT_PROJECTS_DETAIL_SECTION_ORDER,
}

export type { PortfolioTabId, ProjectDetailViewId, ProjectsPortfolioExtras, ProjectsDetailExtras }
