export type Mood = 'great' | 'good' | 'okay' | 'low' | 'rough'

export interface JournalEntry {
  id: string
  user_id: string
  date: string
  mood: Mood
  body: string
  reflection: string
  created_at: string
  updated_at: string
}
