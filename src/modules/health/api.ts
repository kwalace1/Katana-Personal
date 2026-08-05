import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { todayKey } from '@/lib/dates'
import { notifyCheckIn, notifyLocalProgress } from '@/lib/social/streak-sync'
import type { Workout, WaterLog, NutritionLog, SleepLog, MealCategory } from './types'

const WORKOUTS = 'workouts'
const WATER = 'water_logs'
const NUTRITION = 'nutrition_logs'
const SLEEP = 'sleep_logs'

/** Daily goal used for Circles hydration streaks */
export const WATER_GOAL_GLASSES = 6

export const MEAL_CATEGORIES: { value: MealCategory; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

function now() {
  return new Date().toISOString()
}

export function durationTotalMinutes(input: {
  hours?: number
  minutes?: number
  seconds?: number
}): number {
  const hours = Math.max(0, Number(input.hours) || 0)
  const minutes = Math.min(59, Math.max(0, Number(input.minutes) || 0))
  const seconds = Math.min(59, Math.max(0, Number(input.seconds) || 0))
  return hours * 60 + minutes + seconds / 60
}

export function durationTotalSeconds(input: {
  hours?: number
  minutes?: number
  seconds?: number
}): number {
  return Math.round(durationTotalMinutes(input) * 60)
}

export function formatCardioDuration(entry: {
  duration_hours?: number | null
  duration_mins?: number | null
  duration_secs?: number | null
  duration_minutes?: number
}): string {
  let hours = Number(entry.duration_hours) || 0
  let minutes = Number(entry.duration_mins) || 0
  let seconds = Number(entry.duration_secs) || 0
  if (!hours && !minutes && !seconds && entry.duration_minutes) {
    const total = Math.round(entry.duration_minutes * 60)
    hours = Math.floor(total / 3600)
    minutes = Math.floor((total % 3600) / 60)
    seconds = total % 60
  }
  const parts: string[] = []
  if (hours) parts.push(`${hours}h`)
  if (minutes || hours) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)
  return parts.join(' ')
}

export function formatMealCategory(category?: MealCategory | string | null): string {
  return MEAL_CATEGORIES.find((c) => c.value === category)?.label || 'Meal'
}

export function formatMealTime(value?: string | null): string {
  if (!value) return ''
  const [h, m] = value.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatMacros(entry: { protein?: number; carbs?: number; fat?: number }): string {
  return `${Number(entry.protein) || 0}P · ${Number(entry.carbs) || 0}C · ${Number(entry.fat) || 0}F`
}

function localTimeHHMM(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export const healthApi = {
  listWorkouts(userId: string): Workout[] {
    return localDb.list<Workout>(WORKOUTS, userId).sort((a, b) => b.date.localeCompare(a.date))
  },

  /** Cardio-only rows (excludes lift dual-write shadows). */
  listCardio(userId: string): Workout[] {
    return healthApi
      .listWorkouts(userId)
      .filter((w) => !w.lift_session_id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  },

  addWorkout(
    userId: string,
    input: {
      activity: string
      duration_minutes: number
      notes?: string
      date?: string
      lift_session_id?: string
      silent?: boolean
      duration_hours?: number
      duration_mins?: number
      duration_secs?: number
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
      duration_hours: input.duration_hours ?? 0,
      duration_mins: input.duration_mins ?? 0,
      duration_secs: input.duration_secs ?? 0,
    })
    if (!input.silent) {
      notifyCheckIn(
        `Logged a workout: ${row.activity}${row.duration_minutes ? ` · ${formatCardioDuration(row)}` : ''}`,
      )
    }
    return row
  },

  addCardio(
    userId: string,
    input: {
      activity: string
      date?: string
      hours?: number
      minutes?: number
      seconds?: number
      notes?: string
    },
  ): Workout | null {
    const hours = Math.max(0, Number(input.hours) || 0)
    const minutes = Math.min(59, Math.max(0, Number(input.minutes) || 0))
    const seconds = Math.min(59, Math.max(0, Number(input.seconds) || 0))
    if (durationTotalSeconds({ hours, minutes, seconds }) <= 0) return null
    return healthApi.addWorkout(userId, {
      activity: input.activity,
      date: input.date,
      notes: input.notes,
      duration_hours: hours,
      duration_mins: minutes,
      duration_secs: seconds,
      duration_minutes: durationTotalMinutes({ hours, minutes, seconds }),
    })
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

  addGlass(userId: string, date = todayKey()): WaterLog {
    const current = healthApi.getWater(userId, date)
    return healthApi.setWater(userId, current.glasses + 1, date)
  },

  listNutrition(userId: string): NutritionLog[] {
    return localDb.list<NutritionLog>(NUTRITION, userId).sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date)
      if (dateCompare) return dateCompare
      return (b.time || '').localeCompare(a.time || '') || b.created_at.localeCompare(a.created_at)
    })
  },

  nutritionDayTotals(
    userId: string,
    date: string,
  ): { calories: number; protein: number; carbs: number; fat: number; count: number } {
    const meals = healthApi.listNutrition(userId).filter((n) => n.date === date)
    return meals.reduce(
      (totals, entry) => ({
        calories: totals.calories + (Number(entry.calories) || 0),
        protein: totals.protein + (Number(entry.protein) || 0),
        carbs: totals.carbs + (Number(entry.carbs) || 0),
        fat: totals.fat + (Number(entry.fat) || 0),
        count: totals.count + 1,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 },
    )
  },

  addNutrition(
    userId: string,
    input: {
      meal: string
      calories: number
      notes?: string
      date?: string
      category?: MealCategory
      time?: string
      protein?: number
      carbs?: number
      fat?: number
    },
  ): NutritionLog {
    const row = localDb.insert(NUTRITION, userId, {
      id: createId(),
      user_id: userId,
      date: input.date || todayKey(),
      meal: input.meal.trim(),
      calories: input.calories,
      notes: input.notes || '',
      created_at: now(),
      category: input.category || 'snack',
      time: input.time || localTimeHHMM(),
      protein: Number(input.protein) || 0,
      carbs: Number(input.carbs) || 0,
      fat: Number(input.fat) || 0,
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
