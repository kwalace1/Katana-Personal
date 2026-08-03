import { resolveWfmManagerAccess } from '@/lib/module-access-permissions'

/**
 * WFM module is available to anyone with `workforce` in module_access.
 * Manager console: org owner/admin, or `wfm-manager` in module_access.
 * Otherwise: My Work only (scoped to the logged-in employee's roster entry).
 */

export function canManageWfm(
  role: string | undefined | null,
  moduleAccess?: unknown
): boolean {
  return resolveWfmManagerAccess(role, moduleAccess)
}
