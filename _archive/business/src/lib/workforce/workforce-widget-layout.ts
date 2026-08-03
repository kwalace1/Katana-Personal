/**
 * Katana Workforce freeform (v2) widget catalogs.
 * Surfaces: today, work_list, work_board, work_schedule, work_reports, team, time.
 * Catalogs map to existing UI sections only — no empty_* placeholder widgets.
 */

import type { Layout } from 'react-grid-layout'
import {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  normalizeModuleWidgetLayout,
  removeWidgetFromLayout,
  type ModuleWidgetItem,
  type ModuleWidgetLayout,
  type WidgetCatalogEntry,
} from '@/lib/module-widget-layout'

/** Shared freeform layout props passed from WorkforcePage into tab panels. */
export interface WorkforceTabLayoutProps {
  widgets: ModuleWidgetItem[]
  catalog: readonly WidgetCatalogEntry[]
  customizeMode: boolean
  onLayoutChange: (layout: Layout[]) => void
  onRemoveWidget: (widgetId: string) => void
}

export const WORKFORCE_MODULE_ID = 'workforce'

export type WorkforceTabSurfaceId =
  | 'today'
  | 'work_list'
  | 'work_board'
  | 'work_schedule'
  | 'work_reports'
  | 'team'
  | 'time'

export const WORKFORCE_TAB_SURFACE_IDS: WorkforceTabSurfaceId[] = [
  'today',
  'work_list',
  'work_board',
  'work_schedule',
  'work_reports',
  'team',
  'time',
]

function entry(
  id: string,
  label: string,
  description: string,
  defaultW: number,
  defaultH: number,
  minW = 2,
  minH = 2
): WidgetCatalogEntry {
  return { id, label, description, defaultW, defaultH, minW, minH }
}

function item(
  i: string,
  x: number,
  y: number,
  w: number,
  h: number,
  minW?: number,
  minH?: number
): ModuleWidgetItem {
  return { i, x, y, w, h, minW, minH }
}

function makeSurface(catalog: WidgetCatalogEntry[], defaults: ModuleWidgetItem[]) {
  const normalize = (raw: unknown) =>
    normalizeModuleWidgetLayout(raw, catalog, defaults, {})
  const toBase = (layout: ModuleWidgetLayout): ModuleWidgetLayout => ({
    version: 2,
    widgets: layout.widgets,
    extras: layout.extras ?? {},
  })
  return { catalog, defaults, normalize, toBase }
}

// --- Today ---

export const WORKFORCE_TODAY_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('hero', 'Today hero', 'Date summary and new work action', 12, 4, 4, 3),
  entry('kpi_strip', 'Today KPIs', 'Due today, in progress, active team, overdue', 12, 4, 6, 3),
  entry('needs_attention', 'Needs attention', 'Overdue or on-hold jobs', 6, 10, 3, 5),
  entry('unassigned', 'Unassigned', 'Jobs waiting for an owner', 6, 10, 3, 5),
  entry('team_capacity', 'Team capacity', 'Active load per person', 6, 10, 3, 5),
  entry('recent_activity', 'Recent activity', 'Latest team activity', 6, 10, 3, 5),
]

export const DEFAULT_WORKFORCE_TODAY_WIDGETS: ModuleWidgetItem[] = [
  item('hero', 0, 0, 12, 4, 4, 3),
  item('kpi_strip', 0, 4, 12, 4, 6, 3),
  item('needs_attention', 0, 8, 6, 10, 3, 5),
  item('unassigned', 6, 8, 6, 10, 3, 5),
  item('team_capacity', 0, 18, 6, 10, 3, 5),
  item('recent_activity', 6, 18, 6, 10, 3, 5),
]

const todaySurface = makeSurface(WORKFORCE_TODAY_WIDGET_CATALOG, DEFAULT_WORKFORCE_TODAY_WIDGETS)
export const normalizeWorkforceTodayWidgetLayout = todaySurface.normalize
export const workforceTodayWidgetLayoutToBase = todaySurface.toBase

// --- Work · List ---

export const WORKFORCE_WORK_LIST_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('jobs', 'Jobs list', 'All jobs table with create and edit actions', 12, 18, 6, 8),
]

export const DEFAULT_WORKFORCE_WORK_LIST_WIDGETS: ModuleWidgetItem[] = [
  item('jobs', 0, 0, 12, 18, 6, 8),
]

const workListSurface = makeSurface(
  WORKFORCE_WORK_LIST_WIDGET_CATALOG,
  DEFAULT_WORKFORCE_WORK_LIST_WIDGETS
)
export const normalizeWorkforceWorkListWidgetLayout = workListSurface.normalize
export const workforceWorkListWidgetLayoutToBase = workListSurface.toBase

// --- Work · Board ---

export const WORKFORCE_WORK_BOARD_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('jobs', 'Jobs board', 'Status kanban with create and edit actions', 12, 18, 6, 8),
]

export const DEFAULT_WORKFORCE_WORK_BOARD_WIDGETS: ModuleWidgetItem[] = [
  item('jobs', 0, 0, 12, 18, 6, 8),
]

const workBoardSurface = makeSurface(
  WORKFORCE_WORK_BOARD_WIDGET_CATALOG,
  DEFAULT_WORKFORCE_WORK_BOARD_WIDGETS
)
export const normalizeWorkforceWorkBoardWidgetLayout = workBoardSurface.normalize
export const workforceWorkBoardWidgetLayoutToBase = workBoardSurface.toBase

// --- Work · Schedule ---

export const WORKFORCE_WORK_SCHEDULE_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('schedule', 'Schedule calendar', 'Month calendar with job chips and reschedule', 12, 22, 6, 10),
]

export const DEFAULT_WORKFORCE_WORK_SCHEDULE_WIDGETS: ModuleWidgetItem[] = [
  item('schedule', 0, 0, 12, 22, 6, 10),
]

const workScheduleSurface = makeSurface(
  WORKFORCE_WORK_SCHEDULE_WIDGET_CATALOG,
  DEFAULT_WORKFORCE_WORK_SCHEDULE_WIDGETS
)
export const normalizeWorkforceWorkScheduleWidgetLayout = workScheduleSurface.normalize
export const workforceWorkScheduleWidgetLayoutToBase = workScheduleSurface.toBase

// --- Work · Reports ---

export const WORKFORCE_WORK_REPORTS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('reports', 'Reports & analytics', 'Performance metrics and export actions', 12, 18, 6, 8),
]

export const DEFAULT_WORKFORCE_WORK_REPORTS_WIDGETS: ModuleWidgetItem[] = [
  item('reports', 0, 0, 12, 18, 6, 8),
]

const workReportsSurface = makeSurface(
  WORKFORCE_WORK_REPORTS_WIDGET_CATALOG,
  DEFAULT_WORKFORCE_WORK_REPORTS_WIDGETS
)
export const normalizeWorkforceWorkReportsWidgetLayout = workReportsSurface.normalize
export const workforceWorkReportsWidgetLayoutToBase = workReportsSurface.toBase

// --- Team ---

export const WORKFORCE_TEAM_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('team_kpi_strip', 'Roster KPIs', 'Roster size, active, HR linked, assignments', 12, 4, 6, 3),
  entry('team_roster', 'Team management', 'Roster table with sync, import, and edit', 12, 16, 6, 8),
]

export const DEFAULT_WORKFORCE_TEAM_WIDGETS: ModuleWidgetItem[] = [
  item('team_kpi_strip', 0, 0, 12, 4, 6, 3),
  item('team_roster', 0, 4, 12, 16, 6, 8),
]

const teamSurface = makeSurface(WORKFORCE_TEAM_WIDGET_CATALOG, DEFAULT_WORKFORCE_TEAM_WIDGETS)
export const normalizeWorkforceTeamWidgetLayout = teamSurface.normalize
export const workforceTeamWidgetLayoutToBase = teamSurface.toBase

// --- Time ---

export const WORKFORCE_TIME_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('time_kpi_strip', 'Time KPIs', 'Clock-ins, hours today, total hours, pending', 12, 4, 6, 3),
  entry('timesheet', 'Timesheet register', 'Header, approvals, and timesheet table', 12, 16, 6, 8),
]

export const DEFAULT_WORKFORCE_TIME_WIDGETS: ModuleWidgetItem[] = [
  item('time_kpi_strip', 0, 0, 12, 4, 6, 3),
  item('timesheet', 0, 4, 12, 16, 6, 8),
]

const timeSurface = makeSurface(WORKFORCE_TIME_WIDGET_CATALOG, DEFAULT_WORKFORCE_TIME_WIDGETS)
export const normalizeWorkforceTimeWidgetLayout = timeSurface.normalize
export const workforceTimeWidgetLayoutToBase = timeSurface.toBase

// --- Registry ---

export interface WorkforceSurfaceConfig {
  id: WorkforceTabSurfaceId
  label: string
  catalog: WidgetCatalogEntry[]
  normalize: (raw: unknown) => ModuleWidgetLayout
  toBase: (layout: ModuleWidgetLayout) => ModuleWidgetLayout
}

export const WORKFORCE_TAB_SURFACE_REGISTRY: Record<
  WorkforceTabSurfaceId,
  WorkforceSurfaceConfig
> = {
  today: {
    id: 'today',
    label: 'Today',
    catalog: WORKFORCE_TODAY_WIDGET_CATALOG,
    normalize: normalizeWorkforceTodayWidgetLayout,
    toBase: workforceTodayWidgetLayoutToBase,
  },
  work_list: {
    id: 'work_list',
    label: 'Work · List',
    catalog: WORKFORCE_WORK_LIST_WIDGET_CATALOG,
    normalize: normalizeWorkforceWorkListWidgetLayout,
    toBase: workforceWorkListWidgetLayoutToBase,
  },
  work_board: {
    id: 'work_board',
    label: 'Work · Board',
    catalog: WORKFORCE_WORK_BOARD_WIDGET_CATALOG,
    normalize: normalizeWorkforceWorkBoardWidgetLayout,
    toBase: workforceWorkBoardWidgetLayoutToBase,
  },
  work_schedule: {
    id: 'work_schedule',
    label: 'Work · Schedule',
    catalog: WORKFORCE_WORK_SCHEDULE_WIDGET_CATALOG,
    normalize: normalizeWorkforceWorkScheduleWidgetLayout,
    toBase: workforceWorkScheduleWidgetLayoutToBase,
  },
  work_reports: {
    id: 'work_reports',
    label: 'Work · Reports',
    catalog: WORKFORCE_WORK_REPORTS_WIDGET_CATALOG,
    normalize: normalizeWorkforceWorkReportsWidgetLayout,
    toBase: workforceWorkReportsWidgetLayoutToBase,
  },
  team: {
    id: 'team',
    label: 'Team',
    catalog: WORKFORCE_TEAM_WIDGET_CATALOG,
    normalize: normalizeWorkforceTeamWidgetLayout,
    toBase: workforceTeamWidgetLayoutToBase,
  },
  time: {
    id: 'time',
    label: 'Time',
    catalog: WORKFORCE_TIME_WIDGET_CATALOG,
    normalize: normalizeWorkforceTimeWidgetLayout,
    toBase: workforceTimeWidgetLayoutToBase,
  },
}

export function isWorkforceTabSurfaceId(value: string): value is WorkforceTabSurfaceId {
  return (WORKFORCE_TAB_SURFACE_IDS as string[]).includes(value)
}

export function resolveWorkforceSurfaceId(
  tab: string,
  workSubTab: string
): WorkforceTabSurfaceId {
  if (tab === 'work') {
    if (workSubTab === 'board') return 'work_board'
    if (workSubTab === 'schedule') return 'work_schedule'
    if (workSubTab === 'reports') return 'work_reports'
    return 'work_list'
  }
  if (isWorkforceTabSurfaceId(tab)) return tab
  return 'today'
}

export function getWorkforceTabSurfaceConfig(
  tab: string,
  workSubTab = 'list'
): WorkforceSurfaceConfig {
  return WORKFORCE_TAB_SURFACE_REGISTRY[resolveWorkforceSurfaceId(tab, workSubTab)]
}

export {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  removeWidgetFromLayout,
}
