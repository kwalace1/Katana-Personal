/**
 * Resolve which modules an organization is entitled to and intersect with user access.
 */

import type { Organization } from '@/contexts/AuthContext'
import { excludeRetiredModules, type ModuleId } from './module-access'
import { getOrganizationId } from './auth-helpers'
import { supabase, isSupabaseConfigured } from './supabase'
import {
  ALL_MODULE_IDS,
  CORE_SUITE_MODULE_IDS,
  TIER_DEFAULT_MODULES,
  isEnterpriseTier,
  type OrgSubscriptionTier,
} from './module-bundles'
import { normalizeModuleIdList } from './pilot-access'
import {
  localDevFullModuleAccess,
  shouldUseLocalDevFullModuleStack,
} from './dev-module-access'
import {
  MODULE_INTEGRATION_EDGES,
  type ModuleIntegrationEdge,
  visibleIntegrationEdges,
} from './module-integrations'

export type OrgModuleSource = 'explicit' | 'settings' | 'tier'

export interface ResolvedOrgModules {
  modules: ModuleId[]
  source: OrgModuleSource
  tier: OrgSubscriptionTier
}

type OrgInput = Pick<Organization, 'subscription_tier' | 'settings' | 'name'> & {
  enabled_modules?: unknown
} | null

/** Katana operator org — always gets the full module stack regardless of tier. */
function isDwGrowthCapitalOrg(org: OrgInput): boolean {
  const name = (org?.name ?? '').toLowerCase()
  return name.includes('dw growth') && name.includes('capital')
}

function ensureBaselineModules(modules: ModuleId[]): ModuleId[] {
  const set = new Set<ModuleId>(excludeRetiredModules(modules))
  set.add('hub')
  for (const id of CORE_SUITE_MODULE_IDS) {
    set.add(id)
  }
  return [...set]
}

/** Modules this organization has purchased / been provisioned with. */
export function resolveOrgEnabledModules(org: OrgInput): ModuleId[] {
  return resolveOrgModulesDetail(org).modules
}

export function resolveOrgModulesDetail(org: OrgInput): ResolvedOrgModules {
  const tier = (org?.subscription_tier ?? 'free') as OrgSubscriptionTier

  const explicit = normalizeModuleIdList(org?.enabled_modules)

  if (isDwGrowthCapitalOrg(org) || isEnterpriseTier(tier)) {
    return {
      modules: excludeRetiredModules(ALL_MODULE_IDS),
      source: isDwGrowthCapitalOrg(org) ? 'explicit' : 'tier',
      tier: 'enterprise',
    }
  }

  if (
    shouldUseLocalDevFullModuleStack({
      subscriptionTier: tier,
      enabledModules: explicit,
    })
  ) {
    return {
      modules: excludeRetiredModules(localDevFullModuleAccess()),
      source: 'tier',
      tier: 'enterprise',
    }
  }

  if (explicit.length > 0) {
    return {
      modules: ensureBaselineModules(explicit),
      source: 'explicit',
      tier,
    }
  }

  const settingsModules = normalizeModuleIdList(
    (org?.settings as Record<string, unknown> | undefined)?.enabled_modules,
  )
  if (settingsModules.length > 0) {
    return {
      modules: ensureBaselineModules(settingsModules),
      source: 'settings',
      tier,
    }
  }

  const tierModules = TIER_DEFAULT_MODULES[tier] ?? TIER_DEFAULT_MODULES.free
  return {
    modules: excludeRetiredModules(tierModules),
    source: 'tier',
    tier,
  }
}

/** Effective user access = user assignment ∩ org entitlement. */
export function intersectModuleAccess(
  userModules: readonly ModuleId[],
  orgModules: readonly ModuleId[],
): ModuleId[] {
  const orgSet = new Set(orgModules)
  return userModules.filter((id) => orgSet.has(id))
}

export interface IntegrationPlan {
  /** Integrations available to the org based on purchased modules. */
  orgIntegrations: ModuleIntegrationEdge[]
  /** Integrations the current user can actually use. */
  userIntegrations: ModuleIntegrationEdge[]
  /** Module IDs the Hub should aggregate for this org. */
  hubSourceModules: ModuleId[]
  /** Module IDs the Hub should show to this user. */
  hubVisibleModules: ModuleId[]
  /** Integrations the org could enable by adding a module. */
  latentIntegrations: ModuleIntegrationEdge[]
}

const HUB_AGGREGATE_MODULES: ModuleId[] = [
  'projects',
  'customer-success',
  'hr',
  'careers',
  'inventory',
  'workforce',
  'support',
  'kyi',
  'finance',
  'automation',
]

export function buildIntegrationPlan(
  orgModules: readonly ModuleId[],
  userModules: readonly ModuleId[],
): IntegrationPlan {
  const orgSet = new Set(orgModules)
  const userSet = new Set(userModules)

  const orgIntegrations = visibleIntegrationEdges(orgModules)
  const userIntegrations = visibleIntegrationEdges(userModules)

  const hubSourceModules = HUB_AGGREGATE_MODULES.filter((id) => orgSet.has(id))
  const hubVisibleModules = HUB_AGGREGATE_MODULES.filter((id) => userSet.has(id))

  const activeOrgPairs = new Set(
    orgIntegrations.map((e) => `${e.from}:${e.to}`),
  )
  const latentIntegrations = MODULE_INTEGRATION_EDGES.filter((edge) => {
    const key = `${edge.from}:${edge.to}`
    if (activeOrgPairs.has(key)) return false
    const hasFrom = orgSet.has(edge.from)
    const hasTo = orgSet.has(edge.to)
    return hasFrom !== hasTo
  })

  return {
    orgIntegrations,
    userIntegrations,
    hubSourceModules,
    hubVisibleModules,
    latentIntegrations,
  }
}

export function orgHasModule(orgModules: readonly ModuleId[], moduleId: ModuleId): boolean {
  return orgModules.includes(moduleId)
}

/** Load org entitlements for the current session (HR saves, API guards). */
export async function fetchOrgModulesDetailForCurrentOrg(): Promise<ResolvedOrgModules> {
  if (!isSupabaseConfigured) return resolveOrgModulesDetail(null)
  try {
    const orgId = await getOrganizationId()
    const { data, error } = await supabase
      .from('organizations')
      .select('name, subscription_tier, settings, enabled_modules')
      .eq('id', orgId)
      .maybeSingle()
    if (error || !data) return resolveOrgModulesDetail(null)
    return resolveOrgModulesDetail(data as OrgInput)
  } catch {
    return resolveOrgModulesDetail(null)
  }
}

export async function fetchOrgEnabledModulesForCurrentOrg(): Promise<ModuleId[]> {
  return (await fetchOrgModulesDetailForCurrentOrg()).modules
}
