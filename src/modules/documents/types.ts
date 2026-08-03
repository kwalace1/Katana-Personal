export interface DocumentRecord {
  id: string
  user_id: string
  name: string
  mime_type: string
  size: number
  /** Local data URL or remote storage path */
  data_url: string
  created_at: string
  updated_at: string
}
