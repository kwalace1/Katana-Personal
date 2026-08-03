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
  recurrence: Recurrence
  category: string
  sort_order: number
  goal_id: string | null
  created_at: string
  updated_at: string
}
