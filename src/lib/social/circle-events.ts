import { getSupabase } from '@/lib/supabase'
import { createId } from '@/lib/id'
import { circleCategoryColor } from '@/modules/calendar/categories'
import type { CircleEvent } from './types'
import type { Unsubscribe } from './friends'

type EventRow = {
  id: string
  circle_id: string
  title: string
  notes: string
  starts_at: string
  ends_at: string
  all_day: boolean
  category: string
  color: string
  created_by: string
  assignee_id: string | null
  created_at: string
  updated_at: string
}

function mapEvent(row: EventRow): CircleEvent {
  return {
    id: row.id,
    circleId: row.circle_id,
    title: row.title,
    notes: row.notes || '',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: Boolean(row.all_day),
    category: row.category,
    color: row.color,
    createdBy: row.created_by,
    assigneeId: row.assignee_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listCircleEvents(circleId: string): Promise<CircleEvent[]> {
  const { data, error } = await getSupabase()
    .from('circle_events')
    .select('*')
    .eq('circle_id', circleId)
  if (error) throw error
  return (data || [])
    .map((d) => mapEvent(d as EventRow))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export async function listCircleEventsForCircles(circleIds: string[]): Promise<CircleEvent[]> {
  if (circleIds.length === 0) return []
  const results = await Promise.all(circleIds.map((id) => listCircleEvents(id)))
  return results.flat().sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export function subscribeCircleEvents(
  circleId: string,
  onChange: (events: CircleEvent[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const supabase = getSupabase()
  let cancelled = false

  const refresh = () => {
    void listCircleEvents(circleId)
      .then((events) => {
        if (!cancelled) onChange(events)
      })
      .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))))
  }

  refresh()

  const topic = `circle_events:${circleId}:${crypto.randomUUID?.() || String(Date.now())}`
  try {
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'circle_events', filter: `circle_id=eq.${circleId}` },
        refresh,
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  } catch (err) {
    console.warn('Realtime circle events unavailable', err)
    onError?.(err instanceof Error ? err : new Error(String(err)))
    return () => {
      cancelled = true
    }
  }
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
  const id = createId()
  const row = {
    id,
    circle_id: input.circleId,
    title: input.title.trim() || 'Untitled',
    notes: input.notes || '',
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    all_day: Boolean(input.allDay),
    category,
    color: circleCategoryColor(category),
    created_by: input.createdBy,
    assignee_id: input.assigneeId ?? null,
    created_at: now,
    updated_at: now,
  }
  const { data, error } = await getSupabase().from('circle_events').insert(row).select('*').single()
  if (error) throw error
  return mapEvent(data as EventRow)
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
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title != null) row.title = patch.title
  if (patch.notes != null) row.notes = patch.notes
  if (patch.startsAt != null) row.starts_at = patch.startsAt
  if (patch.endsAt != null) row.ends_at = patch.endsAt
  if (patch.allDay != null) row.all_day = patch.allDay
  if (patch.category != null) {
    row.category = patch.category
    row.color = circleCategoryColor(patch.category)
  }
  if (patch.color != null && patch.category == null) row.color = patch.color
  if (patch.assigneeId !== undefined) row.assignee_id = patch.assigneeId
  const { error } = await getSupabase().from('circle_events').update(row).eq('id', id)
  if (error) throw error
}

export async function deleteCircleEvent(id: string): Promise<void> {
  const { error } = await getSupabase().from('circle_events').delete().eq('id', id)
  if (error) throw error
}
