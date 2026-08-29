/** Server-side integration types (kept out of src/ for Vercel bundling). */
export interface ExternalCalendarEvent {
  external_id: string
  title: string
  notes: string
  starts_at: string
  ends_at: string
  all_day: boolean
  location: string
}
