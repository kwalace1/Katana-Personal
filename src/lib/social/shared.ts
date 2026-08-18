import { getSupabase } from '@/lib/supabase'
import { createId } from '@/lib/id'
import { createNotification } from './notifications'
import { getCloudProfile } from './friends'
import type { SharedItem, SharedKind } from './types'

type SharedRow = {
  id: string
  kind: SharedKind
  title: string
  body?: string | null
  data?: Record<string, unknown> | null
  owner_id: string
  member_ids: string[]
  created_at: string
  updated_at: string
}

function mapShared(row: SharedRow): SharedItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body || '',
    data: row.data || {},
    ownerId: row.owner_id,
    memberIds: row.member_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createSharedItem(input: {
  kind: SharedKind
  title: string
  body?: string
  data?: Record<string, unknown>
  ownerId: string
  memberIds: string[]
}): Promise<SharedItem> {
  const now = new Date().toISOString()
  const members = Array.from(new Set([input.ownerId, ...input.memberIds]))
  const id = createId()
  const row = {
    id,
    kind: input.kind,
    title: input.title.trim(),
    body: input.body || '',
    data: input.data || {},
    owner_id: input.ownerId,
    member_ids: members,
    created_at: now,
    updated_at: now,
  }
  const { data, error } = await getSupabase().from('shared_items').insert(row).select('*').single()
  if (error) throw error
  const item = mapShared(data as SharedRow)
  const owner = await getCloudProfile(input.ownerId)
  const recipients = members.filter((uid) => uid !== input.ownerId)
  await Promise.all(
    recipients.map((uid) =>
      createNotification({
        uid,
        kind: 'shared_item',
        title: 'Something new was shared',
        body: `${owner?.displayName || 'A friend'} shared “${item.title}” with you.`,
        href: '/shared',
        meta: { kind: input.kind, itemId: item.id },
      }),
    ),
  )
  return item
}

export async function listSharedItems(uid: string, kind?: SharedKind): Promise<SharedItem[]> {
  const { data, error } = await getSupabase()
    .from('shared_items')
    .select('*')
    .contains('member_ids', [uid])
  if (error) throw error
  let items = (data || []).map((d) => mapShared(d as SharedRow))
  if (kind) items = items.filter((i) => i.kind === kind)
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function updateSharedItem(
  id: string,
  patch: Partial<Pick<SharedItem, 'title' | 'body' | 'data' | 'memberIds'>>,
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title != null) row.title = patch.title
  if (patch.body != null) row.body = patch.body
  if (patch.data != null) row.data = patch.data
  if (patch.memberIds != null) row.member_ids = patch.memberIds
  const { error } = await getSupabase().from('shared_items').update(row).eq('id', id)
  if (error) throw error
}

export async function removeSharedItem(id: string): Promise<void> {
  const { error } = await getSupabase().from('shared_items').delete().eq('id', id)
  if (error) throw error
}

export async function leaveSharedItem(uid: string, item: SharedItem): Promise<void> {
  if (item.ownerId === uid) {
    await removeSharedItem(item.id)
    return
  }
  const memberIds = item.memberIds.filter((id) => id !== uid)
  if (memberIds.length === 0) {
    await removeSharedItem(item.id)
    return
  }
  await updateSharedItem(item.id, { memberIds })
}

export function sharedItemHref(item: SharedItem): string | null {
  const localId = typeof item.data?.localTaskId === 'string'
    ? item.data.localTaskId
    : typeof item.data?.localId === 'string'
      ? item.data.localId
      : null
  if (item.kind === 'task') return localId ? `/tasks?id=${localId}` : '/tasks'
  if (item.kind === 'event') {
    const date =
      typeof item.data?.starts_at === 'string' ? String(item.data.starts_at).slice(0, 10) : null
    return date ? `/calendar?date=${date}` : '/calendar'
  }
  if (item.kind === 'goal') return '/goals'
  if (item.kind === 'habit') return '/habits'
  if (item.kind === 'note') return '/notes'
  if (item.kind === 'file') return '/documents'
  if (item.kind === 'journal') return '/journal'
  if (item.kind === 'training_split') return '/health?area=fitness&tab=splits'
  if (item.kind === 'lift_session') return '/health?area=fitness&tab=progress'
  if (item.kind === 'meal' || item.kind === 'diet_plan') return '/health?area=wellness&tab=nutrition'
  return null
}
