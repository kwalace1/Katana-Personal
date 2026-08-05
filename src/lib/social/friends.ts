import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  deleteDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import {
  DEFAULT_SHARE_PREFS,
  type CloudProfile,
  type Friendship,
  type SharePrefs,
} from './types'
import { createNotification } from './notifications'

function codeFromUid(uid: string) {
  return uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase().padEnd(6, 'X')
}

function pairId(a: string, b: string) {
  return [a, b].sort().join('_')
}

function blockId(blocker: string, blocked: string) {
  return `${blocker}_${blocked}`
}

export async function ensureCloudProfile(input: {
  uid: string
  email: string
  displayName: string
}): Promise<CloudProfile> {
  const db = getDb()
  const ref = doc(db, 'profiles', input.uid)
  const existing = await getDoc(ref)
  const now = new Date().toISOString()
  if (existing.exists()) {
    const data = existing.data() as CloudProfile
    return {
      ...data,
      sharePrefs: { ...DEFAULT_SHARE_PREFS, ...(data.sharePrefs || {}) },
    }
  }
  const friendCode = codeFromUid(input.uid)
  const profile: CloudProfile = {
    uid: input.uid,
    email: input.email,
    displayName: input.displayName.trim() || 'Friend',
    friendCode,
    sharePrefs: { ...DEFAULT_SHARE_PREFS },
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, profile)
  await setDoc(doc(db, 'friendCodes', friendCode), { uid: input.uid, code: friendCode })
  return profile
}

export async function getCloudProfile(uid: string): Promise<CloudProfile | null> {
  const snap = await getDoc(doc(getDb(), 'profiles', uid))
  if (!snap.exists()) return null
  const data = snap.data() as CloudProfile
  return { ...data, sharePrefs: { ...DEFAULT_SHARE_PREFS, ...(data.sharePrefs || {}) } }
}

export async function updateCloudProfile(
  uid: string,
  patch: Partial<Pick<CloudProfile, 'displayName' | 'sharePrefs'>>,
): Promise<void> {
  await updateDoc(doc(getDb(), 'profiles', uid), {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export async function findUidByFriendCode(code: string): Promise<string | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  const snap = await getDoc(doc(getDb(), 'friendCodes', normalized))
  if (!snap.exists()) return null
  return (snap.data() as { uid: string }).uid
}

export async function isBlockedEither(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([
    getDoc(doc(getDb(), 'blocks', blockId(a, b))),
    getDoc(doc(getDb(), 'blocks', blockId(b, a))),
  ])
  return x.exists() || y.exists()
}

export async function blockUser(blocker: string, blocked: string): Promise<void> {
  if (blocker === blocked) throw new Error('That’s you.')
  await setDoc(doc(getDb(), 'blocks', blockId(blocker, blocked)), {
    blocker,
    blocked,
    createdAt: new Date().toISOString(),
  })
  const friendshipId = pairId(blocker, blocked)
  const ref = doc(getDb(), 'friendships', friendshipId)
  const existing = await getDoc(ref)
  if (existing.exists()) await deleteDoc(ref)
}

export async function listBlockedIds(blocker: string): Promise<string[]> {
  const q = query(collection(getDb(), 'blocks'), where('blocker', '==', blocker))
  const snap = await getDocs(q)
  return snap.docs.map((d) => (d.data() as { blocked: string }).blocked)
}

export async function requestFriend(fromUid: string, toUid: string): Promise<Friendship> {
  if (fromUid === toUid) throw new Error('That’s you.')
  if (await isBlockedEither(fromUid, toUid)) {
    throw new Error('You can’t connect with that person.')
  }
  const id = pairId(fromUid, toUid)
  const ref = doc(getDb(), 'friendships', id)
  const existing = await getDoc(ref)
  const now = new Date().toISOString()
  if (existing.exists()) {
    const data = existing.data() as Friendship
    if (data.status === 'accepted') throw new Error('You’re already friends.')
    if (data.status === 'pending') throw new Error('Friend request already pending.')
  }
  const friendship: Friendship = {
    id,
    a: [fromUid, toUid].sort()[0],
    b: [fromUid, toUid].sort()[1],
    status: 'pending',
    requestedBy: fromUid,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, friendship)
  const from = await getCloudProfile(fromUid)
  await createNotification({
    uid: toUid,
    kind: 'friend_request',
    title: 'Friend request',
    body: `${from?.displayName || 'Someone'} sent you a friend request.`,
    href: '/friends#invites',
    meta: { fromUid },
  })
  return friendship
}

export async function acceptFriend(uid: string, friendshipId: string): Promise<void> {
  const ref = doc(getDb(), 'friendships', friendshipId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Request not found.')
  const data = snap.data() as Friendship
  if (data.a !== uid && data.b !== uid) throw new Error('Not your request.')
  if (data.requestedBy === uid) throw new Error('Waiting on them to accept.')
  await updateDoc(ref, { status: 'accepted', updatedAt: new Date().toISOString() })
  const accepter = await getCloudProfile(uid)
  await createNotification({
    uid: data.requestedBy,
    kind: 'friend_accepted',
    title: 'Friend request accepted',
    body: `${accepter?.displayName || 'Someone'} accepted your request.`,
    href: '/friends',
  })
}

export async function removeFriendship(uid: string, friendshipId: string): Promise<void> {
  const ref = doc(getDb(), 'friendships', friendshipId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data() as Friendship
  if (data.a !== uid && data.b !== uid) throw new Error('Not your friendship.')
  await deleteDoc(ref)
}

export async function listFriendships(uid: string): Promise<Friendship[]> {
  const db = getDb()
  const [q1, q2] = await Promise.all([
    getDocs(query(collection(db, 'friendships'), where('a', '==', uid))),
    getDocs(query(collection(db, 'friendships'), where('b', '==', uid))),
  ])
  const map = new Map<string, Friendship>()
  for (const s of [...q1.docs, ...q2.docs]) {
    map.set(s.id, s.data() as Friendship)
  }
  return [...map.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
}

/** Live friendship list — dual listeners (a == uid | b == uid). */
export function subscribeFriendships(
  uid: string,
  onChange: (items: Friendship[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const db = getDb()
  const mapA = new Map<string, Friendship>()
  const mapB = new Map<string, Friendship>()
  let aReady = false
  let bReady = false

  function mergeEmit() {
    if (!aReady || !bReady) return
    const merged = new Map<string, Friendship>()
    for (const [id, f] of mapA) merged.set(id, f)
    for (const [id, f] of mapB) merged.set(id, f)
    onChange([...merged.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)))
  }

  const unsubA = onSnapshot(
    query(collection(db, 'friendships'), where('a', '==', uid)),
    (snap) => {
      mapA.clear()
      for (const d of snap.docs) mapA.set(d.id, d.data() as Friendship)
      aReady = true
      mergeEmit()
    },
    (err) => onError?.(err),
  )
  const unsubB = onSnapshot(
    query(collection(db, 'friendships'), where('b', '==', uid)),
    (snap) => {
      mapB.clear()
      for (const d of snap.docs) mapB.set(d.id, d.data() as Friendship)
      bReady = true
      mergeEmit()
    },
    (err) => onError?.(err),
  )

  return () => {
    unsubA()
    unsubB()
  }
}

export async function listFriendProfiles(uid: string): Promise<CloudProfile[]> {
  const friendships = await listFriendships(uid)
  const blocked = new Set(await listBlockedIds(uid))
  const accepted = friendships.filter((f) => f.status === 'accepted')
  const ids = accepted
    .map((f) => (f.a === uid ? f.b : f.a))
    .filter((id) => !blocked.has(id))
  const profiles = await Promise.all(ids.map((id) => getCloudProfile(id)))
  return profiles.filter(Boolean) as CloudProfile[]
}

export type { SharePrefs }
