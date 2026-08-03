import { MODULES, isRetiredModuleId, type ModuleId } from '@/lib/module-access'
import { splitModuleAccess } from '@/lib/module-access-permissions'

const ALL_MODULE_IDS = MODULES.map((m) => m.id)

function parsePilotModulesEnv(): ModuleId[] | null {
  const raw = (import.meta.env.VITE_PILOT_MODULES as string | undefined)?.trim()
  if (!raw) return null
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((id): id is ModuleId => ALL_MODULE_IDS.includes(id as ModuleId))
  return ids.length > 0 ? ids : null
}

/** When set, non-admin users are limited to this subset (intersected with their HR module_access). */
export function getPilotModuleAllowlist(): ModuleId[] | null {
  return parsePilotModulesEnv()
}

export function isPilotModeEnabled(): boolean {
  return getPilotModuleAllowlist() !== null
}

export function normalizeModuleIdList(list: unknown): ModuleId[] {
  if (typeof list === 'string') {
    try {
      return normalizeModuleIdList(JSON.parse(list))
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  return list.filter((id): id is ModuleId => ALL_MODULE_IDS.includes(id as ModuleId))
}

/** Intersect with pilot allowlist when pilot mode is on. */
export function clampModulesToPilot(modules: ModuleId[]): ModuleId[] {
  const pilot = getPilotModuleAllowlist()
  if (!pilot) return modules
  const allow = new Set(pilot)
  return modules.filter((id) => allow.has(id))
}

export interface PilotAccessOptions {
  /** Skip VITE_PILOT_MODULES clamping (enterprise / full-stack orgs). */
  bypassPilot?: boolean
}

/** Modules shown in HR when assigning access (pilot list ∩ org entitlement). */
export function getAssignableModulesForHr(
  orgEnabledModules?: ModuleId[] | null,
  options?: PilotAccessOptions,
): { id: ModuleId; label: string }[] {
  const pilot = options?.bypassPilot ? null : getPilotModuleAllowlist()
  let list = pilot ? MODULES.filter((m) => pilot.includes(m.id)) : [...MODULES]
  list = list.filter((m) => !isRetiredModuleId(m.id))
  if (orgEnabledModules?.length) {
    const orgSet = new Set(orgEnabledModules)
    list = list.filter((m) => orgSet.has(m.id))
  }
  return list
}

/** Effective sidebar modules for a non-admin user, clamped to pilot allowlist when enabled. */
export function applyMemberModuleAccess(raw: unknown, options?: PilotAccessOptions): ModuleId[] {
  const { modules } = splitModuleAccess(raw)
  if (options?.bypassPilot) return modules
  return clampModulesToPilot(modules)
}

/** Values persisted when an owner/admin saves module access (modules + HR permissions). */
export function sanitizeModuleAccessForSave(
  modules: unknown,
  orgEnabledModules?: ModuleId[] | null,
  options?: PilotAccessOptions,
): string[] {
  const { modules: navModules, permissions } = splitModuleAccess(modules)
  let clamped = options?.bypassPilot ? navModules : clampModulesToPilot(navModules)
  clamped = clamped.filter((id) => !isRetiredModuleId(id))
  if (orgEnabledModules?.length) {
    const orgSet = new Set(orgEnabledModules)
    clamped = clamped.filter((id) => orgSet.has(id))
  }
  const merged = [...clamped, ...permissions]
  if (merged.includes('hr-admin') && !merged.includes('hr')) {
    merged.push('hr')
  }
  if (merged.includes('wfm-manager') && !merged.includes('workforce')) {
    merged.push('workforce')
  }
  return [...new Set(merged)]
}
