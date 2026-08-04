import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { categoryColor } from '@/modules/calendar/categories'
import type { CircleEvent } from './types'

const COL = 'circleEvents'

export async function listCircleEvents(circleId: string): Promise<CircleEvent[]> {
  const q = query(collection(getDb(), COL), where('circleId', '==', circleId))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<CircleEvent, 'id'>) }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/** Events across multiple circles (for Plan calendar overlay). */
export async function listCircleEventsForCircles(circleIds: string[]): Promise<CircleEvent[]> {
  if (circleIds.length === 0) return []
  const chunks: string[][] = []
  for (let i = 0; i < circleIds.length; i += 10) {
    chunks.push(circleIds.slice(i, i + 10))
  }
  const results = await Promise.all(
    chunks.map(async (ids) => {
      // Firestore 'in' limit is 10; query per circle is safer under membership rules
      const perCircle = await Promise.all(ids.map((id) => listCircleEvents(id)))
      return perCircle.flat()
    }),
  )
  return results.flat().sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export function subscribeCircleEvents(
  circleId: string,
  onChange: (events: CircleEvent[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(getDb(), COL), where('circleId', '==', circleId))
  return onSnapshot(
    q,
    (snap) => {
      const events = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<CircleEvent, 'id'>) }))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      onChange(events)
    },
    (err) => onError?.(err),
  )
}

export async function createCircleEvent(input: {
  circleId: string
  title: string
  notes?: string
  startsAt: string
  endsAt: string
  allDay?: boolean
  category?: string
  color?: string
  createdBy: string
  assigneeId?: string | null
}): Promise<CircleEvent> {
  const now = new Date().toISOString()
  const category = input.category || 'errand'
  const payload: Omit<CircleEvent, 'id'> = {
    circleId: input.circleId,
    title: input.title.trim() || 'Untitled',
    notes: input.notes || '',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: Boolean(input.allDay),
    category,
    color: input.color || categoryColor(category),
    createdBy: input.createdBy,
    assigneeId: input.assigneeId ?? null,
    createdAt: now,
    updatedAt: now,
  }
  const ref = await addDoc(collection(getDb(), COL), payload)
  return { id: ref.id, ...payload }
}

export async function updateCircleEvent(
  id: string,
  patch: Partial<
    Pick<
      CircleEvent,
      | 'title'
      | 'notes'
      | 'startsAt'
      | 'endsAt'
      | 'allDay'
      | 'category'
      | 'color'
      | 'assigneeId'
    >
  >,
): Promise<void> {
  await updateDoc(doc(getDb(), COL, id), {
    ...patch,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteCircleEvent(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COL, id))
}
