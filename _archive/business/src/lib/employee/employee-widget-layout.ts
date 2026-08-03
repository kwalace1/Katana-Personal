/**
 * Employee Launchpad freeform (v2) widget catalogs.
 * Surfaces: feed, my_work, directory, performance, goals, development, profile, jobs.
 * Catalogs map to existing UI sections only — no empty_* placeholder widgets.
 * Dialogs (person detail, goal edit, job apply, time off) stay outside canvases.
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

export interface EmployeeTabLayoutProps {
  widgets: ModuleWidgetItem[]
  catalog: readonly WidgetCatalogEntry[]
  customizeMode: boolean
  onLayoutChange: (layout: Layout[]) => void
  onRemoveWidget: (widgetId: string) => void
}

export const EMPLOYEE_MODULE_ID = 'employee'

export type EmployeeTabSurfaceId =
  | 'feed'
  | 'my_work'
  | 'directory'
  | 'performance'
  | 'goals'
  | 'development'
  | 'profile'
  | 'jobs'

export const EMPLOYEE_TAB_SURFACE_IDS: EmployeeTabSurfaceId[] = [
  'feed',
  'my_work',
  'directory',
  'performance',
  'goals',
  'development',
  'profile',
  'jobs',
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

// --- Feed (home) — default approximates prior 3-column composition ---

export const EMPLOYEE_FEED_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('profile_card', 'Profile card', 'Avatar, role, and performance snapshot', 3, 8, 3, 5),
  entry('shortcuts', 'Shortcuts', 'Quick links to portal sections', 3, 8, 3, 4),
  entry('welcome', 'Welcome', 'Greeting and help actions', 6, 3, 4, 2),
  entry('directory_search', 'Directory search', 'Find someone in the company', 6, 3, 4, 2),
  entry('hr_notices', 'HR notices', 'Announcements and time-off', 6, 6, 4, 4),
  entry('feed', 'Your feed', 'Activity feed with filters', 6, 16, 4, 8),
  entry('achievements', 'Achievements', 'Goals, recognition, and training badges', 3, 8, 3, 4),
  entry('resources', 'Resources', 'Profile, directory, and learning links', 3, 6, 3, 3),
  entry('kyi_companies', 'KYI companies', 'Know Your Investor quick access', 3, 8, 3, 4),
]

export const DEFAULT_EMPLOYEE_FEED_WIDGETS: ModuleWidgetItem[] = [
  item('profile_card', 0, 0, 3, 8, 3, 5),
  item('shortcuts', 0, 8, 3, 8, 3, 4),
  item('welcome', 3, 0, 6, 3, 4, 2),
  item('directory_search', 3, 3, 6, 3, 4, 2),
  item('hr_notices', 3, 6, 6, 6, 4, 4),
  item('feed', 3, 12, 6, 16, 4, 8),
  item('achievements', 9, 0, 3, 8, 3, 4),
  item('resources', 9, 8, 3, 6, 3, 3),
  item('kyi_companies', 9, 14, 3, 8, 3, 4),
]

const feedSurface = makeSurface(EMPLOYEE_FEED_WIDGET_CATALOG, DEFAULT_EMPLOYEE_FEED_WIDGETS)
export const normalizeEmployeeFeedWidgetLayout = feedSurface.normalize
export const employeeFeedWidgetLayoutToBase = feedSurface.toBase

// --- My work ---

export const EMPLOYEE_MY_WORK_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('work_stats', 'Work stats', 'Due today, overdue, open, hours this week', 12, 4, 6, 3),
  entry('work_queue', 'Assigned work', 'Your job queue', 12, 14, 6, 8),
  entry('clock_bar', 'Clock in / out', 'Time clock controls', 12, 4, 4, 3),
]

export const DEFAULT_EMPLOYEE_MY_WORK_WIDGETS: ModuleWidgetItem[] = [
  item('work_stats', 0, 0, 12, 4, 6, 3),
  item('work_queue', 0, 4, 12, 14, 6, 8),
  item('clock_bar', 0, 18, 12, 4, 4, 3),
]

const myWorkSurface = makeSurface(EMPLOYEE_MY_WORK_WIDGET_CATALOG, DEFAULT_EMPLOYEE_MY_WORK_WIDGETS)
export const normalizeEmployeeMyWorkWidgetLayout = myWorkSurface.normalize
export const employeeMyWorkWidgetLayoutToBase = myWorkSurface.toBase

// --- Directory ---

export const EMPLOYEE_DIRECTORY_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('directory_toolbar', 'Search & filters', 'Search, department chips, and view mode', 12, 5, 4, 3),
  entry('people_directory', 'People directory', 'Employee grid or list', 12, 16, 6, 8),
]

export const DEFAULT_EMPLOYEE_DIRECTORY_WIDGETS: ModuleWidgetItem[] = [
  item('directory_toolbar', 0, 0, 12, 5, 4, 3),
  item('people_directory', 0, 5, 12, 16, 6, 8),
]

const directorySurface = makeSurface(
  EMPLOYEE_DIRECTORY_WIDGET_CATALOG,
  DEFAULT_EMPLOYEE_DIRECTORY_WIDGETS
)
export const normalizeEmployeeDirectoryWidgetLayout = directorySurface.normalize
export const employeeDirectoryWidgetLayoutToBase = directorySurface.toBase

// --- Performance ---

export const EMPLOYEE_PERFORMANCE_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('perf_summary', 'Performance summary', 'Score, reviews, peer feedback, achievements', 12, 5, 6, 3),
  entry('performance_trend', 'Performance trend', 'Score history chart', 12, 8, 4, 5),
  entry('review_history', 'Review history', 'Past performance reviews', 12, 10, 4, 5),
  entry('competencies', 'Skills & competencies', 'Competency ratings', 12, 10, 4, 5),
  entry('peer_recognition', 'Peer recognition', 'Peer feedback and recognition', 12, 10, 4, 5),
  entry('perf_achievements', 'Achievements', 'Performance achievements list', 12, 8, 4, 4),
]

export const DEFAULT_EMPLOYEE_PERFORMANCE_WIDGETS: ModuleWidgetItem[] = [
  item('perf_summary', 0, 0, 12, 5, 6, 3),
  item('performance_trend', 0, 5, 12, 8, 4, 5),
  item('review_history', 0, 13, 12, 10, 4, 5),
  item('competencies', 0, 23, 12, 10, 4, 5),
  item('peer_recognition', 0, 33, 12, 10, 4, 5),
  item('perf_achievements', 0, 43, 12, 8, 4, 4),
]

const performanceSurface = makeSurface(
  EMPLOYEE_PERFORMANCE_WIDGET_CATALOG,
  DEFAULT_EMPLOYEE_PERFORMANCE_WIDGETS
)
export const normalizeEmployeePerformanceWidgetLayout = performanceSurface.normalize
export const employeePerformanceWidgetLayoutToBase = performanceSurface.toBase

// --- Goals ---

export const EMPLOYEE_GOALS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('goals_summary', 'Goals summary', 'Progress and status KPIs', 12, 5, 6, 3),
  entry('active_goals', 'Active goals', 'Individual, team, and company goals', 12, 14, 6, 8),
  entry('completed_goals', 'Completed goals', 'Finished goals list', 12, 10, 4, 5),
]

export const DEFAULT_EMPLOYEE_GOALS_WIDGETS: ModuleWidgetItem[] = [
  item('goals_summary', 0, 0, 12, 5, 6, 3),
  item('active_goals', 0, 5, 12, 14, 6, 8),
  item('completed_goals', 0, 19, 12, 10, 4, 5),
]

const goalsSurface = makeSurface(EMPLOYEE_GOALS_WIDGET_CATALOG, DEFAULT_EMPLOYEE_GOALS_WIDGETS)
export const normalizeEmployeeGoalsWidgetLayout = goalsSurface.normalize
export const employeeGoalsWidgetLayoutToBase = goalsSurface.toBase

// --- Development / Learning ---

export const EMPLOYEE_DEVELOPMENT_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('learning_summary', 'Learning summary', 'Courses, certifications, and hours KPIs', 12, 5, 6, 3),
  entry('my_courses', 'My courses', 'In-progress and assigned courses', 12, 12, 4, 6),
  entry('course_catalog', 'Course catalog', 'Browse and search courses', 12, 12, 4, 6),
  entry('certifications', 'Certifications', 'Earned certifications', 12, 8, 4, 4),
  entry('skills', 'Skills', 'Skill categories and levels', 12, 10, 4, 5),
]

export const DEFAULT_EMPLOYEE_DEVELOPMENT_WIDGETS: ModuleWidgetItem[] = [
  item('learning_summary', 0, 0, 12, 5, 6, 3),
  item('my_courses', 0, 5, 12, 12, 4, 6),
  item('course_catalog', 0, 17, 12, 12, 4, 6),
  item('certifications', 0, 29, 12, 8, 4, 4),
  item('skills', 0, 37, 12, 10, 4, 5),
]

const developmentSurface = makeSurface(
  EMPLOYEE_DEVELOPMENT_WIDGET_CATALOG,
  DEFAULT_EMPLOYEE_DEVELOPMENT_WIDGETS
)
export const normalizeEmployeeDevelopmentWidgetLayout = developmentSurface.normalize
export const employeeDevelopmentWidgetLayoutToBase = developmentSurface.toBase

// --- Profile ---

export const EMPLOYEE_PROFILE_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('profile_summary', 'Profile summary', 'Photo and quick info', 12, 6, 4, 4),
  entry('personal_info', 'Personal information', 'Contact and personal details', 12, 10, 4, 5),
  entry('employment_details', 'Employment details', 'Role, department, and manager', 12, 8, 4, 4),
  entry('notification_prefs', 'Notification preferences', 'Email and in-app alerts', 12, 8, 4, 4),
  entry('privacy_settings', 'Privacy settings', 'Visibility controls', 12, 8, 4, 4),
  entry('account_security', 'Account security', 'Password and security actions', 12, 6, 4, 3),
]

export const DEFAULT_EMPLOYEE_PROFILE_WIDGETS: ModuleWidgetItem[] = [
  item('profile_summary', 0, 0, 12, 6, 4, 4),
  item('personal_info', 0, 6, 12, 10, 4, 5),
  item('employment_details', 0, 16, 12, 8, 4, 4),
  item('notification_prefs', 0, 24, 12, 8, 4, 4),
  item('privacy_settings', 0, 32, 12, 8, 4, 4),
  item('account_security', 0, 40, 12, 6, 4, 3),
]

const profileSurface = makeSurface(EMPLOYEE_PROFILE_WIDGET_CATALOG, DEFAULT_EMPLOYEE_PROFILE_WIDGETS)
export const normalizeEmployeeProfileWidgetLayout = profileSurface.normalize
export const employeeProfileWidgetLayoutToBase = profileSurface.toBase

// --- Jobs ---

export const EMPLOYEE_JOBS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('jobs_summary', 'Jobs summary', 'Open positions, applications, and saved KPIs', 12, 5, 6, 3),
  entry('browse_jobs', 'Browse jobs', 'Open roles with search and filters', 12, 14, 6, 8),
  entry('my_applications', 'My applications', 'Submitted applications', 12, 10, 4, 5),
  entry('saved_jobs', 'Saved jobs', 'Bookmarked openings', 12, 8, 4, 4),
]

export const DEFAULT_EMPLOYEE_JOBS_WIDGETS: ModuleWidgetItem[] = [
  item('jobs_summary', 0, 0, 12, 5, 6, 3),
  item('browse_jobs', 0, 5, 12, 14, 6, 8),
  item('my_applications', 0, 19, 12, 10, 4, 5),
  item('saved_jobs', 0, 29, 12, 8, 4, 4),
]

const jobsSurface = makeSurface(EMPLOYEE_JOBS_WIDGET_CATALOG, DEFAULT_EMPLOYEE_JOBS_WIDGETS)
export const normalizeEmployeeJobsWidgetLayout = jobsSurface.normalize
export const employeeJobsWidgetLayoutToBase = jobsSurface.toBase

// --- Registry ---

export interface EmployeeSurfaceConfig {
  id: EmployeeTabSurfaceId
  label: string
  catalog: WidgetCatalogEntry[]
  normalize: (raw: unknown) => ModuleWidgetLayout
  toBase: (layout: ModuleWidgetLayout) => ModuleWidgetLayout
}

export const EMPLOYEE_TAB_SURFACE_REGISTRY: Record<
  EmployeeTabSurfaceId,
  EmployeeSurfaceConfig
> = {
  feed: {
    id: 'feed',
    label: 'Feed',
    catalog: EMPLOYEE_FEED_WIDGET_CATALOG,
    normalize: normalizeEmployeeFeedWidgetLayout,
    toBase: employeeFeedWidgetLayoutToBase,
  },
  my_work: {
    id: 'my_work',
    label: 'My work',
    catalog: EMPLOYEE_MY_WORK_WIDGET_CATALOG,
    normalize: normalizeEmployeeMyWorkWidgetLayout,
    toBase: employeeMyWorkWidgetLayoutToBase,
  },
  directory: {
    id: 'directory',
    label: 'People',
    catalog: EMPLOYEE_DIRECTORY_WIDGET_CATALOG,
    normalize: normalizeEmployeeDirectoryWidgetLayout,
    toBase: employeeDirectoryWidgetLayoutToBase,
  },
  performance: {
    id: 'performance',
    label: 'Performance',
    catalog: EMPLOYEE_PERFORMANCE_WIDGET_CATALOG,
    normalize: normalizeEmployeePerformanceWidgetLayout,
    toBase: employeePerformanceWidgetLayoutToBase,
  },
  goals: {
    id: 'goals',
    label: 'Goals',
    catalog: EMPLOYEE_GOALS_WIDGET_CATALOG,
    normalize: normalizeEmployeeGoalsWidgetLayout,
    toBase: employeeGoalsWidgetLayoutToBase,
  },
  development: {
    id: 'development',
    label: 'Learning',
    catalog: EMPLOYEE_DEVELOPMENT_WIDGET_CATALOG,
    normalize: normalizeEmployeeDevelopmentWidgetLayout,
    toBase: employeeDevelopmentWidgetLayoutToBase,
  },
  profile: {
    id: 'profile',
    label: 'Profile',
    catalog: EMPLOYEE_PROFILE_WIDGET_CATALOG,
    normalize: normalizeEmployeeProfileWidgetLayout,
    toBase: employeeProfileWidgetLayoutToBase,
  },
  jobs: {
    id: 'jobs',
    label: 'Jobs',
    catalog: EMPLOYEE_JOBS_WIDGET_CATALOG,
    normalize: normalizeEmployeeJobsWidgetLayout,
    toBase: employeeJobsWidgetLayoutToBase,
  },
}

export function isEmployeeTabSurfaceId(value: string): value is EmployeeTabSurfaceId {
  return (EMPLOYEE_TAB_SURFACE_IDS as string[]).includes(value)
}

/** Map pathname under /employee to a layout surface. */
export function resolveEmployeeSurfaceId(pathname: string): EmployeeTabSurfaceId {
  const path = pathname.replace(/\/$/, '') || '/employee'
  if (path === '/employee' || path === '/employee/') return 'feed'
  if (path.startsWith('/employee/work')) return 'my_work'
  if (path.startsWith('/employee/directory')) return 'directory'
  if (path.startsWith('/employee/performance')) return 'performance'
  if (path.startsWith('/employee/goals')) return 'goals'
  if (path.startsWith('/employee/development')) return 'development'
  if (path.startsWith('/employee/profile')) return 'profile'
  if (path.startsWith('/employee/jobs')) return 'jobs'
  return 'feed'
}

export function getEmployeeSurfaceConfig(pathnameOrId: string): EmployeeSurfaceConfig {
  if (isEmployeeTabSurfaceId(pathnameOrId)) {
    return EMPLOYEE_TAB_SURFACE_REGISTRY[pathnameOrId]
  }
  return EMPLOYEE_TAB_SURFACE_REGISTRY[resolveEmployeeSurfaceId(pathnameOrId)]
}

export {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  removeWidgetFromLayout,
}
