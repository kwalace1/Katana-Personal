import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { createNotification } from './notifications'
import { getCloudProfile } from './friends'
import type { SharedItem, SharedKind } from './types'

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
  const payload: Omit<SharedItem, 'id'> = {
    kind: input.kind,
    title: input.title.trim(),
    body: input.body || '',
    data: input.data || {},
    ownerId: input.ownerId,
    memberIds: members,
    createdAt: now,
    updatedAt: now,
  }
  const ref = await addDoc(collection(getDb(), 'sharedItems'), payload)
  const owner = await getCloudProfile(input.ownerId)
  const recipients = members.filter((id) => id !== input.ownerId)
  await Promise.all(
    recipients.map((uid) =>
      createNotification({
        uid,
        kind: 'shared_item',
        title: 'Something new was shared',
        body: `${owner?.displayName || 'A friend'} shared “${payload.title}” with you.`,
        href: '/shared',
        meta: { kind: input.kind, itemId: ref.id },
      }),
    ),
  )
  return { id: ref.id, ...payload }
}

export async function listSharedItems(uid: string, kind?: SharedKind): Promise<SharedItem[]> {
  const q = query(collection(getDb(), 'sharedItems'), where('memberIds', 'array-contains', uid))
  const snap = await getDocs(q)
  let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SharedItem, 'id'>) }))
  if (kind) items = items.filter((i) => i.kind === kind)
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function updateSharedItem(
  id: string,
  patch: Partial<Pick<SharedItem, 'title' | 'body' | 'data' | 'memberIds'>>,
): Promise<void> {
  await updateDoc(doc(getDb(), 'sharedItems', id), {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export async function removeSharedItem(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'sharedItems', id))
}

/** Leave a shared item (or delete if you’re the last member / owner cleanup). */
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
  return null
}

