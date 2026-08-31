import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { todayKey, addDays } from '@/lib/dates'
import { notifyCheckIn } from '@/lib/social/streak-sync'
import {
  formatHabitSchedule,
  normalizeReminderTimes,
  reminderTimesOf,
  resolveHabitDays,
  type Habit,
  type HabitFolder,
  type HabitLog,
  type HabitSchedule,
  type Weekday,
} from './types'

const HABITS = 'habits'
const FOLDERS = 'habit_folders'
const LOGS = 'habit_logs'

function now() {
  return new Date().toISOString()
}

function reminderPatch(input: {
  reminder_time?: string | null
  reminder_times?: string[]
}): { reminder_time: string | null; reminder_times: string[] } {
  const times = normalizeReminderTimes([...(input.reminder_times || []), input.reminder_time])
  return {
    reminder_time: times[0] ?? null,
    reminder_times: times,
  }
}

function normalizeHabit(habit: Habit): Habit {
  const times = reminderTimesOf(habit)
  return {
    ...habit,
    folder_id: habit.folder_id ?? null,
    schedule: habit.schedule || 'daily',
    custom_days: Array.isArray(habit.custom_days) ? (habit.custom_days as Weekday[]) : [],
    once_date: habit.once_date ?? null,
    reminder_time: times[0] ?? null,
    reminder_times: times,
    nudge_until_done: habit.nudge_until_done !== false,
  }
}

export const habitsApi = {
  list(userId: string): Habit[] {
    return localDb.list<Habit>(HABITS, userId).map(normalizeHabit)
  },

  listFolders(userId: string): HabitFolder[] {
    return localDb.list<HabitFolder>(FOLDERS, userId).sort((a, b) => a.name.localeCompare(b.name))
  },

  createFolder(userId: string, name: string): HabitFolder {
    const ts = now()
    return localDb.insert(FOLDERS, userId, {
      id: createId(),
      user_id: userId,
      name: name.trim() || 'Folder',
      created_at: ts,
      updated_at: ts,
    })
  },

  updateFolder(userId: string, id: string, patch: Partial<Pick<HabitFolder, 'name'>>): HabitFolder | null {
    return localDb.update<HabitFolder>(FOLDERS, userId, id, { ...patch, updated_at: now() })
  },

  deleteFolder(userId: string, id: string): boolean {
    for (const habit of habitsApi.list(userId).filter((h) => h.folder_id === id)) {
      habitsApi.update(userId, habit.id, { folder_id: null })
    }
    return localDb.remove(FOLDERS, userId, id)
  },

  habitsInFolder(userId: string, folderId: string): Habit[] {
    return habitsApi.list(userId).filter((h) => h.folder_id === folderId)
  },

  get(userId: string, id: string): Habit | null {
    const habit = localDb.getById<Habit>(HABITS, userId, id)
    return habit ? normalizeHabit(habit) : null
  },

  logs(userId: string): HabitLog[] {
    return localDb.list<HabitLog>(LOGS, userId)
  },

  logsForHabit(userId: string, habitId: string): HabitLog[] {
    return habitsApi.logs(userId).filter((l) => l.habit_id === habitId && l.completed)
  },

  /** Last N days of completion flags for heatmap (oldest → newest). */
  heatmap(userId: string, habitId: string, days = 84): { date: string; done: boolean; due: boolean }[] {
    const habit = habitsApi.get(userId, habitId)
    const out: { date: string; done: boolean; due: boolean }[] = []
    let cursor = addDays(new Date(), -(days - 1))
    for (let i = 0; i < days; i++) {
      const key = todayKey(cursor)
      const due = habit ? habitsApi.isDueOn(habit, cursor) : false
      out.push({
        date: key,
        done: habitsApi.isDoneToday(userId, habitId, key),
        due,
      })
      cursor = addDays(cursor, 1)
    }
    return out
  },

  create(
    userId: string,
    input: {
      title: string
      folder_id?: string | null
      schedule?: HabitSchedule
      custom_days?: Weekday[]
      once_date?: string | null
      reminder_time?: string | null
      reminder_times?: string[]
      nudge_until_done?: boolean
    },
  ): Habit {
    const ts = now()
    const schedule = input.schedule || 'daily'
    const reminders = reminderPatch(input)
    return normalizeHabit(
      localDb.insert(HABITS, userId, {
        id: createId(),
        user_id: userId,
        folder_id: input.folder_id ?? null,
        title: input.title.trim(),
        schedule,
        custom_days: schedule === 'custom' ? (input.custom_days || []) : [],
        once_date: schedule === 'once' ? input.once_date || todayKey() : null,
        reminder_time: reminders.reminder_time,
        reminder_times: reminders.reminder_times,
        nudge_until_done: input.nudge_until_done !== false,
        created_at: ts,
        updated_at: ts,
      }),
    )
  },

  update(userId: string, id: string, patch: Partial<Habit>): Habit | null {
    const next: Partial<Habit> = { ...patch, updated_at: now() }
    if (patch.reminder_time !== undefined || patch.reminder_times !== undefined) {
      const current = habitsApi.get(userId, id)
      const reminders = reminderPatch({
        reminder_time: patch.reminder_time !== undefined ? patch.reminder_time : current?.reminder_time,
        reminder_times: patch.reminder_times !== undefined ? patch.reminder_times : current?.reminder_times,
      })
      next.reminder_time = reminders.reminder_time
      next.reminder_times = reminders.reminder_times
    }
    const updated = localDb.update<Habit>(HABITS, userId, id, next)
    return updated ? normalizeHabit(updated) : null
  },

  remove(userId: string, id: string): boolean {
    const logs = habitsApi.logs(userId).filter((l) => l.habit_id !== id)
    localDb.replaceAll(LOGS, userId, logs)
    return localDb.remove(HABITS, userId, id)
  },

  isDoneToday(userId: string, habitId: string, date = todayKey()): boolean {
    return habitsApi.logs(userId).some((l) => l.habit_id === habitId && l.date === date && l.completed)
  },

  /** Whether this habit applies on a given calendar day. */
  isDueOn(habit: Habit, day: Date = new Date()): boolean {
    const key = todayKey(day)
    if (habit.schedule === 'once') {
      return Boolean(habit.once_date) && habit.once_date === key
    }
    const days = resolveHabitDays(habit)
    return days.includes(day.getDay() as Weekday)
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
    const habit = habitsApi.get(userId, habitId)
    if (result.completed) {
      notifyCheckIn(`Checked in on “${habit?.title || 'a habit'}”`)
    } else {
      notifyCheckIn(`Unchecked “${habit?.title || 'a habit'}”`)
    }
    return result
  },

  /** Streak counts consecutive *due* days completed (skips off days). */
  streak(userId: string, habitId: string): number {
    const habit = habitsApi.get(userId, habitId)
    if (!habit || habit.schedule === 'once') return 0
    let streak = 0
    let cursor = new Date()
    // If today is due and not done yet, start counting from yesterday
    if (habitsApi.isDueOn(habit, cursor) && !habitsApi.isDoneToday(userId, habitId, todayKey(cursor))) {
      cursor = addDays(cursor, -1)
    }
    for (let i = 0; i < 730; i++) {
      if (!habitsApi.isDueOn(habit, cursor)) {
        cursor = addDays(cursor, -1)
        continue
      }
      if (!habitsApi.isDoneToday(userId, habitId, todayKey(cursor))) break
      streak += 1
      cursor = addDays(cursor, -1)
    }
    return streak
  },

  dueToday(userId: string): Habit[] {
    const today = new Date()
    return habitsApi.list(userId).filter((h) => habitsApi.isDueOn(h, today))
  },

  scheduleLabel(habit: Habit): string {
    return formatHabitSchedule(habit)
  },
}
