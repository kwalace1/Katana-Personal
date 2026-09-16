export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'todo' | 'doing' | 'done'
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly'

export interface TaskList {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  list_id: string | null
  title: string
  notes: string
  priority: TaskPriority
  status: TaskStatus
  due_at: string | null
  /** When the task was marked done (editable). */
  completed_at: string | null
  recurrence: Recurrence
  category: string
  sort_order: number
  goal_id: string | null
  habit_id: string | null
  /** Where this task came from — local entries omit or use 'local' */
  source?: 'local' | 'google_tasks' | 'todoist'
  /** Provider-stable id for imported tasks (dedupe on sync) */
  external_id?: string | null
  created_at: string
  updated_at: string
}
