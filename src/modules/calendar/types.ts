export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  notes: string
  starts_at: string
  ends_at: string
  all_day: boolean
  location: string
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  reminder_minutes: number | null
  created_at: string
  updated_at: string
}
