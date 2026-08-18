import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { todayKey } from '@/lib/dates'
import { notifyCheckIn } from '@/lib/social/streak-sync'
import { healthApi } from './api'
import type {
  BodyWeightLog,
  LiftExercise,
  LiftProgressMetric,
  LiftProgressPoint,
  LiftSession,
  LiftSet,
  LiftWorkoutDraftExercise,
  SplitDay,
  SplitPattern,
  TrainingSplit,
  WeightGoal,
  WeightGoalMode,
} from './types'

const EXERCISES = 'lift_exercises'
const SESSIONS = 'lift_sessions'
const SETS = 'lift_sets'
const SPLITS = 'training_splits'
const WEIGHT_LOGS = 'body_weight_logs'
const WEIGHT_GOALS = 'weight_goals'

function now() {
  return new Date().toISOString()
}

/** Built-in library from personal-lift-tracker (plus a few Katana defaults). */
const DEFAULT_EXERCISES: { name: string; muscle: string }[] = [
  { name: 'Bench Press', muscle: 'Chest' },
  { name: 'Incline Bench Press', muscle: 'Chest' },
  { name: 'Overhead Press', muscle: 'Shoulders' },
  { name: 'Cable Fly', muscle: 'Chest' },
  { name: 'Lat Pulldown', muscle: 'Back' },
  { name: 'Pull-Up', muscle: 'Back' },
  { name: 'Barbell Row', muscle: 'Back' },
  { name: 'T-Bar Row', muscle: 'Back' },
  { name: 'Squat', muscle: 'Legs' },
  { name: 'Leg Press', muscle: 'Legs' },
  { name: 'Romanian Deadlift', muscle: 'Legs' },
  { name: 'Deadlift', muscle: 'Back' },
  { name: 'Leg Extension', muscle: 'Legs' },
  { name: 'Leg Curl', muscle: 'Legs' },
  { name: 'Lateral Raise', muscle: 'Shoulders' },
  { name: 'Triceps Pushdown', muscle: 'Arms' },
  { name: 'Preacher Curl', muscle: 'Arms' },
  { name: 'Incline Dumbbell Curl', muscle: 'Arms' },
  { name: 'Dumbbell Curl', muscle: 'Arms' },
]

export const EXERCISE_LIBRARY_NAMES = DEFAULT_EXERCISES.map((e) => e.name)

export const SPLIT_PRESETS: { name: string; pattern: SplitPattern; days: SplitDay[] }[] = [
  {
    name: 'Push / Pull / Legs',
    pattern: 'cycle',
    days: [
      { name: 'Push', focus: 'Chest, shoulders, triceps' },
      { name: 'Pull', focus: 'Back, biceps' },
      { name: 'Legs', focus: 'Quads, hamstrings, glutes' },
      { name: 'Rest', focus: 'Recovery' },
    ],
  },
  {
    name: 'Upper / Lower',
    pattern: 'cycle',
    days: [
      { name: 'Upper', focus: 'Push + pull' },
      { name: 'Lower', focus: 'Squat + hinge' },
      { name: 'Rest', focus: 'Recovery' },
    ],
  },
  {
    name: 'Weekday plan',
    pattern: 'weekdays',
    days: [
      { name: 'Rest', focus: 'Sunday' },
      { name: 'Push', focus: 'Monday' },
      { name: 'Pull', focus: 'Tuesday' },
      { name: 'Legs', focus: 'Wednesday' },
      { name: 'Upper', focus: 'Thursday' },
      { name: 'Lower', focus: 'Friday' },
      { name: 'Rest', focus: 'Saturday' },
    ],
  },
]

export function estimated1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function parseRepRange(reps: string | undefined): { min: string; max: string } {
  const raw = (reps || '').trim()
  const match = raw.match(/^(\d+)\s*[–-]\s*(\d+)$/)
  if (match) return { min: match[1] || '', max: match[2] || '' }
  if (/^\d+$/.test(raw)) return { min: raw, max: raw }
  return { min: '', max: '' }
}

export function formatRepRange(min: string | number, max: string | number): string {
  const a = Number(min)
  const b = Number(max)
  const hasA = Number.isFinite(a) && a > 0
  const hasB = Number.isFinite(b) && b > 0
  if (hasA && hasB) {
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    return lo === hi ? String(lo) : `${lo}–${hi}`
  }
  if (hasA) return String(a)
  if (hasB) return String(b)
  return ''
}

export function formatSplitExerciseLine(exercise: { name: string; sets: number; reps: string }): string {
  const name = exercise.name.trim()
  if (!name) return ''
  const sets = exercise.sets > 0 ? String(exercise.sets) : ''
  const reps = exercise.reps.trim()
  if (sets && reps) return `${name} · ${sets} × ${reps}`
  if (sets) return `${name} · ${sets} sets`
  if (reps) return `${name} · ${reps} reps`
  return name
}

export function cleanSplitExercises(
  exercises: { name: string; sets: number; reps: string }[] | undefined,
): { name: string; sets: number; reps: string }[] {
  return (exercises || [])
    .map((exercise) => {
      const parsed = parseRepRange(exercise.reps)
      return {
        name: exercise.name.trim(),
        sets: Math.max(0, Math.round(Number(exercise.sets) || 0)),
        reps: formatRepRange(parsed.min, parsed.max),
      }
    })
    .filter((exercise) => exercise.name)
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return todayKey(d)
}

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00`).getTime()
  const b = new Date(`${end}T12:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

function roundLb(n: number): number {
  return Number(n.toFixed(2))
}

export function formatLb(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return String(Number(value.toFixed(2)))
}

export function formatSignedLb(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value > 0) return `+${formatLb(value)} lb`
  if (value < 0) return `-${formatLb(Math.abs(value))} lb`
  return '0 lb'
}

export function weeklyTargetOnDate(plan: WeightGoalPlan | null, dateISO: string): number | null {
  if (!plan) return null
  if (dateISO < plan.startDate) return plan.startWeight
  if (dateISO > plan.targetDate) return plan.targetWeight
  const week = plan.weeks.find((item) => dateISO >= item.weekStart && dateISO <= item.weekEnd)
  if (week) return week.targetWeight
  return plan.weeks.find((item) => dateISO < item.weekStart)?.targetWeight ?? plan.weeks.at(-1)?.targetWeight ?? null
}

export function getWeightGoalPaceStatus(
  actual: number | null | undefined,
  expected: number | null | undefined,
  weeklyChange: number,
  checkInCount: number,
): { label: string; tone: 'muted' | 'ok' | 'ahead' | 'behind'; note: string } {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    return { label: '—', tone: 'muted', note: "Log weigh-ins to compare this week's average" }
  }
  const diff = Number(actual) - Number(expected)
  const sample = checkInCount
    ? `${checkInCount} check-in${checkInCount === 1 ? '' : 's'}`
    : 'weekly average'
  if (Math.abs(diff) <= 0.5) {
    return {
      label: 'On track',
      tone: 'ok',
      note: `${formatSignedLb(diff)} vs ${formatLb(expected)} lb avg target · ${sample}`,
    }
  }
  if (Math.abs(weeklyChange) < 0.01) {
    return {
      label: 'Off pace',
      tone: 'behind',
      note: `${formatSignedLb(diff)} vs ${formatLb(expected)} lb avg target · ${sample}`,
    }
  }
  const ahead = weeklyChange > 0 ? diff > 0 : diff < 0
  return {
    label: ahead ? 'Ahead' : 'Behind',
    tone: ahead ? 'ahead' : 'behind',
    note: `${formatSignedLb(diff)} vs ${formatLb(expected)} lb avg target · ${sample}`,
  }
}

export function latestWeekWithAverage(plan: WeightGoalPlan | null): WeightGoalWeek | null {
  return [...(plan?.weeks || [])].reverse().find((week) => Number.isFinite(week.actual)) ?? null
}

export type WeightGoalWeek = {
  week: number
  weekStart: string
  weekEnd: string
  targetWeight: number
  change: number
  actual: number | null
  checkInCount: number
  isCurrent: boolean
  isPast: boolean
  isFinal: boolean
}

export type WeightGoalPlan = {
  startWeight: number
  startDate: string
  targetWeight: number
  targetDate: string
  totalDays: number
  totalWeeks: number
  totalChange: number
  weeklyChange: number
  weeks: WeightGoalWeek[]
}

export const liftApi = {
  ensureDefaultExercises(userId: string): void {
    const existing = localDb.list<LiftExercise>(EXERCISES, userId)
    if (existing.length === 0) {
      const ts = now()
      for (const ex of DEFAULT_EXERCISES) {
        localDb.insert(EXERCISES, userId, {
          id: createId(),
          user_id: userId,
          name: ex.name,
          muscle: ex.muscle,
          created_at: ts,
        })
      }
      return
    }
    // Backfill any missing library names without wiping user customs
    const have = new Set(existing.map((e) => e.name.toLowerCase()))
    const ts = now()
    for (const ex of DEFAULT_EXERCISES) {
      if (have.has(ex.name.toLowerCase())) continue
      localDb.insert(EXERCISES, userId, {
        id: createId(),
        user_id: userId,
        name: ex.name,
        muscle: ex.muscle,
        created_at: ts,
      })
    }
  },

  listExercises(userId: string): LiftExercise[] {
    liftApi.ensureDefaultExercises(userId)
    return localDb
      .list<LiftExercise>(EXERCISES, userId)
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  /** Unique sorted names: library ∪ used in sessions. */
  getExerciseNames(userId: string): string[] {
    const names = new Set(liftApi.listExercises(userId).map((e) => e.name))
    const byId = new Map(liftApi.listExercises(userId).map((e) => [e.id, e.name]))
    for (const set of localDb.list<LiftSet>(SETS, userId)) {
      const n = byId.get(set.exercise_id)
      if (n) names.add(n)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  },

  /** Names that appear in at least one logged set (excludes unused library defaults). */
  getLoggedExerciseNames(userId: string): string[] {
    const byId = new Map(
      localDb.list<LiftExercise>(EXERCISES, userId).map((e) => [e.id, e.name]),
    )
    const names = new Set<string>()
    for (const set of localDb.list<LiftSet>(SETS, userId)) {
      const n = byId.get(set.exercise_id)
      if (n) names.add(n)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  },

  addExercise(userId: string, input: { name: string; muscle?: string }): LiftExercise {
    return localDb.insert(EXERCISES, userId, {
      id: createId(),
      user_id: userId,
      name: input.name.trim(),
      muscle: input.muscle?.trim() || 'Other',
      created_at: now(),
    })
  },

  findOrCreateExercise(userId: string, name: string, muscle?: string): LiftExercise {
    const trimmed = name.trim()
    const existing = liftApi
      .listExercises(userId)
      .find((e) => e.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    return liftApi.addExercise(userId, { name: trimmed, muscle })
  },

  removeExercise(userId: string, id: string): boolean {
    const used = localDb.list<LiftSet>(SETS, userId).some((s) => s.exercise_id === id)
    if (used) return false
    return localDb.remove(EXERCISES, userId, id)
  },

  listSessions(userId: string): LiftSession[] {
    return localDb
      .list<LiftSession>(SESSIONS, userId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  },

  getSession(userId: string, id: string): LiftSession | null {
    return localDb.getById<LiftSession>(SESSIONS, userId, id)
  },

  listSetsForSession(userId: string, sessionId: string): LiftSet[] {
    return localDb
      .list<LiftSet>(SETS, userId)
      .filter((s) => s.session_id === sessionId)
      .sort((a, b) => a.set_index - b.set_index || a.created_at.localeCompare(b.created_at))
  },

  listSetsForExercise(userId: string, exerciseId: string): LiftSet[] {
    return localDb
      .list<LiftSet>(SETS, userId)
      .filter((s) => s.exercise_id === exerciseId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  },

  /** Group sets by exercise for history display. */
  sessionExerciseGroups(
    userId: string,
    sessionId: string,
  ): { exercise_id: string; name: string; sets: LiftSet[] }[] {
    const sets = liftApi.listSetsForSession(userId, sessionId)
    const byEx = new Map<string, LiftSet[]>()
    for (const s of sets) {
      const list = byEx.get(s.exercise_id) || []
      list.push(s)
      byEx.set(s.exercise_id, list)
    }
    const exercises = new Map(liftApi.listExercises(userId).map((e) => [e.id, e.name]))
    return [...byEx.entries()].map(([exercise_id, group]) => ({
      exercise_id,
      name: exercises.get(exercise_id) || 'Exercise',
      sets: group,
    }))
  },

  /**
   * Create a lift session with sets. Also logs a cardio Workout row so Move can stay separate via lift_session_id.
   */
  logSession(
    userId: string,
    input: {
      date?: string
      title: string
      notes?: string
      sets: { exercise_id: string; reps: number; weight: number }[]
    },
  ): LiftSession {
    const date = input.date || todayKey()
    const session = localDb.insert(SESSIONS, userId, {
      id: createId(),
      user_id: userId,
      date,
      title: input.title.trim() || 'Lift',
      notes: input.notes || '',
      created_at: now(),
    }) as LiftSession

    input.sets.forEach((s, i) => {
      localDb.insert(SETS, userId, {
        id: createId(),
        user_id: userId,
        session_id: session.id,
        exercise_id: s.exercise_id,
        set_index: i + 1,
        reps: Math.max(0, s.reps),
        weight: Math.max(0, s.weight),
        created_at: now(),
      })
    })

    const minutes = Math.max(20, input.sets.length * 3)
    healthApi.addWorkout(userId, {
      activity: session.title,
      duration_minutes: minutes,
      notes: input.notes,
      date,
      lift_session_id: session.id,
      silent: true,
    })

    notifyCheckIn(
      `Logged lift: ${session.title}${input.sets.length ? ` · ${input.sets.length} set${input.sets.length === 1 ? '' : 's'}` : ''}`,
    )
    return session
  },

  /** Tracker-style nested workout → session + sets (Circles-safe). */
  logWorkout(
    userId: string,
    input: {
      date?: string
      name: string
      notes?: string
      exercises: LiftWorkoutDraftExercise[]
    },
  ): LiftSession | null {
    const flat: { exercise_id: string; reps: number; weight: number }[] = []
    for (const ex of input.exercises) {
      const name = ex.name.trim()
      if (!name) continue
      const kept = ex.sets.filter((s) => s.reps > 0)
      if (kept.length === 0) continue
      const exercise = liftApi.findOrCreateExercise(userId, name)
      for (const s of kept) {
        flat.push({
          exercise_id: exercise.id,
          reps: s.reps,
          weight: Number(s.weight) || 0,
        })
      }
    }
    if (flat.length === 0) return null
    return liftApi.logSession(userId, {
      date: input.date,
      title: input.name.trim() || 'Lift',
      notes: input.notes,
      sets: flat,
    })
  },

  updateWorkout(
    userId: string,
    sessionId: string,
    input: {
      date?: string
      name: string
      notes?: string
      exercises: LiftWorkoutDraftExercise[]
    },
  ): LiftSession | null {
    const session = liftApi.getSession(userId, sessionId)
    if (!session) return null
    const flat: { exercise_id: string; reps: number; weight: number }[] = []
    for (const ex of input.exercises) {
      const name = ex.name.trim()
      if (!name) continue
      const kept = ex.sets.filter((s) => s.reps > 0)
      if (kept.length === 0) continue
      const exercise = liftApi.findOrCreateExercise(userId, name)
      for (const s of kept) {
        flat.push({
          exercise_id: exercise.id,
          reps: s.reps,
          weight: Number(s.weight) || 0,
        })
      }
    }
    if (flat.length === 0) return null
    for (const set of liftApi.listSetsForSession(userId, sessionId)) {
      localDb.remove(SETS, userId, set.id)
    }
    const date = input.date || session.date
    const title = input.name.trim() || session.title
    const notes = input.notes ?? session.notes
    const updated =
      localDb.update<LiftSession>(SESSIONS, userId, sessionId, {
        date,
        title,
        notes,
      }) || session
    flat.forEach((s, i) => {
      localDb.insert(SETS, userId, {
        id: createId(),
        user_id: userId,
        session_id: sessionId,
        exercise_id: s.exercise_id,
        set_index: i + 1,
        reps: Math.max(0, s.reps),
        weight: Math.max(0, s.weight),
        created_at: now(),
      })
    })
    for (const w of healthApi.listWorkouts(userId)) {
      if (w.lift_session_id !== sessionId) continue
      healthApi.removeWorkout(userId, w.id)
      healthApi.addWorkout(userId, {
        activity: title,
        duration_minutes: Math.max(20, flat.length * 3),
        notes,
        date,
        lift_session_id: sessionId,
        silent: true,
      })
    }
    return updated
  },

  getPreviousTopSet(
    userId: string,
    exerciseName: string,
    excludeSessionId?: string | null,
  ): { weight: number; reps: number; date: string } | null {
    const needle = exerciseName.trim().toLowerCase()
    if (!needle) return null
    const match = liftApi
      .listExercises(userId)
      .find((e) => e.name.toLowerCase() === needle)
    if (!match) return null
    for (const session of liftApi.listSessions(userId)) {
      if (excludeSessionId && session.id === excludeSessionId) continue
      const sets = liftApi
        .listSetsForSession(userId, session.id)
        .filter((s) => s.exercise_id === match.id)
      if (sets.length === 0) continue
      let best = sets[0]
      for (const set of sets) {
        if (!best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)) {
          best = set
        }
      }
      if (!best) continue
      return { weight: best.weight, reps: best.reps, date: session.date }
    }
    return null
  },

  exercisesFromSession(
    userId: string,
    sessionId: string,
  ): { name: string; sets: number; reps: string }[] {
    return liftApi.sessionExerciseGroups(userId, sessionId).map((group) => {
      const reps = group.sets.map((s) => s.reps).filter((n) => n > 0)
      const min = reps.length ? Math.min(...reps) : 0
      const max = reps.length ? Math.max(...reps) : 0
      return {
        name: group.name,
        sets: group.sets.length,
        reps: formatRepRange(min, max),
      }
    })
  },

  saveSplitFromSessions(
    userId: string,
    input: { name: string; sessionIds: string[] },
  ): TrainingSplit | null {
    const sessions = input.sessionIds
      .map((id) => liftApi.getSession(userId, id))
      .filter((session): session is LiftSession => Boolean(session))
    if (sessions.length === 0) return null
    const hasActive = liftApi.listSplits(userId).some((s) => s.active)
    return liftApi.saveSplit(userId, {
      name: input.name.trim(),
      pattern: 'cycle',
      days: sessions.map((session, index) => ({
        name: `Day ${index + 1}`,
        focus: session.title || 'Workout',
        exercises: liftApi.exercisesFromSession(userId, session.id),
      })),
      active: !hasActive,
    })
  },

  removeSession(userId: string, sessionId: string): void {
    for (const set of liftApi.listSetsForSession(userId, sessionId)) {
      localDb.remove(SETS, userId, set.id)
    }
    localDb.remove(SESSIONS, userId, sessionId)
    for (const w of healthApi.listWorkouts(userId)) {
      if (w.lift_session_id === sessionId) healthApi.removeWorkout(userId, w.id)
    }
  },

  /** Best weight per day (legacy sparkline helper). */
  exerciseProgressSeries(
    userId: string,
    exerciseId: string,
  ): { date: string; weight: number; reps: number; session_id: string }[] {
    const sets = liftApi.listSetsForExercise(userId, exerciseId)
    const sessions = new Map(liftApi.listSessions(userId).map((s) => [s.id, s]))
    const byDate = new Map<string, { weight: number; reps: number; session_id: string }>()
    for (const set of sets) {
      const session = sessions.get(set.session_id)
      if (!session) continue
      const prev = byDate.get(session.date)
      if (!prev || set.weight > prev.weight || (set.weight === prev.weight && set.reps > prev.reps)) {
        byDate.set(session.date, { weight: set.weight, reps: set.reps, session_id: set.session_id })
      }
    }
    return [...byDate.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
  },

  /** Tracker progress: top weight | e1RM | session volume per workout occurrence. */
  getExerciseProgress(
    userId: string,
    exerciseName: string,
    metric: LiftProgressMetric,
  ): LiftProgressPoint[] {
    const exercises = liftApi.listExercises(userId)
    const match = exercises.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase())
    if (!match) return []

    const points: LiftProgressPoint[] = []
    for (const session of liftApi.listSessions(userId)) {
      const sets = liftApi.listSetsForSession(userId, session.id).filter((s) => s.exercise_id === match.id)
      if (sets.length === 0) continue

      let value: number
      if (metric === 'volume') {
        value = sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
      } else if (metric === 'estimated1RM') {
        value = Math.max(...sets.map((s) => estimated1RM(s.weight, s.reps)))
      } else {
        value = Math.max(...sets.map((s) => s.weight))
      }

      points.push({
        date: session.date,
        workoutName: session.title,
        session_id: session.id,
        value,
        sets: sets.length,
        setSummary: sets.map((s) => `${s.weight.toLocaleString()} × ${s.reps}`).join(', '),
      })
    }

    return points.sort((a, b) => a.date.localeCompare(b.date) || a.session_id.localeCompare(b.session_id))
  },

  /** Top-weight PRs in a session vs prior history (first-ever lift is not a PR). */
  findTopWeightPrsForSession(
    userId: string,
    sessionId: string,
  ): { exerciseName: string; weight: number; reps: number; previousBest: number }[] {
    const groups = liftApi.sessionExerciseGroups(userId, sessionId)
    const out: { exerciseName: string; weight: number; reps: number; previousBest: number }[] = []
    for (const group of groups) {
      const points = liftApi.getExerciseProgress(userId, group.name, 'topWeight')
      const prior = points.filter((p) => p.session_id !== sessionId)
      if (prior.length === 0) continue
      const previousBest = Math.max(...prior.map((p) => p.value))
      let bestSet = group.sets[0]
      for (const s of group.sets) {
        if (!bestSet || s.weight > bestSet.weight || (s.weight === bestSet.weight && s.reps > bestSet.reps)) {
          bestSet = s
        }
      }
      if (!bestSet || bestSet.weight <= previousBest) continue
      out.push({
        exerciseName: group.name,
        weight: bestSet.weight,
        reps: bestSet.reps,
        previousBest,
      })
    }
    return out.sort((a, b) => b.weight - a.weight || b.reps - a.reps)
  },

  listSplits(userId: string): TrainingSplit[] {
    return localDb
      .list<TrainingSplit>(SPLITS, userId)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  },

  saveSplit(
    userId: string,
    input: { name: string; pattern: SplitPattern; days: SplitDay[]; active?: boolean; id?: string },
  ): TrainingSplit {
    const ts = now()
    const makeActive = input.active !== false
    if (makeActive) {
      for (const s of liftApi.listSplits(userId)) {
        if (s.active) localDb.update<TrainingSplit>(SPLITS, userId, s.id, { active: false, updated_at: ts })
      }
    }
    if (input.id) {
      const updated = localDb.update<TrainingSplit>(SPLITS, userId, input.id, {
        name: input.name.trim(),
        pattern: input.pattern,
        days: input.days.map((day) => ({
          ...day,
          exercises: cleanSplitExercises(day.exercises),
        })),
        active: makeActive,
        updated_at: ts,
      })
      if (updated) return updated
    }
    const existing = liftApi.listSplits(userId)
    const autoActive = makeActive || existing.length === 0
    if (autoActive) {
      for (const s of existing) {
        if (s.active) localDb.update<TrainingSplit>(SPLITS, userId, s.id, { active: false, updated_at: ts })
      }
    }
    return localDb.insert(SPLITS, userId, {
      id: createId(),
      user_id: userId,
      name: input.name.trim(),
      pattern: input.pattern,
      days: input.days.map((day) => ({
        ...day,
        exercises: cleanSplitExercises(day.exercises),
      })),
      active: autoActive,
      created_at: ts,
      updated_at: ts,
    })
  },

  removeSplit(userId: string, id: string): boolean {
    const wasActive = liftApi.listSplits(userId).find((s) => s.id === id)?.active
    const ok = localDb.remove(SPLITS, userId, id)
    if (ok && wasActive) {
      const next = liftApi.listSplits(userId)[0]
      if (next) liftApi.setActiveSplit(userId, next.id)
    }
    return ok
  },

  setActiveSplit(userId: string, id: string): void {
    const ts = now()
    for (const s of liftApi.listSplits(userId)) {
      localDb.update<TrainingSplit>(SPLITS, userId, s.id, { active: s.id === id, updated_at: ts })
    }
  },

  plannedDay(userId: string, date = todayKey()): { split: TrainingSplit; day: SplitDay; index: number } | null {
    const active = liftApi.listSplits(userId).find((s) => s.active)
    if (!active || active.days.length === 0) return null
    const d = new Date(date + 'T12:00:00')
    let index = 0
    if (active.pattern === 'weekdays') {
      index = d.getDay() % active.days.length
    } else {
      const start = new Date(active.created_at)
      start.setHours(12, 0, 0, 0)
      const diff = Math.floor((d.getTime() - start.getTime()) / 86_400_000)
      index = ((diff % active.days.length) + active.days.length) % active.days.length
    }
    return { split: active, day: active.days[index], index }
  },

  /** Calendar day detail: lifts + bodyweight. */
  calendarDay(
    userId: string,
    date: string,
  ): { sessions: LiftSession[]; weight: BodyWeightLog | null } {
    return {
      sessions: liftApi.listSessions(userId).filter((s) => s.date === date),
      weight: liftApi.listBodyWeight(userId).find((w) => w.date === date) ?? null,
    }
  },

  listBodyWeight(userId: string): BodyWeightLog[] {
    return localDb.list<BodyWeightLog>(WEIGHT_LOGS, userId).sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare) return dateCompare
      return (a.time || '').localeCompare(b.time || '') || a.created_at.localeCompare(b.created_at)
    })
  },

  logBodyWeight(
    userId: string,
    input: { weight: number; date?: string; notes?: string; time?: string },
  ): BodyWeightLog {
    const date = input.date || todayKey()
    const time = input.time?.trim() || undefined
    const existing = liftApi.listBodyWeight(userId).find((w) => w.date === date)
    if (existing) {
      return (
        localDb.update<BodyWeightLog>(WEIGHT_LOGS, userId, existing.id, {
          weight: input.weight,
          notes: input.notes ?? existing.notes,
          time: time ?? existing.time,
        }) || existing
      )
    }
    const row = localDb.insert(WEIGHT_LOGS, userId, {
      id: createId(),
      user_id: userId,
      date,
      weight: input.weight,
      notes: input.notes || '',
      created_at: now(),
      time: time || '',
    })
    notifyCheckIn(`Logged weight — ${input.weight}`)
    return row
  },

  removeBodyWeight(userId: string, id: string): boolean {
    return localDb.remove(WEIGHT_LOGS, userId, id)
  },

  bodyWeightSeries(userId: string): { date: string; weight: number }[] {
    return liftApi.listBodyWeight(userId).map((w) => ({ date: w.date, weight: w.weight }))
  },

  weightGoalProgress(userId: string): {
    start: number | null
    current: number | null
    goal: number | null
    percent: number
    delta: number | null
  } {
    const entries = liftApi.listBodyWeight(userId)
    const active = liftApi.getActiveWeightGoal(userId)
    const plan = liftApi.getWeightGoalPlan(userId)
    const first = entries[0]
    const latest = entries[entries.length - 1]
    const start = plan ? plan.startWeight : first ? first.weight : active?.start_weight ?? null
    const current = plan
      ? (latestWeekWithAverage(plan)?.actual ?? latest?.weight ?? null)
      : (latest?.weight ?? null)
    const goal = active?.target_weight ?? null
    let percent = 0
    if (goal != null && start != null && current != null && goal !== start) {
      percent = clamp(((current - start) / (goal - start)) * 100, 0, 100)
    }
    return {
      start,
      current,
      goal,
      percent,
      delta: start != null && current != null ? current - start : null,
    }
  },

  getActiveWeightGoal(userId: string): WeightGoal | null {
    return liftApi.listWeightGoals(userId).find((g) => g.active) ?? null
  },

  listWeightGoals(userId: string): WeightGoal[] {
    return localDb.list<WeightGoal>(WEIGHT_GOALS, userId).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  setWeightGoal(
    userId: string,
    input: {
      mode: WeightGoalMode
      start_weight: number
      target_weight: number
      start_date?: string
      target_date?: string | null
    },
  ): WeightGoal {
    const ts = now()
    for (const g of liftApi.listWeightGoals(userId)) {
      if (g.active) localDb.update<WeightGoal>(WEIGHT_GOALS, userId, g.id, { active: false, updated_at: ts })
    }
    return localDb.insert(WEIGHT_GOALS, userId, {
      id: createId(),
      user_id: userId,
      mode: input.mode,
      start_weight: input.start_weight,
      target_weight: input.target_weight,
      start_date: input.start_date || todayKey(),
      target_date: input.target_date || null,
      active: true,
      created_at: ts,
      updated_at: ts,
    })
  },

  getWeightGoalPlan(userId: string): WeightGoalPlan | null {
    const entries = liftApi.listBodyWeight(userId)
    const goal = liftApi.getActiveWeightGoal(userId)
    const targetWeight = Number(goal?.target_weight)
    const targetDate = goal?.target_date || ''
    const startWeight = Number(goal?.start_weight) || Number(entries[0]?.weight)
    const startDate = goal?.start_date || entries[0]?.date || ''

    if (!goal || !targetWeight || !targetDate || !Number.isFinite(startWeight) || !startDate) return null
    if (targetDate < startDate) return null

    const elapsedDays = daysBetween(startDate, targetDate)
    if (elapsedDays <= 0) return null

    const weekCount = Math.max(1, Math.round(elapsedDays / 7))
    const totalChange = targetWeight - startWeight
    const weeklyChange = totalChange / weekCount
    const today = todayKey()
    const weeks: WeightGoalWeek[] = []

    for (let week = 1; week <= weekCount; week += 1) {
      const startOffset = (week - 1) * 7
      const weekStart = addDaysIso(startDate, startOffset)
      const naturalEnd = addDaysIso(startDate, startOffset + 6)
      const weekEnd = week === weekCount || naturalEnd > targetDate ? targetDate : naturalEnd
      const previousTarget =
        week === 1
          ? roundLb(startWeight)
          : roundLb(startWeight + (totalChange * (week - 1)) / weekCount)
      const target =
        week === weekCount
          ? roundLb(targetWeight)
          : roundLb(startWeight + (totalChange * week) / weekCount)
      const weekEntries = entries.filter((entry) => entry.date >= weekStart && entry.date <= weekEnd)
      const actual = weekEntries.length
        ? weekEntries.reduce((sum, entry) => sum + Number(entry.weight), 0) / weekEntries.length
        : null
      weeks.push({
        week,
        weekStart,
        weekEnd,
        targetWeight: target,
        change: roundLb(target - previousTarget),
        actual,
        checkInCount: weekEntries.length,
        isCurrent: today >= weekStart && today <= weekEnd,
        isPast: today > weekEnd,
        isFinal: week === weekCount,
      })
    }

    return {
      startWeight,
      startDate,
      targetWeight,
      targetDate,
      totalDays: elapsedDays,
      totalWeeks: weekCount,
      totalChange,
      weeklyChange,
      weeks,
    }
  },

  /** Clear lift-related collections only (keeps cardio/nutrition/sleep/water). */
  clearLiftData(userId: string): void {
    for (const s of liftApi.listSessions(userId)) liftApi.removeSession(userId, s.id)
    for (const split of liftApi.listSplits(userId)) localDb.remove(SPLITS, userId, split.id)
    for (const w of liftApi.listBodyWeight(userId)) localDb.remove(WEIGHT_LOGS, userId, w.id)
    for (const g of liftApi.listWeightGoals(userId)) localDb.remove(WEIGHT_GOALS, userId, g.id)
    for (const e of localDb.list<LiftExercise>(EXERCISES, userId)) localDb.remove(EXERCISES, userId, e.id)
  },

  loadDemoLiftData(userId: string): void {
    liftApi.clearLiftData(userId)
    liftApi.ensureDefaultExercises(userId)

    const bench = liftApi.findOrCreateExercise(userId, 'Bench Press')
    const squat = liftApi.findOrCreateExercise(userId, 'Squat')
    const row = liftApi.findOrCreateExercise(userId, 'Barbell Row')

    const days = [0, 3, 7, 10].map((offset) => {
      const d = new Date()
      d.setDate(d.getDate() - offset)
      return todayKey(d)
    })

    const loads = [205, 215, 225, 235]
    days.forEach((date, i) => {
      liftApi.logSession(userId, {
        date,
        title: i % 2 === 0 ? 'Push' : 'Pull',
        sets: [
          { exercise_id: bench.id, reps: 5, weight: loads[i] },
          { exercise_id: bench.id, reps: 5, weight: loads[i] },
          { exercise_id: bench.id, reps: 5, weight: loads[i] - 10 },
          ...(i % 2 === 0
            ? [
                { exercise_id: squat.id, reps: 5, weight: 185 + i * 5 },
                { exercise_id: squat.id, reps: 5, weight: 185 + i * 5 },
              ]
            : [
                { exercise_id: row.id, reps: 8, weight: 135 + i * 5 },
                { exercise_id: row.id, reps: 8, weight: 135 + i * 5 },
              ]),
        ],
      })
    })

    liftApi.saveSplit(userId, {
      name: 'Push / Pull / Legs',
      pattern: 'cycle',
      days: SPLIT_PRESETS[0].days,
      active: true,
    })

    const weights = [190, 188.5, 187.2, 186]
    days.forEach((date, i) => {
      liftApi.logBodyWeight(userId, { date, weight: weights[i] })
    })
    const first = weights[weights.length - 1]
    liftApi.setWeightGoal(userId, {
      mode: 'cut',
      start_weight: first,
      target_weight: 183,
      start_date: days[days.length - 1],
      target_date: todayKey(),
    })
  },
}
