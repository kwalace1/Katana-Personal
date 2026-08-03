/**
 * Resolve domain IDs (HR employee, CSM, technician, email) to auth user IDs for notifications.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getOrganizationId } from '@/lib/auth-helpers'
import { getEmployeeById } from '@/lib/hr-api'
import { getOrganizationUsers } from '@/lib/tenant-context'
import { normalizeDirectoryEmail } from '@/lib/employee-directory-presence'
import { getPlatformEmailDomains } from '@/lib/platform-support-access'
import {
  areNotificationsAvailable,
  createNotifications,
  type CreateNotificationInput,
  type NotificationSourceModule,
} from '@/lib/notifications-api'

export async function resolveUserIdFromEmail(
  email: string | null | undefined
): Promise<string | null> {
  const key = normalizeDirectoryEmail(email)
  if (!key || !isSupabaseConfigured) return null

  try {
    const orgId = await getOrganizationId()
    const users = await getOrganizationUsers(orgId)
    const match = users.find((u) => normalizeDirectoryEmail(u.email) === key)
    return match?.id ?? null
  } catch {
    return null
  }
}

export async function resolveUserIdFromHrEmployeeId(
  employeeId: string | null | undefined
): Promise<string | null> {
  if (!employeeId) return null
  const employee = await getEmployeeById(employeeId)
  return resolveUserIdFromEmail(employee?.email)
}

/** Resolve PM assignee by HR employee id or legacy display name. */
export async function resolveUserIdFromPmAssignee(options: {
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
}): Promise<string | null> {
  const byId = await resolveUserIdFromHrEmployeeId(options.assigneeEmployeeId)
  if (byId) return byId

  const name = options.assigneeName?.trim()
  if (!name || !isSupabaseConfigured) return null

  try {
    const orgId = await getOrganizationId()
    const { data } = await supabase
      .from('hr_employees')
      .select('email, name')
      .eq('organization_id', orgId)

    const normalized = name.toLowerCase()
    const match = (data ?? []).find((row) => {
      const employeeName = (row.name as string | null)?.trim().toLowerCase() ?? ''
      return employeeName === normalized
    })
    return match ? resolveUserIdFromEmail(match.email as string) : null
  } catch {
    return null
  }
}

function emailMatchesPlatformDomain(email: string, domains: string[]): boolean {
  const normalized = email.trim().toLowerCase()
  const at = normalized.lastIndexOf('@')
  if (at < 0) return false
  const domain = normalized.slice(at + 1)
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`))
}

/** Katana platform operators (owner/admin on allowed email domains). */
export async function resolveKatanaPlatformOperatorUserIds(): Promise<string[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase.rpc('get_katana_platform_operator_user_ids')
  if (!error && data?.length) {
    return [...new Set((data as { user_id: string }[]).map((row) => row.user_id))]
  }

  try {
    const orgId = await getOrganizationId()
    const users = await getOrganizationUsers(orgId)
    const domains = getPlatformEmailDomains()
    return users
      .filter((u) => {
        const role = (u as { role?: string }).role
        if (role !== 'owner' && role !== 'admin') return false
        return emailMatchesPlatformDomain((u.email as string) ?? '', domains)
      })
      .map((u) => u.id as string)
  } catch {
    return []
  }
}

export async function resolveUserIdFromCsmId(
  csmId: string | null | undefined
): Promise<string | null> {
  if (!csmId || !isSupabaseConfigured) return null
  const { data } = await supabase
    .from('csm_users')
    .select('email, auth_user_id')
    .eq('id', csmId)
    .maybeSingle()
  if (data?.auth_user_id) return data.auth_user_id as string
  return resolveUserIdFromEmail(data?.email)
}

/** Resolve CSM auth user ids for all stakeholders when client has no assigned CSM. */
export async function resolveCustomerSuccessStakeholderUserIds(): Promise<string[]> {
  return resolveModuleStakeholderUserIds('customer_success')
}

export async function resolveUserIdFromTechnicianId(
  technicianId: string | null | undefined
): Promise<string | null> {
  if (!technicianId || !isSupabaseConfigured) return null
  const { data } = await supabase
    .from('wfm_technicians')
    .select('user_id, email')
    .eq('id', technicianId)
    .maybeSingle()
  if (data?.user_id) return data.user_id as string
  return resolveUserIdFromEmail(data?.email as string | undefined)
}

/** Org owners and admins only. */
export async function resolveOrgAdminUserIds(): Promise<string[]> {
  if (!isSupabaseConfigured) return []
  try {
    const orgId = await getOrganizationId()
    const users = await getOrganizationUsers(orgId)
    return users
      .filter((u) => {
        const role = (u as { role?: string }).role
        return role === 'owner' || role === 'admin'
      })
      .map((u) => u.id as string)
  } catch {
    return []
  }
}

/** Org owners/admins plus HR employees with a given module in module_access. */
export async function resolveModuleStakeholderUserIds(
  moduleId: string
): Promise<string[]> {
  if (!isSupabaseConfigured) return []
  try {
    const orgId = await getOrganizationId()
    const [orgUsers, employeesResult] = await Promise.all([
      getOrganizationUsers(orgId),
      supabase
        .from('hr_employees')
        .select('email, module_access')
        .eq('organization_id', orgId),
    ])

    const ids = new Set<string>()
    const emailToUserId = new Map<string, string>()
    for (const u of orgUsers) {
      const key = normalizeDirectoryEmail(u.email)
      if (key) emailToUserId.set(key, u.id)
      const role = (u as { role?: string }).role
      if (role === 'owner' || role === 'admin') {
        ids.add(u.id)
      }
    }

    for (const row of employeesResult.data ?? []) {
      const access = row.module_access as string[] | null
      if (!access?.includes(moduleId)) continue
      const uid = emailToUserId.get(normalizeDirectoryEmail(row.email as string))
      if (uid) ids.add(uid)
    }

    return [...ids]
  } catch {
    return []
  }
}

type NotifyManyInput = Omit<CreateNotificationInput, 'recipientUserId' | 'organizationId'> & {
  recipientUserIds: string[]
  actorUserId?: string | null
  /** When true, the acting user still receives the notification (e.g. self-assignment). */
  includeActor?: boolean
}

export async function notifyUsers(input: NotifyManyInput): Promise<void> {
  if (!(await areNotificationsAvailable()) || !input.recipientUserIds.length) return

  let organizationId: string
  let actorUserId: string
  try {
    const { getCurrentUserId } = await import('@/lib/auth-helpers')
    organizationId = await getOrganizationId()
    actorUserId = input.actorUserId ?? (await getCurrentUserId())
  } catch {
    return
  }

  const recipients = [...new Set(input.recipientUserIds)].filter(
    (id) => id && (input.includeActor || id !== actorUserId)
  )
  if (!recipients.length) return

  const base: Omit<CreateNotificationInput, 'recipientUserId'> = {
    organizationId,
    actorUserId,
    sourceModule: input.sourceModule,
    notificationType: input.notificationType,
    title: input.title,
    body: input.body ?? null,
    linkPath: input.linkPath ?? null,
    metadata: input.metadata,
    dedupeKey: input.dedupeKey,
  }

  await createNotifications(recipients.map((recipientUserId) => ({ ...base, recipientUserId })))
}

export async function notifyUser(
  recipientUserId: string | null | undefined,
  input: Omit<NotifyManyInput, 'recipientUserIds' | 'recipientUserId'>
): Promise<void> {
  if (!recipientUserId) return
  await notifyUsers({ ...input, recipientUserIds: [recipientUserId] })
}

export type { NotificationSourceModule }
