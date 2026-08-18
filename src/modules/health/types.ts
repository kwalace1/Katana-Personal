export interface GeoPoint {
  lat: number
  lng: number
  /** Unix ms */
  t: number
}

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
  /** Optional calories burned from cardio log. */
  calories?: number
  /** GPS track from an in-app run (Strava-style). */
  path?: GeoPoint[]
  /** Distance in meters when a GPS path was recorded. */
  distance_m?: number
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
  /** Local HH:MM when you got in bed */
  bedtime?: string
  /** Local HH:MM when you woke */
  wake?: string
  source?: 'manual' | 'apple_health' | 'fitbit'
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
  /** Optional pre-made workout prescription for this day. */
  exercises?: {
    name: string
    sets: number
    reps: string
  }[]
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
  /** Local time HH:MM */
  time?: string
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

export type SupplementTimeOfDay = 'morning' | 'afternoon' | 'evening'

/** Reusable vitamins / supplements catalog */
export interface SupplementItem {
  id: string
  user_id: string
  name: string
  dose_notes: string
  sort_order: number
  archived: boolean
  /** Older rows without a kind are treated as supplements. */
  kind?: 'vitamin' | 'supplement'
  /** When you usually take it. Older rows default to morning. */
  time_of_day?: SupplementTimeOfDay
  created_at: string
}

/** Daily taken check — one row per item + date */
export interface SupplementLog {
  id: string
  user_id: string
  item_id: string
  date: string
  taken: boolean
  dose_notes: string
  updated_at: string
}

export type SupplementChecklistRow = {
  item: SupplementItem
  log: SupplementLog | null
  taken: boolean
  doseNotes: string
}
