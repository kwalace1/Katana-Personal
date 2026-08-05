export interface Workout {
  id: string
  user_id: string
  date: string
  activity: string
  /** Total minutes (used for Circles / series). May be fractional when seconds are logged. */
  duration_minutes: number
  notes: string
  created_at: string
  /** When set, this cardio row is linked to a lift session (streak compatibility). */
  lift_session_id?: string | null
  /** Precise duration parts from cardio logger (tracker parity). */
  duration_hours?: number
  duration_mins?: number
  duration_secs?: number
}

export interface WaterLog {
  id: string
  user_id: string
  date: string
  glasses: number
  updated_at: string
}

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface NutritionLog {
  id: string
  user_id: string
  date: string
  meal: string
  calories: number
  notes: string
  created_at: string
  category?: MealCategory
  /** Local time HH:MM */
  time?: string
  protein?: number
  carbs?: number
  fat?: number
}

export interface SleepLog {
  id: string
  user_id: string
  date: string
  hours: number
  quality: 'poor' | 'fair' | 'good' | 'great'
  notes: string
  created_at: string
}

/** User exercise library for lift tracking */
export interface LiftExercise {
  id: string
  user_id: string
  name: string
  muscle: string
  created_at: string
}

export interface LiftSession {
  id: string
  user_id: string
  date: string
  title: string
  notes: string
  created_at: string
}

export interface LiftSet {
  id: string
  user_id: string
  session_id: string
  exercise_id: string
  set_index: number
  reps: number
  weight: number
  created_at: string
}

export type SplitPattern = 'cycle' | 'weekdays'

export interface SplitDay {
  name: string
  /** Optional suggested exercise names */
  focus: string
}

export interface TrainingSplit {
  id: string
  user_id: string
  name: string
  pattern: SplitPattern
  /** cycle: ordered days repeating; weekdays: index 0=Sun … 6=Sat */
  days: SplitDay[]
  active: boolean
  created_at: string
  updated_at: string
}

export interface BodyWeightLog {
  id: string
  user_id: string
  date: string
  weight: number
  notes: string
  created_at: string
}

export type WeightGoalMode = 'bulk' | 'cut' | 'maintain'

export interface WeightGoal {
  id: string
  user_id: string
  mode: WeightGoalMode
  start_weight: number
  target_weight: number
  start_date: string
  /** Optional target date for the goal (YYYY-MM-DD). */
  target_date?: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type LiftProgressMetric = 'topWeight' | 'estimated1RM' | 'volume'

export interface LiftProgressPoint {
  date: string
  workoutName: string
  session_id: string
  value: number
  sets: number
  setSummary: string
}

/** Nested draft shape used when logging a multi-exercise workout (tracker parity). */
export interface LiftWorkoutDraftExercise {
  name: string
  sets: { weight: number; reps: number }[]
}
