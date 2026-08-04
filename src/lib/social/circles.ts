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
    createdAt: now,
    updatedAt: now,
  }
  const ref = await addDoc(collection(getDb(), 'circles'), payload)
  return { id: ref.id, ...payload }
}

export async function listMyCircles(uid: string): Promise<CircleGroup[]> {
  const q = query(collection(getDb(), 'circles'), where('memberIds', 'array-contains', uid))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<CircleGroup, 'id'>) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function renameCircle(id: string, name: string): Promise<void> {
  await updateDoc(doc(getDb(), 'circles', id), {
    name: name.trim() || 'Circle',
    updatedAt: new Date().toISOString(),
  })
}

export async function setCircleMembers(id: string, memberIds: string[]): Promise<void> {
  const unique = Array.from(new Set(memberIds))
  if (unique.length === 0) throw new Error('A circle needs at least one member.')
  await updateDoc(doc(getDb(), 'circles', id), {
    memberIds: unique,
    updatedAt: new Date().toISOString(),
  })
}

export async function leaveCircle(circle: CircleGroup, uid: string): Promise<void> {
  if (circle.ownerId === uid) {
    throw new Error('Owners can’t leave — delete the circle or transfer ownership later.')
  }
  const next = circle.memberIds.filter((id) => id !== uid)
  await setCircleMembers(circle.id, next)
}

export async function deleteCircle(id: string): Promise<void> {
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
