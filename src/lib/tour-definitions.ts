import type { DriveStep } from 'driver.js'
import { TOUR_STEPS, KYI_COMPANY_TOUR_STEPS } from '@/lib/tour-training-steps'

export { TOUR_STEPS, KYI_COMPANY_TOUR_STEPS }

export type ModuleTourId =
  | 'launchpad'
  | 'hub'
  | 'hr'
  | 'workforce'
  | 'inventory'
  | 'customer-success'
  | 'kyi'
  | 'projects'
  | 'automation'
  | 'support'
  | 'finance'

export type TourStatus = 'started' | 'completed' | 'dismissed'

export interface ModuleTourMeta {
  id: ModuleTourId
  name: string
  description: string
  route: string
}

export const MODULE_TOUR_LIST: ModuleTourMeta[] = [
  {
    id: 'launchpad',
    name: 'Employee Launchpad',
    description: 'Your personal feed, profile, and shortcuts',
    route: '/employee',
  },
  {
    id: 'hub',
    name: 'Hub Dashboard',
    description: 'Overview, KPIs, and module shortcuts',
    route: '/hub',
  },
  {
    id: 'hr',
    name: 'Human Resources',
    description: 'Employees, recruitment, and performance',
    route: '/hr',
  },
  {
    id: 'workforce',
    name: 'Workforce',
    description: 'Work, team assignments, schedule, and time',
    route: '/workforce',
  },
  {
    id: 'inventory',
    name: 'Inventory',
    description: 'Stock, scan-in, check-out, and suppliers',
    route: '/inventory',
  },
  {
    id: 'customer-success',
    name: 'Customer Success & CRM',
    description: 'Pipeline, contacts, leads, and customer health',
    route: '/customer-success',
  },
  {
    id: 'kyi',
    name: 'KYI',
    description: 'Investor discovery and cap raise outreach',
    route: '/kyi',
  },
  {
    id: 'projects',
    name: 'Projects',
    description: 'Kanban, timeline, and project management',
    route: '/projects',
  },
  {
    id: 'automation',
    name: 'Automation',
    description: 'Org knowledge library and web tools for agents',
    route: '/automation',
  },
  {
    id: 'support',
    name: 'Katana Support',
    description: 'Issue reporting and product feedback',
    route: '/support',
  },
  {
    id: 'finance',
    name: 'Katana Finance',
    description: 'Bookkeeping, reconciliation, and tax readiness',
    route: '/finance',
  },
]

const TOUR_STORAGE_KEY = 'katana_tour_state'

export function getTourStorageKey(): string {
  return TOUR_STORAGE_KEY
}

export function loadTourState(): Partial<Record<ModuleTourId, TourStatus>> {
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Partial<Record<ModuleTourId, TourStatus>>
  } catch {
    return {}
  }
}

export function saveTourStatus(moduleId: ModuleTourId, status: TourStatus): void {
  const state = loadTourState()
  state[moduleId] = status
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state))
}

export function getTourStatus(moduleId: ModuleTourId): TourStatus | undefined {
  return loadTourState()[moduleId]
}

/** Pick tour steps for the current URL (KYI list vs company workspace). */
export function getTourStepsForPath(moduleId: ModuleTourId, pathname: string): DriveStep[] {
  if (moduleId === 'kyi') {
    if (/^\/kyi\/companies\/\d+/.test(pathname)) {
      return KYI_COMPANY_TOUR_STEPS
    }
    return TOUR_STEPS.kyi
  }
  return TOUR_STEPS[moduleId] ?? []
}

/** First-visit auto-prompt only on module home routes. */
export function shouldAutoPromptTour(moduleId: ModuleTourId, pathname: string): boolean {
  if (moduleId === 'launchpad') {
    return pathname === '/employee' || pathname === '/employee/' || pathname.startsWith('/employee/work')
  }
  if (moduleId === 'kyi') {
    return pathname === '/kyi' || pathname === '/kyi/'
  }
  const meta = getModuleTourMeta(moduleId)
  return pathname === meta.route || pathname === `${meta.route}/`
}

export function getModuleTourMeta(moduleId: ModuleTourId): ModuleTourMeta {
  const meta = MODULE_TOUR_LIST.find((m) => m.id === moduleId)
  if (!meta) throw new Error(`Unknown module tour: ${moduleId}`)
  return meta
}

/** Resolve route for tour navigation (launchpad uses /employee). */
export function getTourRoute(moduleId: ModuleTourId): string {
  return getModuleTourMeta(moduleId).route
}
