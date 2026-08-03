import * as hrApi from '@/lib/hr-api'
import { getOrganizationId } from '@/lib/auth-helpers'
import { getOrganizationUsers } from '@/lib/tenant-context'
import {
  deriveEmployeePresence,
  normalizeDirectoryEmail,
  presenceLabel,
  type EmployeePresenceStatus,
} from '@/lib/employee-directory-presence'

export interface EmployeeDirectoryEntry {
  id: string
  name: string
  position: string
  department: string
  location: string
  email: string
  phone: string
  manager: string
  photo: string
  timezone: string
  /** Linked Katana user_profiles.id for Comms DMs, when email matches an org member */
  katanaUserId: string | null
  lastLoginAt: string | null
  presence: EmployeePresenceStatus
  presenceLabel: string
}

export async function loadEmployeeDirectory(): Promise<EmployeeDirectoryEntry[]> {
  const [employees, orgId] = await Promise.all([hrApi.getAllEmployees(), getOrganizationId()])
  const orgUsers = orgId ? await getOrganizationUsers(orgId) : []

  const usersByEmail = new Map<
    string,
    { id: string; last_login_at: string | null }
  >()
  for (const u of orgUsers) {
    const key = normalizeDirectoryEmail(u.email)
    if (!key) continue
    usersByEmail.set(key, {
      id: u.id,
      last_login_at: (u as { last_login_at?: string | null }).last_login_at ?? null,
    })
  }

  const now = Date.now()

  return employees.map((e) => {
    const emailKey = normalizeDirectoryEmail(e.email)
    const linked = emailKey ? usersByEmail.get(emailKey) : undefined
    const katanaUserId = linked?.id ?? null
    const lastLoginAt = linked?.last_login_at ?? null
    const presence = deriveEmployeePresence(!!katanaUserId, lastLoginAt, now)

    return {
      id: e.id,
      name: e.name,
      position: e.position,
      department: e.department,
      location: (e as hrApi.Employee & { location?: string }).location ?? '',
      email: e.email ?? '',
      phone: e.phone ?? '',
      manager: e.manager?.name ?? '',
      photo: e.photo_url ?? '',
      timezone: (e as hrApi.Employee & { timezone?: string }).timezone ?? '',
      katanaUserId,
      lastLoginAt,
      presence,
      presenceLabel: presenceLabel(presence, lastLoginAt, now),
    }
  })
}
