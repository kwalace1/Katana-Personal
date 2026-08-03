/**
 * Katana HR freeform (v2) widget catalogs.
 * Surfaces cover every main tab + recruitment/development sub-views.
 * Catalogs map to existing UI only — no empty_* placeholder widgets.
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

/** Shared freeform layout props passed from HRPage into tab panels / canvases. */
export interface HrTabLayoutProps {
  widgets: ModuleWidgetItem[]
  catalog: readonly WidgetCatalogEntry[]
  customizeMode: boolean
  onLayoutChange: (layout: Layout[]) => void
  onRemoveWidget: (widgetId: string) => void
}

export const HR_MODULE_ID = 'hr'

export type HrTabSurfaceId =
  | 'dashboard'
  | 'time_off'
  | 'recruitment_pipeline'
  | 'recruitment_applications'
  | 'recruitment_talent_pool'
  | 'job_listings'
  | 'calendar'
  | 'employees'
  | 'performance'
  | 'goals'
  | 'analytics'
  | 'development_career'
  | 'development_mentorship'
  | 'development_learning'
  | 'development_recognition'

export const HR_TAB_SURFACE_IDS: HrTabSurfaceId[] = [
  'dashboard',
  'time_off',
  'recruitment_pipeline',
  'recruitment_applications',
  'recruitment_talent_pool',
  'job_listings',
  'calendar',
  'employees',
  'performance',
  'goals',
  'analytics',
  'development_career',
  'development_mentorship',
  'development_learning',
  'development_recognition',
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

// --- Dashboard (admin) ---

export const HR_DASHBOARD_ADMIN_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('stats_quick_links', 'Stats & quick links', 'KPIs and shortcuts to common HR actions', 12, 8, 6, 4),
  entry('directory', 'Employee directory', 'Searchable employee list', 8, 14, 4, 6),
  entry('training_assignments', 'Training assignments', 'Active learning paths preview', 4, 8, 3, 4),
  entry('recent_activity', 'Recent activity', 'Latest HR activity feed', 4, 8, 3, 4),
]

export const DEFAULT_HR_DASHBOARD_ADMIN_WIDGETS: ModuleWidgetItem[] = [
  item('stats_quick_links', 0, 0, 12, 8, 6, 4),
  item('directory', 0, 8, 8, 14, 4, 6),
  item('training_assignments', 8, 8, 4, 8, 3, 4),
  item('recent_activity', 8, 16, 4, 8, 3, 4),
]

const dashboardAdminSurface = makeSurface(
  HR_DASHBOARD_ADMIN_WIDGET_CATALOG,
  DEFAULT_HR_DASHBOARD_ADMIN_WIDGETS
)

// --- Dashboard (member) ---

export const HR_DASHBOARD_MEMBER_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('my_overview', 'My HR overview', 'Personal KPIs and shortcuts', 12, 10, 6, 5),
]

export const DEFAULT_HR_DASHBOARD_MEMBER_WIDGETS: ModuleWidgetItem[] = [
  item('my_overview', 0, 0, 12, 10, 6, 5),
]

const dashboardMemberSurface = makeSurface(
  HR_DASHBOARD_MEMBER_WIDGET_CATALOG,
  DEFAULT_HR_DASHBOARD_MEMBER_WIDGETS
)

// --- Time off ---

export const HR_TIME_OFF_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('time_off', 'Time off', 'Requests list and request action', 12, 14, 6, 6),
]

export const DEFAULT_HR_TIME_OFF_WIDGETS: ModuleWidgetItem[] = [
  item('time_off', 0, 0, 12, 14, 6, 6),
]

const timeOffSurface = makeSurface(HR_TIME_OFF_WIDGET_CATALOG, DEFAULT_HR_TIME_OFF_WIDGETS)

// --- Recruitment · Pipeline ---

export const HR_RECRUITMENT_PIPELINE_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('pipeline', 'Candidate pipeline', 'Anonymous pipeline with stage filters and candidates', 12, 20, 6, 10),
]

export const DEFAULT_HR_RECRUITMENT_PIPELINE_WIDGETS: ModuleWidgetItem[] = [
  item('pipeline', 0, 0, 12, 20, 6, 10),
]

const recruitmentPipelineSurface = makeSurface(
  HR_RECRUITMENT_PIPELINE_WIDGET_CATALOG,
  DEFAULT_HR_RECRUITMENT_PIPELINE_WIDGETS
)

// --- Recruitment · Applications ---

export const HR_RECRUITMENT_APPLICATIONS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('applications', 'Job applications', 'External applications, filters, and list', 12, 22, 6, 10),
]

export const DEFAULT_HR_RECRUITMENT_APPLICATIONS_WIDGETS: ModuleWidgetItem[] = [
  item('applications', 0, 0, 12, 22, 6, 10),
]

const recruitmentApplicationsSurface = makeSurface(
  HR_RECRUITMENT_APPLICATIONS_WIDGET_CATALOG,
  DEFAULT_HR_RECRUITMENT_APPLICATIONS_WIDGETS
)

// --- Recruitment · Talent pool ---

export const HR_RECRUITMENT_TALENT_POOL_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('talent_pool', 'Talent pool', 'Future candidates with filters and list', 12, 18, 6, 8),
]

export const DEFAULT_HR_RECRUITMENT_TALENT_POOL_WIDGETS: ModuleWidgetItem[] = [
  item('talent_pool', 0, 0, 12, 18, 6, 8),
]

const recruitmentTalentPoolSurface = makeSurface(
  HR_RECRUITMENT_TALENT_POOL_WIDGET_CATALOG,
  DEFAULT_HR_RECRUITMENT_TALENT_POOL_WIDGETS
)

// --- Job listings ---

export const HR_JOB_LISTINGS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('job_listings', 'Job listings', 'Board distribution and active listings', 12, 18, 6, 8),
]

export const DEFAULT_HR_JOB_LISTINGS_WIDGETS: ModuleWidgetItem[] = [
  item('job_listings', 0, 0, 12, 18, 6, 8),
]

const jobListingsSurface = makeSurface(HR_JOB_LISTINGS_WIDGET_CATALOG, DEFAULT_HR_JOB_LISTINGS_WIDGETS)

// --- Calendar ---

export const HR_CALENDAR_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('calendar', 'Calendar', 'Interview or personal HR calendar', 12, 20, 6, 10),
]

export const DEFAULT_HR_CALENDAR_WIDGETS: ModuleWidgetItem[] = [
  item('calendar', 0, 0, 12, 20, 6, 10),
]

const calendarSurface = makeSurface(HR_CALENDAR_WIDGET_CATALOG, DEFAULT_HR_CALENDAR_WIDGETS)

// --- Employees ---

export const HR_EMPLOYEES_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('employees', 'Employees', 'Roster toolbar and directory', 12, 20, 6, 10),
]

export const DEFAULT_HR_EMPLOYEES_WIDGETS: ModuleWidgetItem[] = [
  item('employees', 0, 0, 12, 20, 6, 10),
]

const employeesSurface = makeSurface(HR_EMPLOYEES_WIDGET_CATALOG, DEFAULT_HR_EMPLOYEES_WIDGETS)

// --- Performance ---

export const HR_PERFORMANCE_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('performance', 'Performance', 'KPIs, distribution, and reviews list', 12, 22, 6, 10),
]

export const DEFAULT_HR_PERFORMANCE_WIDGETS: ModuleWidgetItem[] = [
  item('performance', 0, 0, 12, 22, 6, 10),
]

const performanceSurface = makeSurface(HR_PERFORMANCE_WIDGET_CATALOG, DEFAULT_HR_PERFORMANCE_WIDGETS)

// --- Goals ---

export const HR_GOALS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('goals', 'Goals', 'Overview metrics and goals list', 12, 22, 6, 10),
]

export const DEFAULT_HR_GOALS_WIDGETS: ModuleWidgetItem[] = [
  item('goals', 0, 0, 12, 22, 6, 10),
]

const goalsSurface = makeSurface(HR_GOALS_WIDGET_CATALOG, DEFAULT_HR_GOALS_WIDGETS)

// --- Analytics ---

export const HR_ANALYTICS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('analytics', 'Analytics', 'HR analytics overview and exports', 12, 24, 6, 10),
]

export const DEFAULT_HR_ANALYTICS_WIDGETS: ModuleWidgetItem[] = [
  item('analytics', 0, 0, 12, 24, 6, 10),
]

const analyticsSurface = makeSurface(HR_ANALYTICS_WIDGET_CATALOG, DEFAULT_HR_ANALYTICS_WIDGETS)

// --- Development sub-surfaces ---

export const HR_DEVELOPMENT_CAREER_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('career_paths', 'Career paths', 'Career path list and actions', 12, 16, 6, 8),
]

export const DEFAULT_HR_DEVELOPMENT_CAREER_WIDGETS: ModuleWidgetItem[] = [
  item('career_paths', 0, 0, 12, 16, 6, 8),
]

const developmentCareerSurface = makeSurface(
  HR_DEVELOPMENT_CAREER_WIDGET_CATALOG,
  DEFAULT_HR_DEVELOPMENT_CAREER_WIDGETS
)

export const HR_DEVELOPMENT_MENTORSHIP_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('mentorship', 'Mentorship', 'Mentorship matches and actions', 12, 16, 6, 8),
]

export const DEFAULT_HR_DEVELOPMENT_MENTORSHIP_WIDGETS: ModuleWidgetItem[] = [
  item('mentorship', 0, 0, 12, 16, 6, 8),
]

const developmentMentorshipSurface = makeSurface(
  HR_DEVELOPMENT_MENTORSHIP_WIDGET_CATALOG,
  DEFAULT_HR_DEVELOPMENT_MENTORSHIP_WIDGETS
)

export const HR_DEVELOPMENT_LEARNING_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('learning', 'Learning', 'Training assignments and course actions', 12, 16, 6, 8),
]

export const DEFAULT_HR_DEVELOPMENT_LEARNING_WIDGETS: ModuleWidgetItem[] = [
  item('learning', 0, 0, 12, 16, 6, 8),
]

const developmentLearningSurface = makeSurface(
  HR_DEVELOPMENT_LEARNING_WIDGET_CATALOG,
  DEFAULT_HR_DEVELOPMENT_LEARNING_WIDGETS
)

export const HR_DEVELOPMENT_RECOGNITION_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('recognition', 'Recognition', 'Recognition feed and actions', 12, 16, 6, 8),
]

export const DEFAULT_HR_DEVELOPMENT_RECOGNITION_WIDGETS: ModuleWidgetItem[] = [
  item('recognition', 0, 0, 12, 16, 6, 8),
]

const developmentRecognitionSurface = makeSurface(
  HR_DEVELOPMENT_RECOGNITION_WIDGET_CATALOG,
  DEFAULT_HR_DEVELOPMENT_RECOGNITION_WIDGETS
)

// --- Registry ---

export interface HrSurfaceConfig {
  id: HrTabSurfaceId
  label: string
  catalog: WidgetCatalogEntry[]
  normalize: (raw: unknown) => ModuleWidgetLayout
  toBase: (layout: ModuleWidgetLayout) => ModuleWidgetLayout
}

function configFrom(
  id: HrTabSurfaceId,
  label: string,
  surface: ReturnType<typeof makeSurface>
): HrSurfaceConfig {
  return {
    id,
    label,
    catalog: surface.catalog,
    normalize: surface.normalize,
    toBase: surface.toBase,
  }
}

/** Admin-facing registry (includes admin-only surfaces). */
export const HR_TAB_SURFACE_REGISTRY: Record<HrTabSurfaceId, HrSurfaceConfig> = {
  dashboard: configFrom('dashboard', 'Dashboard', dashboardAdminSurface),
  time_off: configFrom('time_off', 'Time off', timeOffSurface),
  recruitment_pipeline: configFrom(
    'recruitment_pipeline',
    'Recruitment · Pipeline',
    recruitmentPipelineSurface
  ),
  recruitment_applications: configFrom(
    'recruitment_applications',
    'Recruitment · Applications',
    recruitmentApplicationsSurface
  ),
  recruitment_talent_pool: configFrom(
    'recruitment_talent_pool',
    'Recruitment · Talent Pool',
    recruitmentTalentPoolSurface
  ),
  job_listings: configFrom('job_listings', 'Job Listings', jobListingsSurface),
  calendar: configFrom('calendar', 'Calendar', calendarSurface),
  employees: configFrom('employees', 'Employees', employeesSurface),
  performance: configFrom('performance', 'Performance', performanceSurface),
  goals: configFrom('goals', 'Goals', goalsSurface),
  analytics: configFrom('analytics', 'Analytics', analyticsSurface),
  development_career: configFrom(
    'development_career',
    'Development · Career',
    developmentCareerSurface
  ),
  development_mentorship: configFrom(
    'development_mentorship',
    'Development · Mentorship',
    developmentMentorshipSurface
  ),
  development_learning: configFrom(
    'development_learning',
    'Development · Learning',
    developmentLearningSurface
  ),
  development_recognition: configFrom(
    'development_recognition',
    'Development · Recognition',
    developmentRecognitionSurface
  ),
}

export type HrRecruitmentSection = 'pipeline' | 'applications' | 'talent-pool'
export type HrDevelopmentSection = 'career' | 'mentorship' | 'learning' | 'recognition'

export interface ResolveHrSurfaceOptions {
  recruitmentSection?: HrRecruitmentSection
  developmentSection?: HrDevelopmentSection
  isAdmin?: boolean
}

export function isHrTabSurfaceId(value: string): value is HrTabSurfaceId {
  return (HR_TAB_SURFACE_IDS as string[]).includes(value)
}

export function resolveHrSurfaceId(
  tab: string,
  options: ResolveHrSurfaceOptions = {}
): HrTabSurfaceId {
  const {
    recruitmentSection = 'pipeline',
    developmentSection = 'career',
  } = options

  if (tab === 'time-off') return 'time_off'
  if (tab === 'job-listings') return 'job_listings'

  if (tab === 'recruitment') {
    if (recruitmentSection === 'applications') return 'recruitment_applications'
    if (recruitmentSection === 'talent-pool') return 'recruitment_talent_pool'
    return 'recruitment_pipeline'
  }

  if (tab === 'development') {
    if (developmentSection === 'mentorship') return 'development_mentorship'
    if (developmentSection === 'learning') return 'development_learning'
    if (developmentSection === 'recognition') return 'development_recognition'
    return 'development_career'
  }

  if (isHrTabSurfaceId(tab)) return tab
  return 'dashboard'
}

export function getHrTabSurfaceConfig(
  tab: string,
  options: ResolveHrSurfaceOptions = {}
): HrSurfaceConfig {
  const id = resolveHrSurfaceId(tab, options)
  if (id === 'dashboard' && options.isAdmin === false) {
    return configFrom('dashboard', 'Dashboard', dashboardMemberSurface)
  }
  return HR_TAB_SURFACE_REGISTRY[id]
}

export {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  removeWidgetFromLayout,
}
