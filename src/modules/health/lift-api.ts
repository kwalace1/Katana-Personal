import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import { todayKey } from '@/lib/dates'
import { notifyCheckIn } from '@/lib/social/streak-sync'
import { healthApi } from './api'
import type {
  BodyWeightLog,
  LiftExercise,
  LiftSession,
  LiftSet,
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

const DEFAULT_EXERCISES = [
  { name: 'Bench Press', muscle: 'Chest' },
  { name: 'Squat', muscle: 'Legs' },
  { name: 'Deadlift', muscle: 'Back' },
  { name: 'Overhead Press', muscle: 'Shoulders' },
  { name: 'Barbell Row', muscle: 'Back' },
  { name: 'Pull-Up', muscle: 'Back' },
  { name: 'Romanian Deadlift', muscle: 'Legs' },
  { name: 'Dumbbell Curl', muscle: 'Arms' },
]

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

export const liftApi = {
  ensureDefaultExercises(userId: string): void {
    if (localDb.list<LiftExercise>(EXERCISES, userId).length > 0) return
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
  },

  listExercises(userId: string): LiftExercise[] {
    liftApi.ensureDefaultExercises(userId)
    return localDb
      .list<LiftExercise>(EXERCISES, userId)
      .sort((a, b) => a.name.localeCompare(b.name))
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

  removeExercise(userId: string, id: string): boolean {
    const used = localDb.list<LiftSet>(SETS, userId).some((s) => s.exercise_id === id)
    if (used) return false
    return localDb.remove(EXERCISES, userId, id)
  },

  listSessions(userId: string): LiftSession[] {
    return localDb.list<LiftSession>(SESSIONS, userId).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
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

  /**
   * Create a lift session with sets. Also logs a cardio Workout row so Circles workout streak still works.
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

    notifyCheckIn(`Logged lift: ${session.title}`)
    return session
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

  /** Best (max) weight per calendar day for an exercise — for progress charts. */
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
    if (input.active !== false) {
      for (const s of liftApi.listSplits(userId)) {
        if (s.active) localDb.update<TrainingSplit>(SPLITS, userId, s.id, { active: false, updated_at: ts })
      }
    }
    if (input.id) {
      const updated = localDb.update<TrainingSplit>(SPLITS, userId, input.id, {
        name: input.name.trim(),
        pattern: input.pattern,
        days: input.days,
        active: input.active !== false,
        updated_at: ts,
      })
      if (updated) return updated
    }
    return localDb.insert(SPLITS, userId, {
      id: createId(),
      user_id: userId,
      name: input.name.trim(),
      pattern: input.pattern,
      days: input.days,
      active: input.active !== false,
      created_at: ts,
      updated_at: ts,
    })
  },

  removeSplit(userId: string, id: string): boolean {
    return localDb.remove(SPLITS, userId, id)
  },

  setActiveSplit(userId: string, id: string): void {
    const ts = now()
    for (const s of liftApi.listSplits(userId)) {
      localDb.update<TrainingSplit>(SPLITS, userId, s.id, { active: s.id === id, updated_at: ts })
    }
  },

  /** What’s on for a given date based on the active split. */
  plannedDay(userId: string, date = todayKey()): { split: TrainingSplit; day: SplitDay; index: number } | null {
    const active = liftApi.listSplits(userId).find((s) => s.active)
    if (!active || active.days.length === 0) return null
    const d = new Date(date + 'T12:00:00')
    let index = 0
    if (active.pattern === 'weekdays') {
      index = d.getDay() % active.days.length
    } else {
      // Cycle from split created_at
      const start = new Date(active.created_at)
      start.setHours(12, 0, 0, 0)
      const diff = Math.floor((d.getTime() - start.getTime()) / 86_400_000)
      index = ((diff % active.days.length) + active.days.length) % active.days.length
    }
    return { split: active, day: active.days[index], index }
  },

  listBodyWeight(userId: string): BodyWeightLog[] {
    return localDb.list<BodyWeightLog>(WEIGHT_LOGS, userId).sort((a, b) => a.date.localeCompare(b.date))
  },

  logBodyWeight(
    userId: string,
    input: { weight: number; date?: string; notes?: string },
  ): BodyWeightLog {
    const date = input.date || todayKey()
    const existing = liftApi.listBodyWeight(userId).find((w) => w.date === date)
    if (existing) {
      return (
        localDb.update<BodyWeightLog>(WEIGHT_LOGS, userId, existing.id, {
          weight: input.weight,
          notes: input.notes ?? existing.notes,
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

  getActiveWeightGoal(userId: string): WeightGoal | null {
    return liftApi.listWeightGoals(userId).find((g) => g.active) ?? null
  },

  listWeightGoals(userId: string): WeightGoal[] {
    return localDb.list<WeightGoal>(WEIGHT_GOALS, userId).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  setWeightGoal(
    userId: string,
    input: { mode: WeightGoalMode; start_weight: number; target_weight: number; start_date?: string },
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
      active: true,
      created_at: ts,
      updated_at: ts,
    })
  },
}
