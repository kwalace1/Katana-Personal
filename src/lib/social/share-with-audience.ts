import { endOfDay, startOfDay } from '@/lib/dates'
import { createCircleEvent } from '@/lib/social/circle-events'
import { createSharedItem } from '@/lib/social/shared'
import { publishActivity } from '@/lib/social/streaks'
import type { CircleGroup, SharedKind } from '@/lib/social/types'
import { categoryLabel } from '@/modules/calendar/categories'

function timingFromDueAt(dueAt: string): { startsAt: string; endsAt: string; allDay: boolean } {
  const due = new Date(dueAt)
  const timed = due.getHours() !== 0 || due.getMinutes() !== 0 || due.getSeconds() !== 0
  if (timed) {
    return {
      startsAt: due.toISOString(),
      endsAt: new Date(due.getTime() + 60 * 60 * 1000).toISOString(),
      allDay: false,
    }
  }
  return {
    startsAt: startOfDay(due).toISOString(),
    endsAt: endOfDay(due).toISOString(),
    allDay: true,
  }
}

export type ShareAudienceResult =
  | { ok: true; circleNames: string[]; friendCount: number; onCalendar: boolean }
  | { ok: false; error: string }

/** Create a shared item (+ circle calendar events for dated tasks). */
export async function shareWithAudience(input: {
  kind: SharedKind
  title: string
  body?: string
  data?: Record<string, unknown>
  ownerId: string
  friendIds: string[]
  circles: CircleGroup[]
  activityFeed?: boolean
}): Promise<ShareAudienceResult> {
  const memberIds = new Set<string>()
  for (const id of input.friendIds) memberIds.add(id)
  for (const circle of input.circles) {
    for (const id of circle.memberIds) {
      if (id !== input.ownerId) memberIds.add(id)
    }
  }
  if (memberIds.size === 0) {
    return { ok: false, error: 'Pick a circle or at least one friend' }
  }

  const dueAt = typeof input.data?.due_at === 'string' ? input.data.due_at : null
  if (input.kind === 'task' && input.circles.length > 0 && !dueAt) {
    return {
      ok: false,
      error: 'Set a due date first so this task can show on the circle calendar',
    }
  }

  const circleNames = input.circles.map((c) => c.name)
  const category =
    typeof input.data?.category === 'string' && input.data.category
      ? String(input.data.category)
      : 'personal'

  await createSharedItem({
    kind: input.kind,
    title: input.title,
    body: input.body,
    data: {
      ...(input.data || {}),
      category,
      ...(input.circles.length
        ? {
            sharedCircleIds: input.circles.map((c) => c.id),
            sharedCircleNames: circleNames,
          }
        : {}),
    },
    ownerId: input.ownerId,
    memberIds: [...memberIds],
  })

  let onCalendar = false
  if (input.kind === 'task' && dueAt && input.circles.length > 0) {
    const timing = timingFromDueAt(dueAt)
    const noteParts = [input.body?.trim() || '', `Shared task · ${categoryLabel(category)}`].filter(
      Boolean,
    )
    await Promise.all(
      input.circles.map((circle) =>
        createCircleEvent({
          circleId: circle.id,
          title: input.title,
          notes: noteParts.join('\n'),
          startsAt: timing.startsAt,
          endsAt: timing.endsAt,
          allDay: timing.allDay,
          category,
          createdBy: input.ownerId,
        }),
      ),
    )
    onCalendar = true
  }

  if (input.activityFeed) {
    const audience = circleNames.length > 0 ? `with ${circleNames.join(', ')}` : 'with friends'
    const ping =
      input.kind === 'journal'
        ? `Shared mood ${audience}: ${input.body || input.title}`
        : `Shared a ${input.kind} ${audience}: ${input.title}`
    await publishActivity(input.ownerId, ping)
  }

  return {
    ok: true,
    circleNames,
    friendCount: input.friendIds.length,
    onCalendar,
  }
}

export function shareSuccessMessage(result: Extract<ShareAudienceResult, { ok: true }>): string {
  if (result.onCalendar && result.circleNames.length > 0) {
    return `Shared — on calendar for ${result.circleNames.join(', ')}`
  }
  if (result.circleNames.length > 0 && result.friendCount === 0) {
    return `Shared with ${result.circleNames.join(', ')}`
  }
  if (result.circleNames.length > 0) return 'Shared with circles & friends'
  return 'Shared with friends'
}
