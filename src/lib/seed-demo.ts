import { addDays, todayKey } from '@/lib/dates'
import { tasksApi } from '@/modules/tasks/api'
import { calendarApi } from '@/modules/calendar/api'
import { habitsApi } from '@/modules/habits/api'
import { goalsApi } from '@/modules/goals/api'
import { notesApi } from '@/modules/notes/api'
import { journalApi } from '@/modules/journal/api'
import { healthApi } from '@/modules/health/api'

const SEEDED_KEY = 'katana-personal:demo-seeded'

/** Fill a fresh workspace with believable busy-person demo data (idempotent per user). */
export function seedDemoWorkspace(userId: string): { seeded: boolean; reason?: string } {
  const key = `${SEEDED_KEY}:${userId}`
  if (localStorage.getItem(key) === '1') {
    return { seeded: false, reason: 'already' }
  }
  if (tasksApi.listTasks(userId).length > 0) {
    return { seeded: false, reason: 'not-empty' }
  }

  const lists = tasksApi.listLists(userId)
  const listId = lists[0]?.id ?? null
  const tomorrow = addDays(new Date(), 1)
  tomorrow.setHours(17, 0, 0, 0)
  const overdue = addDays(new Date(), -1)
  overdue.setHours(17, 0, 0, 0)

  tasksApi.createTask(userId, {
    title: 'Ship investor update',
    priority: 'high',
    list_id: listId,
    due_at: new Date().toISOString(),
    notes: 'One-pager: progress, ask, next week.',
  })
  tasksApi.createTask(userId, {
    title: 'Review Circles with Alex',
    priority: 'medium',
    list_id: listId,
    due_at: tomorrow.toISOString(),
  })
  tasksApi.createTask(userId, {
    title: 'Reply to dentist email',
    priority: 'medium',
    list_id: listId,
    due_at: overdue.toISOString(),
  })

  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 2)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  calendarApi.create(userId, {
    title: 'Focus block — deep work',
    notes: '',
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    all_day: false,
    location: '',
    recurrence: 'none',
    reminder_minutes: 15,
  })

  const stretch = habitsApi.create(userId, {
    title: 'Morning stretch',
    schedule: 'daily',
    reminder_time: '08:00',
  })
  habitsApi.create(userId, { title: 'Water (6 glasses)', schedule: 'daily', reminder_time: '18:00' })
  habitsApi.toggleToday(userId, stretch.id)

  const goal = goalsApi.create(userId, {
    title: 'Ship Katana Personal soft launch',
    target: 100,
    progress: 42,
    horizon: 'quarterly',
  })
  void goal

  notesApi.createNote(userId, {
    title: 'Launch narrative',
    body: 'Busy people. One next step. Friends who keep you honest.',
    pinned: true,
  })

  journalApi.upsert(userId, {
    mood: 'good',
    body: 'Clear day. Protect the focus block.',
  })

  healthApi.setWater(userId, 4)

  localStorage.setItem(key, '1')
  return { seeded: true }
}

export function clearDemoSeedFlag(userId: string) {
  localStorage.removeItem(`${SEEDED_KEY}:${userId}`)
}
