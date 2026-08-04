export type GoalHorizon = 'annual' | 'quarterly' | 'monthly' | 'daily'

export interface Goal {
  id: string
  user_id: string
  title: string
  description: string
  horizon: GoalHorizon
  target: number
  progress: number
  parent_id: string | null
  /** ISO date (YYYY-MM-DD) or datetime — shows on Calendar when set */
  target_date: string | null
  created_at: string
  updated_at: string
}
