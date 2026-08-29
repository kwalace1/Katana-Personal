import type { EventCategory } from './categories'

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
  category: EventCategory
  /** Optional hex override; otherwise category palette */
  color: string | null
  /** Where this event came from — local entries omit or use 'local' */
  source?: 'local' | 'google' | 'ics'
  /** Provider-stable id for imported events (dedupe on sync) */
  external_id?: string | null
  created_at: string
  updated_at: string
}

export type { EventCategory }
