import { endOfDay, eachDayOfInterval, isWithinInterval, parseISO, startOfDay, todayKey } from '@/lib/dates'
import type { CalendarEvent } from './types'
import type { Task } from '@/modules/tasks/types'
import type { Goal } from '@/modules/goals/types'
import type { Habit } from '@/modules/habits/types'
import type { CircleEvent } from '@/lib/social/types'
import { categoryColor, circleCategoryColor } from './categories'

export type AgendaKind = 'event' | 'task' | 'goal' | 'habit' | 'circle'

export interface AgendaItem {
  kind: AgendaKind
  id: string
  title: string
  starts_at: string
  ends_at: string
  all_day: boolean
  color: string
  sourceLabel: string
  href: string
  /** For circle items */
  circleId?: string
  assigneeId?: string | null
  done?: boolean
}

export type AgendaFilter = {
  events: boolean
  tasks: boolean
  goals: boolean
  habits: boolean
  circles: boolean
}

export const DEFAULT_AGENDA_FILTER: AgendaFilter = {
  events: true,
  tasks: true,
  goals: true,
  habits: true,
  circles: true,
}

function hasTimeComponent(iso: string) {
  const d = parseISO(iso)
  return d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0
}

export function eventToAgenda(event: CalendarEvent): AgendaItem {
  return {
    kind: 'event',
    id: event.id,
    title: event.title,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    all_day: event.all_day,
    color: categoryColor(event.category, event.color),
    sourceLabel: 'Event',
    href: `/calendar?date=${event.starts_at.slice(0, 10)}&id=${event.id}`,
  }
}

export function taskToAgenda(task: Task, listName?: string): AgendaItem | null {
  if (!task.due_at || task.status === 'done') return null
  const due = parseISO(task.due_at)
  const timed = hasTimeComponent(task.due_at)
  const start = timed ? due : startOfDay(due)
  const end = timed ? new Date(due.getTime() + 60 * 60 * 1000) : endOfDay(due)
  return {
    kind: 'task',
    id: task.id,
    title: task.title,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    all_day: !timed,
    color: '#d97706',
    sourceLabel: listName || 'Task',
    href: `/tasks?id=${task.id}`,
    done: false,
  }
}

export function goalToAgenda(goal: Goal): AgendaItem | null {
  if (!goal.target_date) return null
  const day = parseISO(goal.target_date.length === 10 ? `${goal.target_date}T12:00:00` : goal.target_date)
  return {
    kind: 'goal',
    id: goal.id,
    title: goal.title,
    starts_at: startOfDay(day).toISOString(),
    ends_at: endOfDay(day).toISOString(),
    all_day: true,
    color: '#059669',
    sourceLabel: 'Goal',
    href: `/goals?id=${goal.id}`,
  }
}

export function habitDueOnDay(habit: Habit, day: Date): boolean {
  const dow = day.getDay()
  const isWeekend = dow === 0 || dow === 6
  if (habit.schedule === 'daily') return true
  if (habit.schedule === 'weekdays') return !isWeekend
  return isWeekend
}

/** Expand habits across a visible calendar range (one chip per due day). */
export function habitsToAgendaInRange(
  habits: Habit[],
  rangeStart: Date,
  rangeEnd: Date,
  isDone: (habitId: string, dateKey: string) => boolean,
): AgendaItem[] {
  const items: AgendaItem[] = []
  const days = eachDayOfInterval({
    start: startOfDay(rangeStart),
    end: startOfDay(rangeEnd),
  })
  for (const day of days) {
    const key = todayKey(day)
    for (const habit of habits) {
      if (!habitDueOnDay(habit, day)) continue
      let start = startOfDay(day)
      let allDay = true
      if (habit.reminder_time && /^\d{1,2}:\d{2}$/.test(habit.reminder_time)) {
        const [hh, mm] = habit.reminder_time.split(':').map(Number)
        start = new Date(day)
        start.setHours(hh, mm, 0, 0)
        allDay = false
      }
      const end = allDay ? endOfDay(day) : new Date(start.getTime() + 30 * 60 * 1000)
      const done = isDone(habit.id, key)
      items.push({
        kind: 'habit',
        id: `${habit.id}__${key}`,
        title: done ? `✓ ${habit.title}` : habit.title,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        all_day: allDay,
        color: done ? '#94a3b8' : '#7c3aed',
        sourceLabel: 'Habit',
        href: `/habits?id=${habit.id}`,
        done,
      })
    }
  }
  return items
}

export function circleEventToAgenda(event: CircleEvent, circleName: string): AgendaItem {
  return {
    kind: 'circle',
    id: event.id,
    title: event.title,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    all_day: event.allDay,
    color: circleCategoryColor(event.category),
    sourceLabel: circleName,
    href: `/circles?id=${event.circleId}&tab=schedule`,
    circleId: event.circleId,
    assigneeId: event.assigneeId,
  }
}

export function itemOnDay(item: AgendaItem, day: Date): boolean {
  const start = startOfDay(day)
  const end = endOfDay(day)
  const s = parseISO(item.starts_at)
  if (item.all_day) return s.toDateString() === day.toDateString()
  return isWithinInterval(s, { start, end })
}

export function buildAgenda(input: {
  events: CalendarEvent[]
  tasks: Task[]
  goals: Goal[]
  habits?: Habit[]
  rangeStart?: Date
  rangeEnd?: Date
  habitDone?: (habitId: string, dateKey: string) => boolean
  circleEvents?: { event: CircleEvent; circleName: string }[]
  lists?: { id: string; name: string }[]
  filter?: AgendaFilter
  circleIdsEnabled?: Set<string> | null
}): AgendaItem[] {
  const filter = input.filter ?? DEFAULT_AGENDA_FILTER
  const listName = (id: string | null) =>
    id ? input.lists?.find((l) => l.id === id)?.name : undefined

  const items: AgendaItem[] = []

  if (filter.events) {
    for (const e of input.events) items.push(eventToAgenda(e))
  }
  if (filter.tasks) {
    for (const t of input.tasks) {
      const item = taskToAgenda(t, listName(t.list_id))
      if (item) items.push(item)
    }
  }
  if (filter.goals) {
    for (const g of input.goals) {
      const item = goalToAgenda(g)
      if (item) items.push(item)
    }
  }
  if (filter.habits && input.habits && input.rangeStart && input.rangeEnd) {
    items.push(
      ...habitsToAgendaInRange(
        input.habits,
        input.rangeStart,
        input.rangeEnd,
        input.habitDone ?? (() => false),
      ),
    )
  }
  if (filter.circles && input.circleEvents) {
    for (const { event, circleName } of input.circleEvents) {
      if (input.circleIdsEnabled && !input.circleIdsEnabled.has(event.circleId)) continue
      items.push(circleEventToAgenda(event, circleName))
    }
  }

  return items.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
}

export function agendaForDay(items: AgendaItem[], day: Date): AgendaItem[] {
  return items.filter((i) => itemOnDay(i, day))
}
