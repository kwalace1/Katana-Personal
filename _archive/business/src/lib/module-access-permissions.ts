import { MODULES, type ModuleId } from '@/lib/module-access'

/** Stored in hr_employees.module_access but not a sidebar route. */
export const HR_PERMISSION_IDS = ['hr-admin'] as const
export const WFM_PERMISSION_IDS = ['wfm-manager'] as const

export type HrPermissionId = (typeof HR_PERMISSION_IDS)[number]
export type WfmPermissionId = (typeof WFM_PERMISSION_IDS)[number]
export type ModulePermissionId = HrPermissionId | WfmPermissionId

export const HR_PERMISSION_OPTIONS: {
  id: HrPermissionId
  label: string
  description: string
}[] = [
  {
    id: 'hr-admin',
    label: 'Katana HR — Admin',
    description:
      'Full HR management (recruitment, employee roster, analytics, module access). Requires Katana HR.',
  },
]

export const WFM_PERMISSION_OPTIONS: {
  id: WfmPermissionId
  label: string
  description: string
}[] = [
  {
    id: 'wfm-manager',
    label: 'Katana Workforce — Manager',
    description:
      'Full manager console (scheduling, team roster, timesheets, reports). Without this, only My Work is available.',
  },
]

const ALL_NAV_MODULE_IDS = new Set(MODULES.map((m) => m.id))
const HR_PERMISSION_SET = new Set<string>(HR_PERMISSION_IDS)
const WFM_PERMISSION_SET = new Set<string>(WFM_PERMISSION_IDS)
const ALL_PERMISSION_SET = new Set<string>([...HR_PERMISSION_IDS, ...WFM_PERMISSION_IDS])

export function isHrPermissionId(id: string): id is HrPermissionId {
  return HR_PERMISSION_SET.has(id)
}

export function isWfmPermissionId(id: string): id is WfmPermissionId {
  return WFM_PERMISSION_SET.has(id)
}

export function isModulePermissionId(id: string): id is ModulePermissionId {
  return ALL_PERMISSION_SET.has(id)
}

export function isNavigableModuleId(id: string): id is ModuleId {
  return ALL_NAV_MODULE_IDS.has(id as ModuleId)
}

export function splitModuleAccess(raw: unknown): {
  modules: ModuleId[]
  permissions: ModulePermissionId[]
} {
  if (typeof raw === 'string') {
    try {
      return splitModuleAccess(JSON.parse(raw))
    } catch {
      return { modules: [], permissions: [] }
    }
  }
  if (!Array.isArray(raw)) return { modules: [], permissions: [] }

  const modules: ModuleId[] = []
  const permissions: ModulePermissionId[] = []
  for (const id of raw) {
    if (typeof id !== 'string') continue
    if (isModulePermissionId(id)) permissions.push(id)
    else if (isNavigableModuleId(id)) modules.push(id)
  }
  return { modules, permissions }
}

export function mergeModuleAccess(modules: ModuleId[], permissions: string[]): string[] {
  const merged = [...modules, ...permissions.filter(isModulePermissionId)]
  return [...new Set(merged)]
}

export function hasHrAdminPermission(moduleAccess: unknown): boolean {
  return splitModuleAccess(moduleAccess).permissions.includes('hr-admin')
}

export function hasWfmManagerPermission(moduleAccess: unknown): boolean {
  return splitModuleAccess(moduleAccess).permissions.includes('wfm-manager')
}

export function resolveHrAdminAccess(
  orgRole: string | undefined | null,
  moduleAccess: unknown
): boolean {
  if (orgRole === 'owner' || orgRole === 'admin') return true
  return hasHrAdminPermission(moduleAccess)
}

export function resolveWfmManagerAccess(
  orgRole: string | undefined | null,
  moduleAccess: unknown
): boolean {
  if (orgRole === 'owner' || orgRole === 'admin') return true
  return hasWfmManagerPermission(moduleAccess)
}

/** Toggle a module or permission id with hr / workforce coupling rules. */
export function applyModuleAccessToggle(current: string[], id: string, checked: boolean): string[] {
  let next = checked ? [...current, id] : current.filter((x) => x !== id)
  if (id === 'hr-admin' && checked && !next.includes('hr')) {
    next.push('hr')
  }
  if (id === 'hr' && !checked) {
    next = next.filter((x) => x !== 'hr-admin')
  }
  if (id === 'wfm-manager' && checked && !next.includes('workforce')) {
    next.push('workforce')
  }
  if (id === 'workforce' && !checked) {
    next = next.filter((x) => x !== 'wfm-manager')
  }
  return [...new Set(next)]
}

export function getModuleAccessLabel(id: string): string {
  const mod = MODULES.find((m) => m.id === id)
  if (mod) return mod.label
  const hrPerm = HR_PERMISSION_OPTIONS.find((p) => p.id === id)
  if (hrPerm) return hrPerm.label
  const wfmPerm = WFM_PERMISSION_OPTIONS.find((p) => p.id === id)
  if (wfmPerm) return wfmPerm.label
  return id
}

/** Normalize full module_access array for persistence (modules + permissions). */
export function sanitizeFullModuleAccess(raw: unknown): string[] {
  const { modules, permissions } = splitModuleAccess(raw)
  let list = mergeModuleAccess(modules, permissions)
  if (list.includes('hr-admin') && !list.includes('hr')) {
    list = [...list, 'hr']
  }
  if (list.includes('wfm-manager') && !list.includes('workforce')) {
    list = [...list, 'workforce']
  }
  return list
}
