import { resolveHrAdminAccess } from '@/lib/module-access-permissions'

/**
 * HR module is available to anyone with `hr` in module_access.
 * Full HR admin UI: org owner/admin, or `hr-admin` in module_access.
 * Otherwise: self-service tabs scoped to the logged-in employee only.
 */

export const HR_MAIN_TAB_IDS = [
  'dashboard',
  'recruitment',
  'job-listings',
  'calendar',
  'time-off',
  'employees',
  'performance',
  'goals',
  'analytics',
  'development',
] as const

export type HrMainTabId = (typeof HR_MAIN_TAB_IDS)[number]

/** Org-wide HR admin tabs (recruitment, roster management, analytics, etc.). */
export const HR_ADMIN_ONLY_TAB_IDS: readonly HrMainTabId[] = [
  'recruitment',
  'job-listings',
  'analytics',
] as const

/** Tabs any user with HR module access can use (scoped to their own data in HRPage). */
export const HR_MEMBER_TAB_IDS: readonly HrMainTabId[] = [
  'dashboard',
  'calendar',
  'time-off',
  'employees',
  'performance',
  'goals',
  'development',
] as const

export const HR_TAB_LABELS: Record<HrMainTabId, string> = {
  dashboard: 'Dashboard',
  recruitment: 'Recruitment',
  'job-listings': 'Job Listings',
  calendar: 'Calendar',
  'time-off': 'Time off',
  employees: 'Employees',
  performance: 'Performance',
  goals: 'Goals',
  analytics: 'Analytics',
  development: 'Development',
}

/** Label for the employees tab when the user only sees their own record. */
export const HR_MEMBER_EMPLOYEES_TAB_LABEL = 'My profile'

export function canManageHrAdmin(
  role: string | undefined | null,
  moduleAccess?: unknown
): boolean {
  return resolveHrAdminAccess(role, moduleAccess)
}

export function getVisibleHrMainTabs(isHrAdmin: boolean): HrMainTabId[] {
  return isHrAdmin ? [...HR_MAIN_TAB_IDS] : [...HR_MEMBER_TAB_IDS]
}

export function isHrMainTabVisible(tab: string, isHrAdmin: boolean): boolean {
  return getVisibleHrMainTabs(isHrAdmin).includes(tab as HrMainTabId)
}

export function getHrEmployeesTabLabel(isHrAdmin: boolean): string {
  return isHrAdmin ? HR_TAB_LABELS.employees : HR_MEMBER_EMPLOYEES_TAB_LABEL
}
