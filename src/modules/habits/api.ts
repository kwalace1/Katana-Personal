import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { todayKey, addDays } from '@/lib/dates'
import { notifyLocalProgress } from '@/lib/social/streak-sync'
import type { Habit, HabitLog } from './types'

const HABITS = 'habits'
const LOGS = 'habit_logs'

function now() {
  return new Date().toISOString()
}

export const habitsApi = {
  list(userId: string): Habit[] {
    return localDb.list<Habit>(HABITS, userId)
  },

  get(userId: string, id: string): Habit | null {
    return localDb.getById<Habit>(HABITS, userId, id)
  },

  logs(userId: string): HabitLog[] {
    return localDb.list<HabitLog>(LOGS, userId)
  },

  logsForHabit(userId: string, habitId: string): HabitLog[] {
    return habitsApi.logs(userId).filter((l) => l.habit_id === habitId && l.completed)
  },

  /** Last N days of completion flags for heatmap (oldest → newest). */
  heatmap(userId: string, habitId: string, days = 84): { date: string; done: boolean }[] {
    const out: { date: string; done: boolean }[] = []
    let cursor = addDays(new Date(), -(days - 1))
    for (let i = 0; i < days; i++) {
      const key = todayKey(cursor)
      out.push({ date: key, done: habitsApi.isDoneToday(userId, habitId, key) })
      cursor = addDays(cursor, 1)
    }
    return out
  },

  create(
    userId: string,
    input: { title: string; schedule?: Habit['schedule']; reminder_time?: string | null },
  ): Habit {
    const ts = now()
    return localDb.insert(HABITS, userId, {
      id: createId(),
      user_id: userId,
      title: input.title.trim(),
      schedule: input.schedule || 'daily',
      reminder_time: input.reminder_time ?? null,
      created_at: ts,
      updated_at: ts,
    })
  },

  update(userId: string, id: string, patch: Partial<Habit>): Habit | null {
    return localDb.update<Habit>(HABITS, userId, id, { ...patch, updated_at: now() })
  },

  remove(userId: string, id: string): boolean {
    const logs = habitsApi.logs(userId).filter((l) => l.habit_id !== id)
    localDb.replaceAll(LOGS, userId, logs)
    return localDb.remove(HABITS, userId, id)
  },

  isDoneToday(userId: string, habitId: string, date = todayKey()): boolean {
    return habitsApi.logs(userId).some((l) => l.habit_id === habitId && l.date === date && l.completed)
  },

  toggleToday(userId: string, habitId: string, date = todayKey()): HabitLog {
    const logs = habitsApi.logs(userId)
    const existing = logs.find((l) => l.habit_id === habitId && l.date === date)
    let result: HabitLog
    if (existing) {
      const updated = { ...existing, completed: !existing.completed }
      localDb.update<HabitLog>(LOGS, userId, existing.id, updated)
      result = updated
    } else {
      result = localDb.insert(LOGS, userId, {
        id: createId(),
        user_id: userId,
        habit_id: habitId,
        date,
        completed: true,
        created_at: now(),
      })
    }
    notifyLocalProgress()
    return result
  },

  streak(userId: string, habitId: string): number {
    let streak = 0
    let cursor = new Date()
    for (let i = 0; i < 365; i++) {
      const key = todayKey(cursor)
      const done = habitsApi.isDoneToday(userId, habitId, key)
      if (!done) {
        if (i === 0) {
          cursor = addDays(cursor, -1)
          continue
        }
        break
      }
      streak += 1
      cursor = addDays(cursor, -1)
    }
    return streak
  },

  dueToday(userId: string): Habit[] {
    const day = new Date().getDay()
    const isWeekend = day === 0 || day === 6
    return habitsApi.list(userId).filter((h) => {
      if (h.schedule === 'daily') return true
      if (h.schedule === 'weekdays') return !isWeekend
      return isWeekend
    })
  },
}
