/**
 * Cross-module in-app notifications (persisted in user_notifications).
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'

export type NotificationSourceModule =
  | 'comms'
  | 'projects'
  | 'inventory'
  | 'customer_success'
  | 'hr'
  | 'workforce'
  | 'hub'
  | 'general'
  | 'support'
  | 'kyi'
  | 'kyc'
  | 'finance'

export interface UserNotification {
  id: string
  organization_id: string
  recipient_user_id: string
  actor_user_id: string | null
  source_module: NotificationSourceModule
  notification_type: string
  title: string
  body: string | null
  link_path: string | null
  metadata: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface CreateNotificationInput {
  recipientUserId: string
  organizationId: string
  actorUserId?: string | null
  sourceModule: NotificationSourceModule
  notificationType: string
  title: string
  body?: string | null
  linkPath?: string | null
  metadata?: Record<string, unknown>
  /** When set, only one notification per recipient + type + dedupe key is stored. */
  dedupeKey?: string
}

async function resolveOrganizationId(providedOrgId?: string): Promise<string | null> {
  if (providedOrgId) return providedOrgId
  const userId = await getCurrentUserId()
  const { data } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('id', userId)
    .single()
  return data?.organization_id ?? null
}

export function isNotificationsTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('user_notifications') ||
    msg.includes('does not exist')
  )
}

export async function areNotificationsAvailable(): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from('user_notifications')
    .select('id')
    .eq('recipient_user_id', userId)
    .limit(1)
  return !isNotificationsTableMissing(error)
}

export async function fetchUserNotifications(options?: {
  limit?: number
  unreadOnly?: boolean
}): Promise<UserNotification[]> {
  if (!isSupabaseConfigured) return []
  const limit = options?.limit ?? 50
  const userId = await getCurrentUserId()

  let query = supabase
    .from('user_notifications')
    .select('*')
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options?.unreadOnly) {
    query = query.is('read_at', null)
  }

  const { data, error } = await query
  if (error) {
    if (isNotificationsTableMissing(error)) return []
    console.error('Error fetching notifications:', error)
    return []
  }
  return (data ?? []) as UserNotification[]
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<UserNotification | null> {
  if (!isSupabaseConfigured) return null

  const actorUserId = input.actorUserId ?? (await getCurrentUserId())

  // Pre-flight RLS guard. The user_notifications INSERT policies accept a row
  // only when (organization_id = my org AND actor is null or me) OR
  // (recipient = me AND organization_id = my org). The "sender notifies others"
  // path can build a row that satisfies neither (e.g. actor is another user and
  // the recipient isn't me); firing it anyway just yields a rejected request and
  // a Postgres RLS-violation log line every time. Skip those — this mirrors the
  // DB policy exactly, so every row that WOULD insert still does.
  try {
    const currentUserId = await getCurrentUserId()
    const myOrgId = await getOrganizationId()
    const orgOk = input.organizationId === myOrgId
    const actorOk = actorUserId == null || actorUserId === currentUserId
    const recipientIsSelf = input.recipientUserId === currentUserId
    if (!(orgOk && (actorOk || recipientIsSelf))) {
      return null
    }
  } catch {
    // Couldn't resolve current user/org — fall through and let RLS decide
    // (unchanged behaviour rather than silently dropping a valid notification).
  }

  const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) }
  if (input.dedupeKey) {
    metadata.dedupe_key = input.dedupeKey
  }

  const { data, error } = await supabase
    .from('user_notifications')
    .insert({
      organization_id: input.organizationId,
      recipient_user_id: input.recipientUserId,
      actor_user_id: actorUserId,
      source_module: input.sourceModule,
      notification_type: input.notificationType,
      title: input.title,
      body: input.body ?? null,
      link_path: input.linkPath ?? null,
      metadata,
    })
    .select()
    .single()

  if (error) {
    if (isNotificationsTableMissing(error)) return null
    // Unique dedupe — treat as success
    if (error.code === '23505') return null
    console.error('Error creating notification:', error)
    return null
  }
  return data as UserNotification
}

export async function createNotifications(
  inputs: CreateNotificationInput[]
): Promise<void> {
  if (!inputs.length || !isSupabaseConfigured) return
  await Promise.all(inputs.map((input) => createNotification(input)))
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('recipient_user_id', userId)

  if (error && !isNotificationsTableMissing(error)) {
    console.error('Error marking notification read:', error)
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!isSupabaseConfigured) return
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', userId)
    .is('read_at', null)

  if (error && !isNotificationsTableMissing(error)) {
    console.error('Error marking all notifications read:', error)
  }
}

export function subscribeToUserNotifications(
  userId: string,
  onNotification: (notification: UserNotification) => void
): () => void {
  const channel = supabase
    .channel(`user-notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'user_notifications',
        filter: `recipient_user_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new as UserNotification)
      }
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function getOrganizationIdForNotifications(): Promise<string | null> {
  return resolveOrganizationId()
}
