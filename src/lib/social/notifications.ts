import { getSupabase } from '@/lib/supabase'
import { createId } from '@/lib/id'
import type { Unsubscribe } from './friends'

export type NotificationKind =
  | 'friend_request'
  | 'friend_accepted'
  | 'shared_item'
  | 'circle_invite'
  | 'circle_joined'
  | 'post_like'
  | 'post_comment'
  | 'post_repost'
  | 'generic'

export interface AppNotification {
  id: string
  uid: string
  kind: NotificationKind
  title: string
  body: string
  href?: string
  read: boolean
  createdAt: string
  meta?: Record<string, string>
}

type NotifRow = {
  id: string
  uid: string
  kind: NotificationKind
  title: string
  body: string
  href?: string | null
  read: boolean
  created_at: string
  meta?: Record<string, string> | null
}

function mapNotif(row: NotifRow): AppNotification {
  return {
    id: row.id,
    uid: row.uid,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href || undefined,
    read: row.read,
    createdAt: row.created_at,
    meta: row.meta || undefined,
  }
}

export async function createNotification(input: {
  uid: string
  kind: NotificationKind
  title: string
  body: string
  href?: string
  meta?: Record<string, string>
}): Promise<void> {
  if (!input.uid) return
  const now = new Date().toISOString()
  const { error } = await getSupabase().from('notifications').insert({
    id: createId(),
    uid: input.uid,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href || '',
    read: false,
    created_at: now,
    meta: input.meta || {},
  })
  if (error) throw error
}

/** Notify a post author about engagement (never notifies yourself). */
export async function notifyPostEngagement(input: {
  authorId: string
  actorId: string
  actorName: string
  kind: 'post_like' | 'post_comment' | 'post_repost'
  postId: string
  preview?: string
}): Promise<void> {
  if (!input.authorId || input.authorId === input.actorId) return
  const name = input.actorName.trim() || 'Someone'
  const title =
    input.kind === 'post_like'
      ? `${name} liked your post`
      : input.kind === 'post_comment'
        ? `${name} commented on your post`
        : `${name} reposted your post`
  const body =
    input.preview?.trim() ||
    (input.kind === 'post_comment' ? 'Open Social to read it' : 'Open Social to see it')
  try {
    await createNotification({
      uid: input.authorId,
      kind: input.kind,
      title,
      body: body.slice(0, 180),
      href: '/social',
      meta: { postId: input.postId, actorId: input.actorId },
    })
  } catch {
    // Never block the like/comment/repost on notification failure
  }
}

export async function listNotifications(uid: string, max = 40): Promise<AppNotification[]> {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select('*')
    .eq('uid', uid)
    .order('created_at', { ascending: false })
    .limit(max)
  if (error) throw error
  return (data || []).map((d) => mapNotif(d as NotifRow))
}

export function subscribeNotifications(
  uid: string,
  onChange: (items: AppNotification[]) => void,
  max = 40,
): Unsubscribe {
  const supabase = getSupabase()
  let cancelled = false

  const refresh = () => {
    void listNotifications(uid, max)
      .then((items) => {
        if (!cancelled) onChange(items)
      })
      .catch(() => {
        // index / RLS may still be settling
      })
  }

  refresh()

  // Unique topic per subscriber — reusing `notifications:${uid}` throws if two
  // components subscribe (bell + toast) because .on() after subscribe() is forbidden.
  const topic = `notifications:${uid}:${createId()}`
  try {
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `uid=eq.${uid}` },
        refresh,
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  } catch (err) {
    console.warn('Realtime notifications unavailable; polling only', err)
    return () => {
      cancelled = true
    }
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await getSupabase().from('notifications').update({ read: true }).eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ read: true })
    .eq('uid', uid)
    .eq('read', false)
  if (error) throw error
}

export function unreadCount(items: AppNotification[]) {
  return items.filter((n) => !n.read).length
}
