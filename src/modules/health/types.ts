export interface Workout {
  id: string
  user_id: string
  date: string
  activity: string
  duration_minutes: number
  notes: string
  created_at: string
}

export interface WaterLog {
  id: string
  user_id: string
  date: string
  glasses: number
  updated_at: string
}

export interface NutritionLog {
  id: string
  user_id: string
  date: string
  meal: string
  calories: number
  notes: string
  created_at: string
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
