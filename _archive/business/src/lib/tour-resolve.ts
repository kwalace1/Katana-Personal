import type { DriveStep } from 'driver.js'
import { getTourStepsForPath, type ModuleTourId } from '@/lib/tour-definitions'

/** Primary anchor per module — tour waits for this before starting (page fully rendered). */
const MODULE_READY_SELECTOR: Partial<Record<ModuleTourId, string>> = {
  launchpad: '[data-tour="launchpad-welcome"]',
  hub: '[data-tour="hub-modules"]',
  hr: '[data-tour="hr-tabs"]',
  workforce: '[data-tour="wfm-tabs"]',
  inventory: '[data-tour="inventory-header"]',
  'customer-success': '[data-tour="cs-health"]',
  kyi: '[data-tour="kyi-workflow"]',
  projects: '[data-tour="projects-header"]',
  automation: '[data-tour="automation-documents"]',
  support: '[data-tour="support-header"]',
  finance: '[data-tour="finance-header"]',
}

/** Fallback anchors when the primary target is slow — at least start the tour. */
const MODULE_FALLBACK_SELECTORS: Partial<Record<ModuleTourId, string[]>> = {
  launchpad: ['[data-tour="launchpad-nav"]', '[data-tour="launchpad-hub-link"]'],
  hub: ['[data-tour="hub-header"]', '[data-tour="hub-quick-actions"]'],
  kyi: ['[data-tour="kyi-header"]'],
  projects: ['[data-tour="projects-header"]', '[data-tour="projects-tabs"]'],
  automation: ['[data-tour="automation-ask-agent"]', '[data-tour="automation-sidebar-header"]'],
}

export function isTourElementVisible(selector: string): boolean {
  const el = document.querySelector(selector)
  if (!el) return false
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  return true
}

/** Skip steps whose targets are missing or not visible (e.g. hidden tab panels). */
export function resolveTourSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    if (!step.element) return false
    const selector = typeof step.element === 'string' ? step.element : null
    if (!selector) return false
    return isTourElementVisible(selector)
  })
}

function isModuleReady(moduleId: ModuleTourId): boolean {
  const primary = MODULE_READY_SELECTOR[moduleId]
  if (primary && isTourElementVisible(primary)) return true

  const fallbacks = MODULE_FALLBACK_SELECTORS[moduleId] ?? []
  const visibleFallbacks = fallbacks.filter(isTourElementVisible).length
  if (visibleFallbacks >= 2) return true
  if (visibleFallbacks >= 1 && !primary) return true

  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Poll until module tour targets are on screen (data loaded, layout painted).
 * Used by the training tour before starting each module segment.
 */
export async function waitForTourReady(
  moduleId: ModuleTourId,
  pathname: string,
  options?: { maxMs?: number; intervalMs?: number; minSteps?: number },
): Promise<DriveStep[]> {
  const maxMs = options?.maxMs ?? 20_000
  const intervalMs = options?.intervalMs ?? 300
  const minSteps = options?.minSteps ?? 1
  const allSteps = getTourStepsForPath(moduleId, pathname)
  const deadline = Date.now() + maxMs

  while (Date.now() < deadline) {
    const resolved = resolveTourSteps(allSteps)
    if (resolved.length >= minSteps && isModuleReady(moduleId)) {
      return resolved
    }
    await sleep(intervalMs)
  }

  return resolveTourSteps(allSteps)
}
