import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

export interface CirclePost {
  id: string
  circleId: string
  authorId: string
  message: string
  createdAt: string
}

export function subscribeCirclePosts(
  circleId: string,
  onChange: (posts: CirclePost[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(getDb(), 'circlePosts'), where('circleId', '==', circleId))
  return onSnapshot(
    q,
    (snap) => {
      const posts = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<CirclePost, 'id'>) }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      onChange(posts)
    },
    (err) => onError?.(err),
  )
}

export async function createCirclePost(input: {
  circleId: string
  authorId: string
  message: string
}): Promise<CirclePost> {
  const message = input.message.trim()
  if (!message) throw new Error('Write something first.')
  if (message.length > 500) throw new Error('Keep it under 500 characters.')
  const createdAt = new Date().toISOString()
  const payload: Omit<CirclePost, 'id'> = {
    circleId: input.circleId,
    authorId: input.authorId,
    message,
    createdAt,
  }
  const ref = await addDoc(collection(getDb(), 'circlePosts'), payload)
  return { id: ref.id, ...payload }
}

export async function deleteCirclePost(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'circlePosts', id))
}
