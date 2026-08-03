/**
 * Local development overrides — full module stack on localhost for owner/admin testing.
 */

import { VISIBLE_MODULE_IDS, type ModuleId } from './module-access'
import { clampModulesToPilot } from './pilot-access'

export function isLocalDevEnvironment(): boolean {
  return import.meta.env.DEV === true && import.meta.env.MODE !== 'test'
}

/** All product-visible modules, optionally clamped by VITE_PILOT_MODULES. */
export function localDevFullModuleAccess(): ModuleId[] {
  return clampModulesToPilot([...VISIBLE_MODULE_IDS])
}

/**
 * On localhost, always expose the full product module stack so new modules
 * (and integrations) can be tested without hand-editing org entitlements.
 */
export function shouldUseLocalDevFullModuleStack(_options: {
  subscriptionTier: string | undefined | null
  enabledModules: ModuleId[]
}): boolean {
  return isLocalDevEnvironment()
}
