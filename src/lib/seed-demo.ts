import { addDays } from '@/lib/dates'
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

  // High-priority today → “Do this next”
  tasksApi.createTask(userId, {
    title: 'Send school forms',
    priority: 'high',
    list_id: listId,
    due_at: new Date().toISOString(),
    notes: 'Sitting in email — five minutes.',
  })
  tasksApi.createTask(userId, {
    title: 'Grocery run',
    priority: 'medium',
    list_id: listId,
    due_at: tomorrow.toISOString(),
  })
  tasksApi.createTask(userId, {
    title: 'Reply to dentist',
    priority: 'medium',
    list_id: listId,
    due_at: overdue.toISOString(),
  })

  // Capture-friendly event: Call Mom Friday-ish feel
  const mom = addDays(new Date(), ((5 - new Date().getDay() + 7) % 7) || 7)
  mom.setHours(15, 0, 0, 0)
  const momEnd = new Date(mom)
  momEnd.setHours(15, 30, 0, 0)
  calendarApi.create(userId, {
    title: 'Call Mom',
    notes: 'Catch up — no agenda.',
    starts_at: mom.toISOString(),
    ends_at: momEnd.toISOString(),
    all_day: false,
    location: '',
    recurrence: 'none',
    reminder_minutes: 30,
  })

  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 2)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  calendarApi.create(userId, {
    title: 'Focus block',
    notes: 'Protect this hour.',
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
  habitsApi.create(userId, { title: 'Evening walk', schedule: 'daily', reminder_time: '19:00' })
  habitsApi.toggleToday(userId, stretch.id)

  goalsApi.create(userId, {
    title: 'Protect deep work 3× this week',
    target: 3,
    progress: 1,
    horizon: 'monthly',
  })

  notesApi.createNote(userId, {
    title: 'Weekend ideas',
    body: 'Farmers market · long walk · no screens after dinner.',
    pinned: true,
  })

  journalApi.upsert(userId, {
    mood: 'good',
    body: 'Clear morning. Protect the focus block.',
  })

  healthApi.setWater(userId, 4)

  localStorage.setItem(key, '1')
  return { seeded: true }
}

export function clearDemoSeedFlag(userId: string) {
  localStorage.removeItem(`${SEEDED_KEY}:${userId}`)
}
