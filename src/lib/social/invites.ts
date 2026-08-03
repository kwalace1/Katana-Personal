import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { createId } from '@/lib/id'
import { createNotification } from './notifications'
import { getCloudProfile } from './friends'
import { setCircleMembers } from './circles'
import type { CircleGroup } from './types'

export interface CircleInvite {
  token: string
  circleId: string
  circleName: string
  createdBy: string
  createdAt: string
  expiresAt: string
  usedBy: string[]
}

function inviteUrl(token: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/invite/circle/${token}`
}

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
  }
  await setDoc(doc(getDb(), 'circleInvites', token), invite)
  return { invite, url: inviteUrl(token) }
}

export async function getCircleInvite(token: string): Promise<CircleInvite | null> {
  const snap = await getDoc(doc(getDb(), 'circleInvites', token))
  if (!snap.exists()) return null
  return snap.data() as CircleInvite
}

export async function acceptCircleInvite(token: string, uid: string): Promise<CircleGroup> {
  const invite = await getCircleInvite(token)
  if (!invite) throw new Error('That invite link isn’t valid.')
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error('That invite has expired.')
  }
  const circleSnap = await getDoc(doc(getDb(), 'circles', invite.circleId))
  if (!circleSnap.exists()) throw new Error('That circle no longer exists.')
  const circle = { id: circleSnap.id, ...(circleSnap.data() as Omit<CircleGroup, 'id'>) }
  if (circle.memberIds.includes(uid)) {
    return circle
  }
  const nextMembers = [...circle.memberIds, uid]
  await setCircleMembers(circle.id, nextMembers)
  await updateDoc(doc(getDb(), 'circleInvites', token), {
    usedBy: arrayUnion(uid),
  })
  const joiner = await getCloudProfile(uid)
  await createNotification({
    uid: invite.createdBy,
    kind: 'circle_joined',
    title: 'Someone joined your circle',
    body: `${joiner?.displayName || 'A friend'} joined “${invite.circleName}”.`,
    href: '/circles',
    meta: { circleId: invite.circleId },
  })
  return { ...circle, memberIds: nextMembers }
}
