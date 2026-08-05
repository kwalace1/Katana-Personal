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
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { createId } from '@/lib/id'
import { createNotification } from './notifications'
import { getCloudProfile } from './friends'
import { setCircleMembers } from './circles'
import type { CircleGroup } from './types'

export type CircleInviteStatus = 'pending' | 'accepted' | 'declined' | 'link'

export interface CircleInvite {
  token: string
  circleId: string
  circleName: string
  createdBy: string
  createdAt: string
  expiresAt: string
  usedBy: string[]
  /** When set, this is a direct invite to a friend (accept in Friends). */
  inviteeUid?: string | null
  status?: CircleInviteStatus
  respondedAt?: string | null
}

function inviteUrl(token: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/invite/circle/${token}`
}

/** Shareable link invite (anyone with the link). */
export async function createCircleInvite(input: {
  circle: CircleGroup
  createdBy: string
  daysValid?: number
}): Promise<{ invite: CircleInvite; url: string }> {
  const token = createId().replace(/-/g, '').slice(0, 12)
  const now = new Date()
  const expires = new Date(now)
  expires.setDate(expires.getDate() + (input.daysValid ?? 14))
  const invite: CircleInvite = {
    token,
    circleId: input.circle.id,
    circleName: input.circle.name,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    usedBy: [],
    inviteeUid: null,
    status: 'link',
  }
  await setDoc(doc(getDb(), 'circleInvites', token), invite)
  return { invite, url: inviteUrl(token) }
}

function directInviteId(circleId: string, inviteeUid: string) {
  return `direct_${circleId}_${inviteeUid}`
}

/** Invite an existing friend — they accept from Friends / notifications. */
export async function inviteFriendToCircle(input: {
  circle: CircleGroup
  createdBy: string
  inviteeUid: string
  daysValid?: number
}): Promise<CircleInvite> {
  if (input.circle.memberIds.includes(input.inviteeUid)) {
    throw new Error('They’re already in this circle.')
  }
  if (input.inviteeUid === input.createdBy) {
    throw new Error('You can’t invite yourself.')
  }

  // Deterministic id + getDoc — no list query (list rules/indexes were blocking send).
  const token = directInviteId(input.circle.id, input.inviteeUid)
  const ref = doc(getDb(), 'circleInvites', token)
  const existingSnap = await getDoc(ref)
  if (existingSnap.exists()) {
    const existing = existingSnap.data() as CircleInvite
    if (existing.status === 'pending') {
      throw new Error('Invite already sent — waiting for them to accept.')
    }
  }

  const now = new Date()
  const expires = new Date(now)
  expires.setDate(expires.getDate() + (input.daysValid ?? 14))
  const invite: CircleInvite = {
    token,
    circleId: input.circle.id,
    circleName: input.circle.name,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    usedBy: [],
    inviteeUid: input.inviteeUid,
    status: 'pending',
    respondedAt: null,
  }
  await setDoc(ref, invite)

  try {
    const inviter = await getCloudProfile(input.createdBy)
    await createNotification({
      uid: input.inviteeUid,
      kind: 'circle_invite',
      title: 'Circle invite',
      body: `${inviter?.displayName || 'A friend'} invited you to “${input.circle.name}”.`,
      href: '/friends#invites',
      meta: { circleId: input.circle.id, token },
    })
  } catch {
    // Invite is saved even if the bell ping fails
  }

  return invite
}

export async function getCircleInvite(token: string): Promise<CircleInvite | null> {
  const snap = await getDoc(doc(getDb(), 'circleInvites', token))
  if (!snap.exists()) return null
  return snap.data() as CircleInvite
}

/** Pending invites addressed to me (Friends inbox). */
export async function listMyPendingCircleInvites(uid: string): Promise<CircleInvite[]> {
  const q = query(
    collection(getDb(), 'circleInvites'),
    where('inviteeUid', '==', uid),
    where('status', '==', 'pending'),
  )
  const snap = await getDocs(q)
  const now = Date.now()
  return snap.docs
    .map((d) => d.data() as CircleInvite)
    .filter((inv) => new Date(inv.expiresAt).getTime() >= now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function subscribeMyPendingCircleInvites(
  uid: string,
  onChange: (items: CircleInvite[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), 'circleInvites'),
    where('inviteeUid', '==', uid),
    where('status', '==', 'pending'),
  )
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now()
      onChange(
        snap.docs
          .map((d) => d.data() as CircleInvite)
          .filter((inv) => new Date(inv.expiresAt).getTime() >= now)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      )
    },
    (err) => onError?.(err),
  )
}

/** Pending invites I sent for a circle (to show “Pending” on Manage). */
export async function listOutgoingPendingForCircle(
  circleId: string,
  createdBy: string,
): Promise<CircleInvite[]> {
  const q = query(
    collection(getDb(), 'circleInvites'),
    where('createdBy', '==', createdBy),
    where('circleId', '==', circleId),
    where('status', '==', 'pending'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data() as CircleInvite)
}

async function joinFromInvite(invite: CircleInvite, uid: string): Promise<CircleGroup> {
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error('That invite has expired.')
  }
  if (invite.status === 'declined') {
    throw new Error('That invite was declined.')
  }
  const circleSnap = await getDoc(doc(getDb(), 'circles', invite.circleId))
  if (!circleSnap.exists()) throw new Error('That circle no longer exists.')
  const circle = { id: circleSnap.id, ...(circleSnap.data() as Omit<CircleGroup, 'id'>) }
  if (circle.memberIds.includes(uid)) {
    return circle
  }
  const nextMembers = [...circle.memberIds, uid]
  await setCircleMembers(circle.id, nextMembers)
  await updateDoc(doc(getDb(), 'circleInvites', invite.token), {
    usedBy: arrayUnion(uid),
    status: 'accepted',
    respondedAt: new Date().toISOString(),
  })
  const joiner = await getCloudProfile(uid)
  await createNotification({
    uid: invite.createdBy,
    kind: 'circle_joined',
    title: 'Someone joined your circle',
    body: `${joiner?.displayName || 'A friend'} joined “${invite.circleName}”.`,
    href: `/circles?id=${invite.circleId}`,
    meta: { circleId: invite.circleId },
  })
  return { ...circle, memberIds: nextMembers }
}

export async function acceptCircleInvite(token: string, uid: string): Promise<CircleGroup> {
  const invite = await getCircleInvite(token)
  if (!invite) throw new Error('That invite isn’t valid.')
  if (invite.inviteeUid && invite.inviteeUid !== uid) {
    throw new Error('This invite was sent to someone else.')
  }
  return joinFromInvite(invite, uid)
}

export async function declineCircleInvite(token: string, uid: string): Promise<void> {
  const invite = await getCircleInvite(token)
  if (!invite) throw new Error('That invite isn’t valid.')
  if (invite.inviteeUid !== uid) throw new Error('This invite was sent to someone else.')
  if (invite.status !== 'pending') return
  await updateDoc(doc(getDb(), 'circleInvites', token), {
    status: 'declined',
    respondedAt: new Date().toISOString(),
  })
}
