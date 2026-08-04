import { todayKey, formatTime } from '@/lib/dates'
import { tasksApi } from '@/modules/tasks/api'
import { habitsApi } from '@/modules/habits/api'
import { calendarApi } from '@/modules/calendar/api'

const LAST_NUDGE_KEY = 'katana-personal:last-nudge-day'
const FIRED_KEY = 'katana-personal:fired-reminders'

export function remindersEnabled(preferences?: Record<string, unknown> | null): boolean {
  return preferences?.gentle_reminders === true
}

export async function requestReminderPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function canNotify(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

function alreadyNudgedToday(): boolean {
  return localStorage.getItem(LAST_NUDGE_KEY) === todayKey()
}

function markNudged() {
  localStorage.setItem(LAST_NUDGE_KEY, todayKey())
}

function readFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    const today = todayKey()
    // Drop old keys
    return new Set(parsed.filter((k) => k.startsWith(today) || k.includes(today)))
  } catch {
    return new Set()
  }
}

function markFired(id: string) {
  const set = readFired()
  set.add(id)
  const today = todayKey()
  const kept = [...set].filter((k) => k.includes(today)).slice(-80)
  localStorage.setItem(FIRED_KEY, JSON.stringify(kept))
}

function notify(title: string, body: string, tag: string) {
  try {
    new Notification(title, { body, tag, silent: false })
  } catch {
    // blocked
  }
}

/** Soft once-a-day nudge based on what’s still open. */
export function maybeSendDailyNudge(userId: string, preferences?: Record<string, unknown> | null) {
  if (!remindersEnabled(preferences) || !canNotify() || alreadyNudgedToday()) return

  const openHabits = habitsApi.dueToday(userId).filter((h) => !habitsApi.isDoneToday(userId, h.id))
  const dueTasks = tasksApi.todayTasks(userId)
  const overdue = tasksApi.overdue(userId)
  const events = calendarApi.forDay(userId, new Date())

  const bits: string[] = []
  if (overdue.length > 0) {
    bits.push(overdue.length === 1 ? `“${overdue[0].title}” is overdue` : `${overdue.length} overdue`)
  }
  if (dueTasks.length > 0) {
    bits.push(
      dueTasks.length === 1
        ? `“${dueTasks[0].title}” is due today`
        : `${dueTasks.length} things are due today`,
    )
  }
  if (openHabits.length > 0) {
    bits.push(
      openHabits.length === 1
        ? `habit still open: ${openHabits[0].title}`
        : `${openHabits.length} habits still open`,
    )
  }
  if (events.length > 0 && bits.length === 0) {
    bits.push(
      events.length === 1
        ? `today includes “${events[0].title}”`
        : `${events.length} things on your calendar today`,
    )
  }

  if (bits.length === 0) return

  const body = bits.join(' · ')
  notify('Katana', body.charAt(0).toUpperCase() + body.slice(1), 'katana-daily-nudge')
  markNudged()
}

/**
 * Fire timed reminders for events (reminder_minutes before start)
 * and habits (reminder_time HH:mm). Idempotent per day via localStorage.
 */
export function tickTimedReminders(userId: string, preferences?: Record<string, unknown> | null) {
  if (!remindersEnabled(preferences) || !canNotify()) return

  const now = new Date()
  const fired = readFired()
  const day = todayKey()

  for (const event of calendarApi.upcoming(userId, 20)) {
    if (event.all_day || event.reminder_minutes == null) continue
    const start = new Date(event.starts_at)
    if (start.getTime() < now.getTime()) continue
    const fireAt = new Date(start.getTime() - event.reminder_minutes * 60_000)
    if (now.getTime() < fireAt.getTime()) continue
    // Only fire within 2 minutes of the fire window to avoid spam on late open
    if (now.getTime() - fireAt.getTime() > 120_000) continue
    const key = `${day}:event:${event.id}`
    if (fired.has(key)) continue
    notify('Upcoming', `${event.title} at ${formatTime(event.starts_at)}`, key)
    markFired(key)
  }

  for (const habit of habitsApi.dueToday(userId)) {
    if (!habit.reminder_time || habitsApi.isDoneToday(userId, habit.id)) continue
    const [hh, mm] = habit.reminder_time.split(':').map(Number)
    if (Number.isNaN(hh)) continue
    const fireAt = new Date()
    fireAt.setHours(hh, mm || 0, 0, 0)
    if (now.getTime() < fireAt.getTime()) continue
    if (now.getTime() - fireAt.getTime() > 120_000) continue
    const key = `${day}:habit:${habit.id}`
    if (fired.has(key)) continue
    const streak = habitsApi.streak(userId, habit.id)
    const body =
      streak > 0
        ? `Time for ${habit.title} — protect your ${streak}-day streak`
        : `Time for ${habit.title}`
    notify('Habit', body, key)
    markFired(key)
  }
}
