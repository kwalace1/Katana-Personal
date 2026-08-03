/**
 * Module bundles by subscription tier and core suite definition.
 * Org-level entitlements resolve from enabled_modules → settings → tier defaults.
 */

import { MODULES, VISIBLE_MODULE_IDS, type ModuleId } from './module-access'

export const ALL_MODULE_IDS: ModuleId[] = MODULES.map((m) => m.id)

/** Always included with the platform — the Katana core suite. */
export const CORE_SUITE_MODULE_IDS: ModuleId[] = [
  'hub',
  'customer-success',
  'employee',
  'support',
]

export type OrgSubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise'

/** Default modules included when an org has no explicit enabled_modules list. */
export const TIER_DEFAULT_MODULES: Record<OrgSubscriptionTier, ModuleId[]> = {
  free: [...CORE_SUITE_MODULE_IDS],
  starter: [...CORE_SUITE_MODULE_IDS, 'projects', 'hr', 'careers'],
  professional: [
    ...CORE_SUITE_MODULE_IDS,
    'projects',
    'hr',
    'careers',
    'workforce',
    'inventory',
    'comms',
    'finance',
    'automation',
    'esign',
  ],
  enterprise: [...VISIBLE_MODULE_IDS],
}

export const TIER_LABELS: Record<OrgSubscriptionTier, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

export function isEnterpriseTier(tier: string | undefined | null): boolean {
  return tier === 'enterprise'
}

/** True when every product-visible module is in the org entitlement list. */
export function orgHasFullModuleStack(modules: readonly ModuleId[]): boolean {
  return VISIBLE_MODULE_IDS.every((id) => modules.includes(id))
}

/**
 * Enterprise orgs (or those with the full module list) bypass pilot env clamping.
 * HR module assignment is the only gate for non-admin users in these orgs.
 */
export function isUnrestrictedModuleOrg(
  tier: string | undefined | null,
  modules: readonly ModuleId[],
): boolean {
  return isEnterpriseTier(tier) || orgHasFullModuleStack(modules)
}

/** Human-readable label for a module id. */
export function moduleLabel(moduleId: ModuleId): string {
  return MODULES.find((m) => m.id === moduleId)?.label ?? moduleId
}
