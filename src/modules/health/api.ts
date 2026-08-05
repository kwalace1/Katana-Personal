import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { todayKey } from '@/lib/dates'
import { notifyCheckIn, notifyLocalProgress } from '@/lib/social/streak-sync'
import type { Workout, WaterLog, NutritionLog, SleepLog } from './types'

const WORKOUTS = 'workouts'
const WATER = 'water_logs'
const NUTRITION = 'nutrition_logs'
const SLEEP = 'sleep_logs'

/** Daily goal used for Circles hydration streaks */
export const WATER_GOAL_GLASSES = 6

function now() {
  return new Date().toISOString()
}

export const healthApi = {
  listWorkouts(userId: string): Workout[] {
    return localDb.list<Workout>(WORKOUTS, userId).sort((a, b) => b.date.localeCompare(a.date))
  },

  addWorkout(
    userId: string,
    input: {
      activity: string
      duration_minutes: number
      notes?: string
      date?: string
      lift_session_id?: string
      /** Skip Circles check-in toast (lift logger notifies separately). */
      silent?: boolean
    },
  ): Workout {
    const row = localDb.insert(WORKOUTS, userId, {
      id: createId(),
      user_id: userId,
      date: input.date || todayKey(),
      activity: input.activity.trim(),
      duration_minutes: input.duration_minutes,
      notes: input.notes || '',
      created_at: now(),
      lift_session_id: input.lift_session_id ?? null,
    })
    if (!input.silent) {
      notifyCheckIn(
        `Logged a workout: ${row.activity}${row.duration_minutes ? ` · ${row.duration_minutes} min` : ''}`,
      )
    }
    return row
  },

  removeWorkout(userId: string, id: string) {
    return localDb.remove(WORKOUTS, userId, id)
  },

  getWater(userId: string, date = todayKey()): WaterLog {
    const existing = localDb.list<WaterLog>(WATER, userId).find((w) => w.date === date)
    if (existing) return existing
    return localDb.insert(WATER, userId, {
      id: createId(),
      user_id: userId,
      date,
      glasses: 0,
      updated_at: now(),
    })
  },

  setWater(userId: string, glasses: number, date = todayKey()): WaterLog {
    const current = healthApi.getWater(userId, date)
    const next = Math.max(0, glasses)
    const updated =
      localDb.update<WaterLog>(WATER, userId, current.id, {
        glasses: next,
        updated_at: now(),
      }) || current
    if (date === todayKey()) {
      notifyCheckIn(
        next === 0
          ? 'Reset water for today'
          : `Logged water — ${next} glass${next === 1 ? '' : 'es'} today`,
      )
    } else {
      notifyLocalProgress()
    }
    return updated
  },

  /** Add one glass (today by default). */
  addGlass(userId: string, date = todayKey()): WaterLog {
    const current = healthApi.getWater(userId, date)
    return healthApi.setWater(userId, current.glasses + 1, date)
  },

  listNutrition(userId: string): NutritionLog[] {
    return localDb.list<NutritionLog>(NUTRITION, userId).sort((a, b) => b.date.localeCompare(a.date))
  },

  addNutrition(
    userId: string,
    input: { meal: string; calories: number; notes?: string; date?: string },
  ): NutritionLog {
    const row = localDb.insert(NUTRITION, userId, {
      id: createId(),
      user_id: userId,
      date: input.date || todayKey(),
      meal: input.meal.trim(),
      calories: input.calories,
      notes: input.notes || '',
      created_at: now(),
    })
    notifyCheckIn(
      row.calories > 0
        ? `Logged a meal: ${row.meal} · ${row.calories} cal`
        : `Logged a meal: ${row.meal}`,
    )
    return row
  },

  removeNutrition(userId: string, id: string) {
    return localDb.remove(NUTRITION, userId, id)
  },

  listSleep(userId: string): SleepLog[] {
    return localDb.list<SleepLog>(SLEEP, userId).sort((a, b) => b.date.localeCompare(a.date))
  },

  addSleep(
    userId: string,
    input: { hours: number; quality: SleepLog['quality']; notes?: string; date?: string },
  ): SleepLog {
    const row = localDb.insert(SLEEP, userId, {
      id: createId(),
      user_id: userId,
      date: input.date || todayKey(),
      hours: input.hours,
      quality: input.quality,
      notes: input.notes || '',
      created_at: now(),
    })
    notifyCheckIn(`Logged sleep — ${row.hours}h (${row.quality})`)
    return row
  },

  removeSleep(userId: string, id: string) {
    return localDb.remove(SLEEP, userId, id)
  },

  listWater(userId: string): WaterLog[] {
    return localDb.list<WaterLog>(WATER, userId).sort((a, b) => a.date.localeCompare(b.date))
  },

  /** Daily series for the last `days` days (oldest → newest). */
  waterSeries(userId: string, days = 7): { date: string; glasses: number }[] {
    const map = new Map(healthApi.listWater(userId).map((w) => [w.date, w.glasses]))
    const out: { date: string; glasses: number }[] = []
    let cursor = new Date()
    cursor.setDate(cursor.getDate() - (days - 1))
    for (let i = 0; i < days; i++) {
      const key = todayKey(cursor)
      out.push({ date: key, glasses: map.get(key) ?? 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    return out
  },

  sleepSeries(userId: string, days = 7): { date: string; hours: number }[] {
    const map = new Map(healthApi.listSleep(userId).map((s) => [s.date, s.hours]))
    const out: { date: string; hours: number }[] = []
    let cursor = new Date()
    cursor.setDate(cursor.getDate() - (days - 1))
    for (let i = 0; i < days; i++) {
      const key = todayKey(cursor)
      out.push({ date: key, hours: map.get(key) ?? 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    return out
  },

  workoutMinutesSeries(userId: string, days = 7): { date: string; minutes: number }[] {
    const workouts = healthApi.listWorkouts(userId)
    const out: { date: string; minutes: number }[] = []
    let cursor = new Date()
    cursor.setDate(cursor.getDate() - (days - 1))
    for (let i = 0; i < days; i++) {
      const key = todayKey(cursor)
      const minutes = workouts.filter((w) => w.date === key).reduce((s, w) => s + w.duration_minutes, 0)
      out.push({ date: key, minutes })
      cursor.setDate(cursor.getDate() + 1)
    }
    return out
  },
}
