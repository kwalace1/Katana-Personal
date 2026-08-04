import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

export type NotificationKind =
  | 'friend_request'
  | 'friend_accepted'
  | 'shared_item'
  | 'circle_invite'
  | 'circle_joined'
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

export async function createNotification(input: {
  uid: string
  kind: NotificationKind
  title: string
  body: string
  href?: string
  meta?: Record<string, string>
}): Promise<void> {
  const now = new Date().toISOString()
  await addDoc(collection(getDb(), 'notifications'), {
    uid: input.uid,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href || '',
    read: false,
    createdAt: now,
    meta: input.meta || {},
  })
}

export async function listNotifications(uid: string, max = 40): Promise<AppNotification[]> {
  const q = query(
    collection(getDb(), 'notifications'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(max),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) }))
}

/** Live updates without Cloud Functions / polling. */
export function subscribeNotifications(
  uid: string,
  onChange: (items: AppNotification[]) => void,
  max = 40,
): Unsubscribe {
  const q = query(
    collection(getDb(), 'notifications'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(max),
  )
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, 'id'>) })))
    },
    () => {
      // index may still be building — fall back silently
    },
  )
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(getDb(), 'notifications', id), { read: true })
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const q = query(
    collection(getDb(), 'notifications'),
    where('uid', '==', uid),
    where('read', '==', false),
  )
  const snap = await getDocs(q)
  if (snap.empty) return
  const batch = writeBatch(getDb())
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }))
  await batch.commit()
}

export function unreadCount(items: AppNotification[]) {
  return items.filter((n) => !n.read).length
}
