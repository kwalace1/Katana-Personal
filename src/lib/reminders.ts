import { todayKey, formatTime } from '@/lib/dates'
import { tasksApi } from '@/modules/tasks/api'
import { habitsApi } from '@/modules/habits/api'
import { calendarApi } from '@/modules/calendar/api'
import { parseReminderClock, resolveHabitReminderTimes, type Habit } from '@/modules/habits/types'
import { buildOrchestrationNudge } from '@/lib/notifications/orchestration-nudge'
import {
  canNotifyNow,
  orchestrationPushEnabled,
  remindersEnabled,
} from '@/lib/notifications/preferences'
import { canUsePlusFeature } from '@/lib/plus'
import { canShowLocalNotification, showLocalNotification } from '@/lib/web-notify'

const LAST_NUDGE_KEY = 'katana-personal:last-nudge-day'
const FIRED_KEY = 'katana-personal:fired-reminders'
const ORCH_NUDGE_KEY = 'katana-personal:last-orch-nudge'

export { remindersEnabled }

export async function requestReminderPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function canNotify(): boolean {
  return canShowLocalNotification()
}

function nudgeWaveForHour(hour: number): 'morning' | 'afternoon' | 'evening' | null {
  if (hour >= 8 && hour < 13) return 'morning'
  if (hour >= 13 && hour < 18) return 'afternoon'
  if (hour >= 18) return 'evening'
  return null
}

function readFired(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    const today = todayKey()
    return new Set(parsed.filter((k) => k.startsWith(`${today}:`)))
  } catch {
    return new Set()
  }
}

function markFired(ids: string | string[]) {
  const set = readFired()
  for (const id of Array.isArray(ids) ? ids : [ids]) set.add(id)
  const today = todayKey()
  const kept = [...set].filter((k) => k.startsWith(`${today}:`)).slice(-200)
  localStorage.setItem(FIRED_KEY, JSON.stringify(kept))
}

function alreadyNudgedWave(wave: string): boolean {
  return localStorage.getItem(LAST_NUDGE_KEY) === `${todayKey()}:${wave}`
}

function markNudgedWave(wave: string) {
  localStorage.setItem(LAST_NUDGE_KEY, `${todayKey()}:${wave}`)
}

export type HabitReminderSlot = {
  habit: Habit
  time: string
  fireAt: Date
  key: string
}

export function habitReminderSlotsForDay(
  habit: Habit,
  day: Date = new Date(),
): HabitReminderSlot[] {
  const dayKey = todayKey(day)
  return resolveHabitReminderTimes(habit).map((time) => {
    const clock = parseReminderClock(time)!
    const fireAt = new Date(day)
    fireAt.setHours(clock.hh, clock.mm, 0, 0)
    return {
      habit,
      time,
      fireAt,
      key: `${dayKey}:habit:${habit.id}:${time}`,
    }
  })
}

/** Slots that should notify now: time has arrived, habit still open, not yet fired. */
export function dueHabitReminderSlots(
  userId: string,
  now: Date = new Date(),
  fired: Set<string> = readFired(),
): HabitReminderSlot[] {
  const due: HabitReminderSlot[] = []
  for (const habit of habitsApi.dueToday(userId)) {
    if (habitsApi.isDoneToday(userId, habit.id)) continue
    for (const slot of habitReminderSlotsForDay(habit, now)) {
      if (now.getTime() < slot.fireAt.getTime()) continue
      if (fired.has(slot.key)) continue
      due.push(slot)
    }
  }
  return due
}

async function notify(title: string, body: string, tag: string, href = '/') {
  await showLocalNotification(title, body, tag, href)
}

function digestBody(userId: string): string | null {
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
  if (bits.length === 0) return null
  return bits.join(' · ')
}

function alreadyOrchestrationNudged(now: Date): boolean {
  return localStorage.getItem(ORCH_NUDGE_KEY) === now.toISOString().slice(0, 10)
}

function markOrchestrationNudged(now: Date) {
  localStorage.setItem(ORCH_NUDGE_KEY, now.toISOString().slice(0, 10))
}

/** Proactive orchestration nudge — workout gap, focus task, etc. Plus + opt-in. */
export async function maybeSendOrchestrationNudge(
  userId: string,
  preferences?: Record<string, unknown> | null,
  displayName?: string,
  dayClosed?: boolean,
) {
  if (!orchestrationPushEnabled(preferences) || !canUsePlusFeature('orchestration_push')) return
  if (!remindersEnabled(preferences) || !canNotify() || !canNotifyNow(preferences)) return
  if (dayClosed) return

  const now = new Date()
  if (alreadyOrchestrationNudged(now)) return

  const nudge = buildOrchestrationNudge(userId, {
    displayName,
    preferences: preferences ?? undefined,
    dayClosed,
    now,
  })
  if (!nudge || nudge.kind === 'event') return

  await notify(nudge.title, nudge.body, nudge.tag, nudge.href)
  markOrchestrationNudged(now)
}

/** Morning / afternoon / evening digest while anything is still open. */
export async function maybeSendDailyNudge(userId: string, preferences?: Record<string, unknown> | null) {
  if (!remindersEnabled(preferences) || !canNotify() || !canNotifyNow(preferences)) return

  const wave = nudgeWaveForHour(new Date().getHours())
  if (!wave || alreadyNudgedWave(wave)) return

  const body = digestBody(userId)
  if (!body) return

  await notify('Katana', body.charAt(0).toUpperCase() + body.slice(1), `katana-daily-nudge-${wave}`, '/dashboard')
  markNudgedWave(wave)
}

async function fireHabitSlots(slots: HabitReminderSlot[]) {
  if (slots.length === 0) return

  const FRESH_MS = 20 * 60_000
  const now = Date.now()
  const fresh = slots.filter((s) => now - s.fireAt.getTime() <= FRESH_MS)
  const stale = slots.filter((s) => now - s.fireAt.getTime() > FRESH_MS)

  for (const slot of fresh) {
    const streak = habitsApi.streak(slot.habit.user_id, slot.habit.id)
    const body =
      streak > 0
        ? `Time for ${slot.habit.title} — protect your ${streak}-day streak`
        : `Time for ${slot.habit.title}`
    await notify('Habit', body, slot.key, `/habits?id=${slot.habit.id}`)
  }

  if (stale.length > 0) {
    const names = [...new Set(stale.map((s) => s.habit.title))]
    const body =
      names.length === 1
        ? `Still open: ${names[0]}`
        : `Still open: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`
    await notify('Habits', body, stale[0]!.key, '/habits')
  }

  markFired(slots.map((s) => s.key))
}

/**
 * Fire timed reminders for events (reminder_minutes before start)
 * and habits (every reminder slot). Catch-up on open — no 2-minute miss window.
 */
export async function tickTimedReminders(userId: string, preferences?: Record<string, unknown> | null) {
  if (!remindersEnabled(preferences) || !canNotify() || !canNotifyNow(preferences)) return

  const now = new Date()
  const fired = readFired()
  const day = todayKey()

  for (const event of calendarApi.upcoming(userId, 20)) {
    if (event.all_day || event.reminder_minutes == null) continue
    const start = new Date(event.starts_at)
    if (start.getTime() < now.getTime()) continue
    const fireAt = new Date(start.getTime() - event.reminder_minutes * 60_000)
    if (now.getTime() < fireAt.getTime()) continue
    const key = `${day}:event:${event.id}`
    if (fired.has(key)) continue
    await notify('Upcoming', `${event.title} at ${formatTime(event.starts_at)}`, key, '/calendar')
    markFired(key)
  }

  await fireHabitSlots(dueHabitReminderSlots(userId, now, fired))
}

export async function sendTestReminderPing(): Promise<boolean> {
  const ok = await requestReminderPermission()
  if (!ok) return false
  return showLocalNotification(
    'Katana',
    'Reminders are on. Habit pings will land here through the day.',
    'katana-test-ping',
    '/habits',
  )
}
