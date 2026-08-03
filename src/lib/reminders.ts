import { todayKey } from '@/lib/dates'
import { tasksApi } from '@/modules/tasks/api'
import { habitsApi } from '@/modules/habits/api'
import { calendarApi } from '@/modules/calendar/api'

const LAST_NUDGE_KEY = 'katana-personal:last-nudge-day'

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

/** Soft once-a-day nudge based on what’s still open. */
export function maybeSendDailyNudge(userId: string, preferences?: Record<string, unknown> | null) {
  if (!remindersEnabled(preferences) || !canNotify() || alreadyNudgedToday()) return

  const openHabits = habitsApi.dueToday(userId).filter((h) => !habitsApi.isDoneToday(userId, h.id))
  const dueTasks = tasksApi.todayTasks(userId)
  const events = calendarApi.forDay(userId, new Date())

  const bits: string[] = []
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
  try {
    new Notification('Katana', {
      body: body.charAt(0).toUpperCase() + body.slice(1),
      tag: 'katana-daily-nudge',
      silent: false,
    })
    markNudged()
  } catch {
    // Notifications may be blocked in some browsers even after grant
  }
}
