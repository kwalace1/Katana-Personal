import type { ModuleId } from '@/lib/module-access'
import {
  MODULE_TOUR_LIST,
  getModuleTourMeta,
  type ModuleTourId,
  type ModuleTourMeta,
} from '@/lib/tour-definitions'

export type OnboardingTourStatus = 'not_started' | 'in_progress' | 'completed'

export interface OnboardingTourState {
  status: OnboardingTourStatus
  currentModuleIndex?: number
  moduleQueue?: ModuleTourId[]
  startedAt?: string
  completedAt?: string
}

const STORAGE_PREFIX = 'katana_onboarding_tour_'

/** Full-system training order: launchpad first, then hub, then every other module. */
export const ONBOARDING_TOUR_SEQUENCE: ModuleTourId[] = [
  'launchpad',
  'hub',
  'hr',
  'workforce',
  'inventory',
  'customer-success',
  'kyi',
  'projects',
  'automation',
  'support',
  'finance',
]

/** Maps a tour segment to the module access key required to include it. */
export const TOUR_MODULE_ACCESS: Record<ModuleTourId, ModuleId> = {
  launchpad: 'employee',
  hub: 'hub',
  hr: 'hr',
  workforce: 'workforce',
  inventory: 'inventory',
  'customer-success': 'customer-success',
  kyi: 'kyi',
  projects: 'projects',
  automation: 'automation',
  support: 'support',
  finance: 'finance',
}

export function getOnboardingTourStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

export function loadOnboardingTourState(userId: string): OnboardingTourState | null {
  try {
    const raw = localStorage.getItem(getOnboardingTourStorageKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as OnboardingTourState
  } catch {
    return null
  }
}

export function saveOnboardingTourState(userId: string, state: OnboardingTourState): void {
  localStorage.setItem(getOnboardingTourStorageKey(userId), JSON.stringify(state))
}

/** Merge database profile fields into local storage (database wins). */
export function hydrateOnboardingTourFromProfile(
  userId: string,
  fields: {
    training_tour_completed_at?: string | null
    training_tour_progress?: OnboardingTourState | null
  } | null | undefined,
): void {
  if (!fields) return

  const completedAt = fields.training_tour_completed_at
  const progress = fields.training_tour_progress

  if (completedAt) {
    saveOnboardingTourState(userId, {
      status: 'completed',
      currentModuleIndex: progress?.currentModuleIndex,
      moduleQueue: progress?.moduleQueue,
      startedAt: progress?.startedAt,
      completedAt,
    })
    return
  }

  if (progress?.status) {
    saveOnboardingTourState(userId, progress)
  }
}

export function clearOnboardingTourState(userId: string): void {
  localStorage.removeItem(getOnboardingTourStorageKey(userId))
}

export function isOnboardingTourComplete(userId: string | null | undefined): boolean {
  if (!userId) return true
  return loadOnboardingTourState(userId)?.status === 'completed'
}

/** Per-module auto-prompts only after the full training tour is finished. */
export function shouldShowModuleTourPrompt(userId: string | null | undefined): boolean {
  return isOnboardingTourComplete(userId)
}

export function buildOnboardingModuleQueue(
  allowedModules: ModuleId[],
  sequence: ModuleTourId[] = ONBOARDING_TOUR_SEQUENCE,
): ModuleTourId[] {
  const allowed = new Set(allowedModules)
  return sequence.filter((tourId) => allowed.has(TOUR_MODULE_ACCESS[tourId]))
}

export function getOnboardingTourMeta(tourId: ModuleTourId): ModuleTourMeta {
  if (tourId === 'launchpad') {
    return {
      id: 'launchpad',
      name: 'Employee Launchpad',
      description: 'Your personal feed, profile, and shortcuts',
      route: '/employee',
    }
  }
  return getModuleTourMeta(tourId)
}

export function getOnboardingModuleLabel(tourId: ModuleTourId): string {
  return getOnboardingTourMeta(tourId).name
}

export function getOnboardingProgressLabel(
  currentIndex: number,
  queue: ModuleTourId[],
): string {
  const current = queue[currentIndex]
  const name = current ? getOnboardingModuleLabel(current) : 'Training'
  return `Training tour — ${name} (${currentIndex + 1} of ${queue.length})`
}

export function markOnboardingTourStarted(
  userId: string,
  queue: ModuleTourId[],
): OnboardingTourState {
  const state: OnboardingTourState = {
    status: 'in_progress',
    currentModuleIndex: 0,
    moduleQueue: queue,
    startedAt: new Date().toISOString(),
  }
  saveOnboardingTourState(userId, state)
  return state
}

export function markOnboardingTourAdvanced(
  userId: string,
  nextIndex: number,
  queue: ModuleTourId[],
): OnboardingTourState {
  const existing = loadOnboardingTourState(userId)
  const state: OnboardingTourState = {
    status: 'in_progress',
    currentModuleIndex: nextIndex,
    moduleQueue: queue,
    startedAt: existing?.startedAt ?? new Date().toISOString(),
  }
  saveOnboardingTourState(userId, state)
  return state
}

export function markOnboardingTourCompleted(userId: string): OnboardingTourState {
  const existing = loadOnboardingTourState(userId)
  const state: OnboardingTourState = {
    status: 'completed',
    currentModuleIndex: existing?.moduleQueue?.length
      ? existing.moduleQueue.length - 1
      : undefined,
    moduleQueue: existing?.moduleQueue,
    startedAt: existing?.startedAt,
    completedAt: new Date().toISOString(),
  }
  saveOnboardingTourState(userId, state)
  return state
}

/** All modules covered by the training tour (for setup guide display). */
export function listOnboardingTourModules(): ModuleTourMeta[] {
  return ONBOARDING_TOUR_SEQUENCE.map((id) => getOnboardingTourMeta(id))
}

/** Modules the user can train on given their access. */
export function listAccessibleOnboardingModules(allowedModules: ModuleId[]): ModuleTourMeta[] {
  const queue = buildOnboardingModuleQueue(allowedModules)
  return queue.map((id) => getOnboardingTourMeta(id))
}

export function countOnboardingModules(allowedModules: ModuleId[]): number {
  return buildOnboardingModuleQueue(allowedModules).length
}

/** Fallback when no modules are accessible (should not happen for signed-in users). */
export function defaultOnboardingQueue(): ModuleTourId[] {
  return MODULE_TOUR_LIST.map((m) => m.id)
}
