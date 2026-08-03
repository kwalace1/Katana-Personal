export interface Habit {
  id: string
  user_id: string
  title: string
  schedule: 'daily' | 'weekdays' | 'weekends'
  reminder_time: string | null
  created_at: string
  updated_at: string
}

export interface HabitLog {
  id: string
  user_id: string
  habit_id: string
  date: string
  completed: boolean
  created_at: string
}
