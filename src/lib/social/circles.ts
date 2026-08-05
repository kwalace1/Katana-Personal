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
import type { CircleChallenge, CircleGroup } from './types'

export function normalizeCircle(raw: CircleGroup): CircleGroup {
  const memberIds = Array.isArray(raw.memberIds) ? raw.memberIds : []
  const moderatorIds = (Array.isArray(raw.moderatorIds) ? raw.moderatorIds : []).filter(
    (id) => memberIds.includes(id) && id !== raw.ownerId,
  )
  return { ...raw, memberIds, moderatorIds }
}

export function canManageCircle(circle: CircleGroup, uid: string): boolean {
  if (circle.ownerId === uid) return true
  return (circle.moderatorIds || []).includes(uid)
}

export function circleRole(circle: CircleGroup, uid: string): 'owner' | 'moderator' | 'member' {
  if (circle.ownerId === uid) return 'owner'
  if ((circle.moderatorIds || []).includes(uid)) return 'moderator'
  return 'member'
}

export async function createCircle(input: {
  name: string
  ownerId: string
  memberIds?: string[]
}): Promise<CircleGroup> {
  const now = new Date().toISOString()
  const memberIds = Array.from(new Set([input.ownerId, ...(input.memberIds || [])]))
  const payload: Omit<CircleGroup, 'id'> = {
    name: input.name.trim() || 'Circle',
    ownerId: input.ownerId,
    memberIds,
    moderatorIds: [],
    createdAt: now,
    updatedAt: now,
  }
  const ref = await addDoc(collection(getDb(), 'circles'), payload)
  return normalizeCircle({ id: ref.id, ...payload })
}

export async function listMyCircles(uid: string): Promise<CircleGroup[]> {
  const q = query(collection(getDb(), 'circles'), where('memberIds', 'array-contains', uid))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => normalizeCircle({ id: d.id, ...(d.data() as Omit<CircleGroup, 'id'>) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function renameCircle(circle: CircleGroup, name: string, actorUid: string): Promise<void> {
  if (!canManageCircle(circle, actorUid)) {
    throw new Error('Only the owner or a moderator can rename this circle.')
  }
  await updateDoc(doc(getDb(), 'circles', circle.id), {
    name: name.trim() || 'Circle',
    updatedAt: new Date().toISOString(),
  })
}

export async function setCircleMembers(
  circle: CircleGroup,
  memberIds: string[],
  actorUid: string,
): Promise<void> {
  if (!canManageCircle(circle, actorUid)) {
    throw new Error('Only the owner or a moderator can change members.')
  }
  const unique = Array.from(new Set(memberIds))
  if (unique.length === 0) throw new Error('A circle needs at least one member.')
  if (!unique.includes(circle.ownerId)) {
    throw new Error('Can’t remove the circle owner.')
  }
  const moderatorIds = (circle.moderatorIds || []).filter(
    (id) => unique.includes(id) && id !== circle.ownerId,
  )
  await updateDoc(doc(getDb(), 'circles', circle.id), {
    memberIds: unique,
    moderatorIds,
    updatedAt: new Date().toISOString(),
  })
}

export async function setCircleModerators(
  circle: CircleGroup,
  moderatorIds: string[],
  actorUid: string,
): Promise<void> {
  if (!canManageCircle(circle, actorUid)) {
    throw new Error('Only the owner or a moderator can change moderators.')
  }
  const next = Array.from(new Set(moderatorIds)).filter(
    (id) => circle.memberIds.includes(id) && id !== circle.ownerId,
  )
  await updateDoc(doc(getDb(), 'circles', circle.id), {
    moderatorIds: next,
    updatedAt: new Date().toISOString(),
  })
}

export async function leaveCircle(circle: CircleGroup, uid: string): Promise<void> {
  if (circle.ownerId === uid) {
    throw new Error('Owners can’t leave — delete the circle or transfer ownership later.')
  }
  const nextMembers = circle.memberIds.filter((id) => id !== uid)
  const nextMods = (circle.moderatorIds || []).filter((id) => id !== uid && nextMembers.includes(id))
  await updateDoc(doc(getDb(), 'circles', circle.id), {
    memberIds: nextMembers,
    moderatorIds: nextMods,
    updatedAt: new Date().toISOString(),
  })
}

/** Self-join via invite link — no manage permission (Firestore rules allow +1 self). */
export async function joinCircleMember(circle: CircleGroup, uid: string): Promise<CircleGroup> {
  if (circle.memberIds.includes(uid)) return normalizeCircle(circle)
  const nextMembers = [...circle.memberIds, uid]
  await updateDoc(doc(getDb(), 'circles', circle.id), {
    memberIds: nextMembers,
    updatedAt: new Date().toISOString(),
  })
  return normalizeCircle({ ...circle, memberIds: nextMembers })
}

export async function deleteCircle(id: string, actorUid: string, ownerId: string): Promise<void> {
  if (actorUid !== ownerId) {
    throw new Error('Only the owner can delete this circle.')
  }
  await deleteDoc(doc(getDb(), 'circles', id))
}

export async function setCircleChallenge(
  id: string,
  challenge: CircleChallenge | null,
): Promise<void> {
  await updateDoc(doc(getDb(), 'circles', id), {
    challenge,
    updatedAt: new Date().toISOString(),
  })
}
