/**
 * System module keys used for HR employee access control.
 * When adding an employee, you select which modules they can access.
 * Sidebar and routes use this to show/allow only those modules.
 */

export const MODULES = [
  { id: 'hub', label: 'Hub' },
  { id: 'projects', label: 'Katana PM' },
  { id: 'inventory', label: 'Katana Inventory' },
  { id: 'customer-success', label: 'Katana Customers' },
  { id: 'workforce', label: 'WFM' },
  { id: 'hr', label: 'Katana HR' },
  { id: 'employee', label: 'Employee Portal' },
  { id: 'careers', label: 'Careers' },
  { id: 'manufacturing', label: 'Katana Facilities' },
  { id: 'automation', label: 'Automation' },
  { id: 'kyi', label: 'Know Your Investor' },
  { id: 'comms', label: 'Katana Comms' },
  { id: 'agents', label: 'Agent Office' },
  { id: 'support', label: 'Katana Support' },
  { id: 'finance', label: 'Katana Finance' },
  { id: 'esign', label: 'Katana E-Sign' },
] as const

export type ModuleId = (typeof MODULES)[number]['id']

/**
 * Modules kept in the codebase (routes/pages remain) but not offered in product UI,
 * packages, org entitlements, or HR module assignment.
 */
export const RETIRED_MODULE_IDS = ['manufacturing'] as const satisfies readonly ModuleId[]

export type RetiredModuleId = (typeof RETIRED_MODULE_IDS)[number]

export function isRetiredModuleId(id: string): id is RetiredModuleId {
  return (RETIRED_MODULE_IDS as readonly string[]).includes(id)
}

/** Modules shown in sidebar, hub, settings, and assignment UIs. */
export const VISIBLE_MODULES = MODULES.filter((m) => !isRetiredModuleId(m.id))

export const VISIBLE_MODULE_IDS: ModuleId[] = VISIBLE_MODULES.map((m) => m.id)

export function excludeRetiredModules(modules: readonly ModuleId[]): ModuleId[] {
  return modules.filter((id) => !isRetiredModuleId(id))
}

/** Path prefix for each module (used for sidebar and route matching). */
export const MODULE_PATH: Record<ModuleId, string> = {
  hub: '/hub',
  projects: '/projects',
  inventory: '/inventory',
  'customer-success': '/customer-success',
  workforce: '/workforce',
  hr: '/hr',
  employee: '/employee',
  careers: '/careers',
  manufacturing: '/manufacturing',
  automation: '/automation',
  kyi: '/kyi',
  comms: '/comms',
  agents: '/agents',
  support: '/support',
  finance: '/finance',
  esign: '/esign',
}

export function getModuleIdByPath(path: string): ModuleId | null {
  const normalized = path === '/' ? '' : path.replace(/\/$/, '')
  for (const [id, modulePath] of Object.entries(MODULE_PATH)) {
    if (normalized === modulePath || normalized.startsWith(modulePath + '/')) {
      return id as ModuleId
    }
  }
  return null
}

export function isProductVisibleModulePath(path: string): boolean {
  const id = getModuleIdByPath(path)
  if (!id) return true
  return !isRetiredModuleId(id)
}
