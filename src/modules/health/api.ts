import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { todayKey } from '@/lib/dates'
import { notifyCheckIn, notifyLocalProgress } from '@/lib/social/streak-sync'
import type {
  Workout,
  WaterLog,
  NutritionLog,
  SleepLog,
  MealCategory,
  MealIngredient,
  DietPlan,
  DietPlanDay,
  DietPlanPattern,
  SupplementItem,
  SupplementLog,
  SupplementChecklistRow,
  SupplementTimeOfDay,
  GeoPoint,
} from './types'

const WORKOUTS = 'workouts'
const WATER = 'water_logs'
const NUTRITION = 'nutrition_logs'
const DIET_PLANS = 'diet_plans'
const SLEEP = 'sleep_logs'
const SUPPLEMENT_ITEMS = 'supplement_items'
const SUPPLEMENT_LOGS = 'supplement_logs'

/** Daily goal used for Circles hydration streaks */
export const WATER_GOAL_GLASSES = 6

export const MEAL_CATEGORIES: { value: MealCategory; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

export const SUPPLEMENT_TIMES: { value: SupplementTimeOfDay; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
]

export function supplementTimeOfDay(item: Pick<SupplementItem, 'time_of_day'>): SupplementTimeOfDay {
  return item.time_of_day === 'afternoon' || item.time_of_day === 'evening' ? item.time_of_day : 'morning'
}

function now() {
  return new Date().toISOString()
}

function pickBestWaterRows(rows: WaterLog[]): WaterLog | null {
  if (rows.length === 0) return null
  return rows.reduce((best, row) => {
    if (row.glasses > best.glasses) return row
    if (row.glasses === best.glasses && (row.updated_at || '') > (best.updated_at || '')) return row
    return best
  })
}

function pickBestWaterForDate(userId: string, date: string): WaterLog | null {
  return pickBestWaterRows(localDb.list<WaterLog>(WATER, userId).filter((w) => w.date === date))
}

/** Collapse duplicate same-date water rows in storage (legacy insert-on-read + sync). */
function dedupeWaterLogs(rows: WaterLog[]): WaterLog[] {
  const byDate = new Map<string, WaterLog>()
  for (const row of rows) {
    const existing = byDate.get(row.date)
    if (!existing) {
      byDate.set(row.date, row)
      continue
    }
    if (
      row.glasses > existing.glasses ||
      (row.glasses === existing.glasses && (row.updated_at || '') > (existing.updated_at || ''))
    ) {
      byDate.set(row.date, row)
    }
  }
  return [...byDate.values()]
}

function cleanupWaterDuplicates(userId: string) {
  const groups = new Map<string, WaterLog[]>()
  for (const row of localDb.list<WaterLog>(WATER, userId)) {
    const list = groups.get(row.date) || []
    list.push(row)
    groups.set(row.date, list)
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const best = pickBestWaterRows(group)
    if (!best) continue
    for (const row of group) {
      if (row.id !== best.id) localDb.remove(WATER, userId, row.id)
    }
  }
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
      calories?: number
      path?: GeoPoint[]
      distance_m?: number
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
      calories: input.calories != null ? Math.max(0, Number(input.calories) || 0) : undefined,
      path: input.path,
      distance_m: input.distance_m != null ? Math.max(0, Number(input.distance_m) || 0) : undefined,
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
      calories?: number
      path?: GeoPoint[]
      distance_m?: number
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
      calories: input.calories == null ? undefined : Math.max(0, Number(input.calories) || 0),
      path: input.path,
      distance_m: input.distance_m,
    })
  },

  removeWorkout(userId: string, id: string) {
    return localDb.remove(WORKOUTS, userId, id)
  },

  getWater(userId: string, date = todayKey()): WaterLog {
    const best = pickBestWaterForDate(userId, date)
    if (best) return best
    // Virtual row — never insert empty logs on read (that polluted charts + sync).
    return {
      id: '',
      user_id: userId,
      date,
      glasses: 0,
      updated_at: '',
    }
  },

  setWater(userId: string, glasses: number, date = todayKey()): WaterLog {
    const next = Math.max(0, glasses)
    const rows = localDb.list<WaterLog>(WATER, userId).filter((w) => w.date === date)
    const best = pickBestWaterRows(rows)
    let updated: WaterLog
    if (!best) {
      updated = localDb.insert(WATER, userId, {
        id: createId(),
        user_id: userId,
        date,
        glasses: next,
        updated_at: now(),
      })
    } else {
      updated =
        localDb.update<WaterLog>(WATER, userId, best.id, {
          glasses: next,
          updated_at: now(),
        }) || { ...best, glasses: next, updated_at: now() }
      for (const row of rows) {
        if (row.id !== best.id) localDb.remove(WATER, userId, row.id)
      }
    }
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
      ingredients?: MealIngredient[]
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
      ingredients: (input.ingredients || []).map((item) => ({ ...item })),
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

  listDietPlans(userId: string): DietPlan[] {
    return localDb
      .list<DietPlan>(DIET_PLANS, userId)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  },

  activeDietPlan(userId: string): DietPlan | null {
    return healthApi.listDietPlans(userId).find((plan) => plan.active) || null
  },

  saveDietPlan(
    userId: string,
    input: {
      name: string
      pattern: DietPlanPattern
      days: DietPlanDay[]
      calories: number
      protein: number
      carbs: number
      fat: number
      notes?: string
      active?: boolean
      id?: string
    },
  ): DietPlan {
    const ts = now()
    const makeActive = input.active !== false
    if (makeActive) {
      for (const plan of healthApi.listDietPlans(userId)) {
        if (plan.active) localDb.update<DietPlan>(DIET_PLANS, userId, plan.id, { active: false, updated_at: ts })
      }
    }
    const payload = {
      name: input.name.trim(),
      pattern: input.pattern,
      days: input.days,
      calories: Number(input.calories) || 0,
      protein: Number(input.protein) || 0,
      carbs: Number(input.carbs) || 0,
      fat: Number(input.fat) || 0,
      notes: input.notes || '',
      active: makeActive,
      updated_at: ts,
    }
    if (input.id) {
      const updated = localDb.update<DietPlan>(DIET_PLANS, userId, input.id, payload)
      if (updated) return updated
    }
    const existing = healthApi.listDietPlans(userId)
    const autoActive = makeActive || existing.length === 0
    if (autoActive) {
      for (const plan of existing) {
        if (plan.active) localDb.update<DietPlan>(DIET_PLANS, userId, plan.id, { active: false, updated_at: ts })
      }
    }
    return localDb.insert(DIET_PLANS, userId, {
      id: createId(),
      user_id: userId,
      ...payload,
      active: autoActive,
      created_at: ts,
    })
  },

  removeDietPlan(userId: string, id: string): boolean {
    const wasActive = healthApi.listDietPlans(userId).find((plan) => plan.id === id)?.active
    const ok = localDb.remove(DIET_PLANS, userId, id)
    if (ok && wasActive) {
      const next = healthApi.listDietPlans(userId)[0]
      if (next) healthApi.setActiveDietPlan(userId, next.id)
    }
    return ok
  },

  setActiveDietPlan(userId: string, id: string): void {
    const ts = now()
    for (const plan of healthApi.listDietPlans(userId)) {
      localDb.update<DietPlan>(DIET_PLANS, userId, plan.id, { active: plan.id === id, updated_at: ts })
    }
  },

  plannedDietDay(userId: string, date = todayKey()): { plan: DietPlan; day: DietPlanDay; index: number } | null {
    const active = healthApi.activeDietPlan(userId)
    if (!active || active.days.length === 0) return null
    const d = new Date(`${date}T12:00:00`)
    if (active.pattern === 'weekdays') {
      const index = d.getDay()
      const day = active.days[index] || active.days[0]
      return day ? { plan: active, day, index } : null
    }
    const start = new Date(active.created_at)
    const diff = Math.floor((d.getTime() - start.getTime()) / 86400000)
    const index = ((diff % active.days.length) + active.days.length) % active.days.length
    const day = active.days[index]
    return day ? { plan: active, day, index } : null
  },

  listSleep(userId: string): SleepLog[] {
    return localDb.list<SleepLog>(SLEEP, userId).sort((a, b) => b.date.localeCompare(a.date))
  },

  addSleep(
    userId: string,
    input: {
      hours: number
      quality: SleepLog['quality']
      notes?: string
      date?: string
      bedtime?: string
      wake?: string
      source?: SleepLog['source']
      silent?: boolean
    },
  ): SleepLog {
    const row = localDb.insert(SLEEP, userId, {
      id: createId(),
      user_id: userId,
      date: input.date || todayKey(),
      hours: input.hours,
      quality: input.quality,
      notes: input.notes || '',
      created_at: now(),
      bedtime: input.bedtime,
      wake: input.wake,
      source: input.source || 'manual',
    })
    if (!input.silent) {
      notifyCheckIn(`Logged sleep — ${row.hours}h (${row.quality})`)
    }
    return row
  },

  importSleepNights(
    userId: string,
    nights: {
      date: string
      hours: number
      bedtime?: string
      wake?: string
      source?: SleepLog['source']
    }[],
  ): number {
    const have = new Set(healthApi.listSleep(userId).map((s) => s.date))
    let added = 0
    for (const night of nights) {
      if (have.has(night.date) || night.hours <= 0) continue
      healthApi.addSleep(userId, {
        date: night.date,
        hours: night.hours,
        quality: night.hours >= 7 ? 'good' : 'fair',
        bedtime: night.bedtime,
        wake: night.wake,
        source: night.source || 'apple_health',
        notes: night.source === 'fitbit' ? 'Imported from Fitbit' : 'Imported from Apple Health',
        silent: true,
      })
      have.add(night.date)
      added += 1
    }
    return added
  },

  importWorkouts(
    userId: string,
    rows: { date: string; activity: string; duration_minutes: number; notes?: string }[],
  ): number {
    const have = new Set(
      healthApi
        .listWorkouts(userId)
        .map((w) => `${w.date}:${w.activity.toLowerCase()}:${w.duration_minutes}`),
    )
    let added = 0
    for (const row of rows) {
      const key = `${row.date}:${row.activity.toLowerCase()}:${row.duration_minutes}`
      if (have.has(key) || row.duration_minutes <= 0) continue
      healthApi.addWorkout(userId, {
        activity: row.activity,
        duration_minutes: row.duration_minutes,
        date: row.date,
        notes: row.notes || 'Imported from Apple Health',
        silent: true,
      })
      have.add(key)
      added += 1
    }
    return added
  },

  removeSleep(userId: string, id: string) {
    return localDb.remove(SLEEP, userId, id)
  },

  listWater(userId: string): WaterLog[] {
    return dedupeWaterLogs(localDb.list<WaterLog>(WATER, userId)).sort((a, b) =>
      a.date.localeCompare(b.date),
    )
  },

  waterSeries(userId: string, days = 7): { date: string; glasses: number }[] {
    cleanupWaterDuplicates(userId)
    const map = new Map<string, number>()
    for (const w of healthApi.listWater(userId)) {
      const prev = map.get(w.date)
      if (prev == null || w.glasses > prev) map.set(w.date, w.glasses)
    }
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

  listSupplements(userId: string, includeArchived = false): SupplementItem[] {
    return localDb
      .list<SupplementItem>(SUPPLEMENT_ITEMS, userId)
      .filter((item) => includeArchived || !item.archived)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  },

  addSupplement(
    userId: string,
    input: {
      name: string
      dose_notes?: string
      kind?: 'vitamin' | 'supplement'
      time_of_day?: SupplementTimeOfDay
    },
  ): SupplementItem | null {
    const name = input.name.trim()
    if (!name) return null
    const existing = healthApi.listSupplements(userId)
    return localDb.insert(SUPPLEMENT_ITEMS, userId, {
      id: createId(),
      user_id: userId,
      name,
      dose_notes: (input.dose_notes || '').trim(),
      sort_order: existing.length,
      archived: false,
      kind: input.kind || 'supplement',
      time_of_day: input.time_of_day || 'morning',
      created_at: now(),
    })
  },

  updateSupplement(
    userId: string,
    id: string,
    patch: Partial<Pick<SupplementItem, 'name' | 'dose_notes' | 'sort_order' | 'archived' | 'time_of_day'>>,
  ): SupplementItem | null {
    const next: Partial<SupplementItem> = { ...patch }
    if (typeof patch.name === 'string') next.name = patch.name.trim()
    if (typeof patch.dose_notes === 'string') next.dose_notes = patch.dose_notes.trim()
    return localDb.update<SupplementItem>(SUPPLEMENT_ITEMS, userId, id, next)
  },

  archiveSupplement(userId: string, id: string): SupplementItem | null {
    return healthApi.updateSupplement(userId, id, { archived: true })
  },

  getDayChecklist(userId: string, date = todayKey()): SupplementChecklistRow[] {
    const items = healthApi.listSupplements(userId)
    const logs = localDb
      .list<SupplementLog>(SUPPLEMENT_LOGS, userId)
      .filter((log) => log.date === date)
    const byItem = new Map(logs.map((log) => [log.item_id, log]))
    return items.map((item) => {
      const log = byItem.get(item.id) ?? null
      return {
        item,
        log,
        taken: Boolean(log?.taken),
        doseNotes: (log?.dose_notes || item.dose_notes || '').trim(),
      }
    })
  },

  toggleTaken(
    userId: string,
    itemId: string,
    date = todayKey(),
    taken?: boolean,
  ): SupplementLog {
    const logs = localDb.list<SupplementLog>(SUPPLEMENT_LOGS, userId)
    const existing = logs.find((log) => log.item_id === itemId && log.date === date)
    const item = healthApi.listSupplements(userId, true).find((s) => s.id === itemId)
    const nextTaken = taken ?? !(existing?.taken ?? false)
    if (existing) {
      return (
        localDb.update<SupplementLog>(SUPPLEMENT_LOGS, userId, existing.id, {
          taken: nextTaken,
          updated_at: now(),
        }) || existing
      )
    }
    return localDb.insert(SUPPLEMENT_LOGS, userId, {
      id: createId(),
      user_id: userId,
      item_id: itemId,
      date,
      taken: nextTaken,
      dose_notes: item?.dose_notes || '',
      updated_at: now(),
    })
  },

  setDayDoseNotes(
    userId: string,
    itemId: string,
    date: string,
    doseNotes: string,
  ): SupplementLog {
    const logs = localDb.list<SupplementLog>(SUPPLEMENT_LOGS, userId)
    const existing = logs.find((log) => log.item_id === itemId && log.date === date)
    const notes = doseNotes.trim()
    if (existing) {
      return (
        localDb.update<SupplementLog>(SUPPLEMENT_LOGS, userId, existing.id, {
          dose_notes: notes,
          updated_at: now(),
        }) || existing
      )
    }
    return localDb.insert(SUPPLEMENT_LOGS, userId, {
      id: createId(),
      user_id: userId,
      item_id: itemId,
      date,
      taken: false,
      dose_notes: notes,
      updated_at: now(),
    })
  },
}
