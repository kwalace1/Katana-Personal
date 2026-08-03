export interface Subtask {
  id: string
  title: string
  completed: boolean
  /** Who marked this subtask complete */
  completedBy?: string
  /** ISO timestamp when the subtask was marked complete */
  completedAt?: string
}

/** Apply completion attribution when subtasks are toggled or saved. */
export function enrichSubtaskUpdates(
  beforeSubtasks: Subtask[],
  afterSubtasks: Subtask[],
  completedBy: string
): Subtask[] {
  const beforeById = new Map(beforeSubtasks.map((s) => [s.id, s]))
  return afterSubtasks.map((sub) => {
    const prev = beforeById.get(sub.id)
    if (prev && !prev.completed && sub.completed) {
      return {
        ...sub,
        completedBy,
        completedAt: new Date().toISOString(),
      }
    }
    if (!sub.completed) {
      const { completedBy: _by, completedAt: _at, ...rest } = sub
      return { ...rest, completed: false }
    }
    return {
      ...sub,
      completedBy: sub.completedBy ?? prev?.completedBy,
      completedAt: sub.completedAt ?? prev?.completedAt,
    }
  })
}

/** Short label for who completed a subtask (task detail + activity feed). */
export function formatSubtaskCompletionMeta(subtask: Subtask): string | null {
  if (!subtask.completed || !subtask.completedBy?.trim()) return null
  return `Completed by ${subtask.completedBy.trim()}`
}

export interface TaskAssigneeRef {
  employeeId?: string | null
  name: string
  avatar: string
}

export interface Task {
  id: string
  title: string
  status: "backlog" | "todo" | "in-progress" | "review" | "blocked" | "done"
  priority: "low" | "medium" | "high"
  assignee: {
    name: string
    avatar: string
  }
  /** When set, matches public.tasks.assignee_employee_id — primary assignee for legacy queries */
  assigneeEmployeeId?: string | null
  /** All people assigned to this task (stored in tasks.assignees jsonb) */
  assignees?: TaskAssigneeRef[]
  startDate?: string
  deadline: string
  progress: number
  description?: string
  milestoneId?: string
  subtasks?: Subtask[]
  /** Set when loaded via Supabase layer — past deadline and not done */
  isOverdue?: boolean
  /** e.g. "2 days overdue", "Due tomorrow" */
  dueDateLabel?: string
}

/** When task has subtasks, progress = (completed / total) * 100; else 0 or 100 from status */
export function getTaskProgressFromSubtasks(task: Task): number {
  const subs = task.subtasks
  if (subs && subs.length > 0) {
    const completed = subs.filter((s) => s.completed).length
    return Math.round((completed / subs.length) * 100)
  }
  return task.status === 'done' ? 100 : 0
}

/** True if task can be marked done: no subtasks or all subtasks completed */
export function canMarkTaskDone(task: Task): boolean {
  const subs = task.subtasks
  if (!subs || subs.length === 0) return true
  return subs.every((s) => s.completed)
}

/** Progress to display: only when task has subtasks (subtask %) or is done (100%). Otherwise null = don't show %. */
export function getTaskDisplayProgress(task: Task): number | null {
  const subs = task.subtasks
  if (subs && subs.length > 0) {
    const completed = subs.filter((s) => s.completed).length
    return Math.round((completed / subs.length) * 100)
  }
  if (task.status === 'done' || task.progress === 100) return 100
  return null
}

export interface Milestone {
  id: string
  name: string
  date: string
  status: "completed" | "in-progress" | "upcoming"
  description?: string
  taskIds?: string[]
}

export interface Sprint {
  id: string
  name: string
  goal: string
  startDate: string
  endDate: string
  status: "planned" | "active" | "completed"
  taskIds: string[]
}

export interface Project {
  id: string
  name: string
  status: "active" | "completed" | "on-hold"
  progress: number
  deadline: string
  tasks: Task[]
  totalTasks: number
  completedTasks: number
  team: TeamMember[]
  files: ProjectFile[]
  activities: Activity[]
  milestones?: Milestone[]
  sprints?: Sprint[]
  starred?: boolean
  description?: string
  /** Who created the project */
  createdBy?: { name: string; avatar: string; hrEmployeeId?: string | null }
  /** Project owner / person assigned to the project */
  owner?: { name: string; avatar: string; hrEmployeeId?: string | null }
  /** When the project was created */
  createdAt?: string
}

export interface TeamMember {
  id: string
  name: string
  role: string
  avatar: string
  capacity: number
  /** public.team_members.hr_employee_id — links roster entry to HR for PM sync */
  hrEmployeeId?: string | null
}

export interface ProjectFile {
  id: string
  name: string
  type: string
  uploadedBy: string
  uploadedAt: string
  size: string
  url?: string // URL to the file in Supabase Storage
}

export interface Activity {
  id: string
  type: string
  description: string
  user: string
  timestamp: string
}

// Mock data for demonstration
export const mockProjects: Project[] = [
  // Empty array - add your own projects!
]

export function getProjectById(id: string): Project | undefined {
  return mockProjects.find((p) => p.id === id)
}

export function getOverdueTasks(): number {
  const today = new Date()
  let count = 0
  mockProjects.forEach((project) => {
    project.tasks.forEach((task) => {
      if (task.status !== "done" && new Date(task.deadline) < today) {
        count++
      }
    })
  })
  return count
}

export function getUpcomingDeadlines(): number {
  const today = new Date()
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  let count = 0
  mockProjects.forEach((project) => {
    project.tasks.forEach((task) => {
      const deadline = new Date(task.deadline)
      if (task.status !== "done" && deadline >= today && deadline <= nextWeek) {
        count++
      }
    })
  })
  return count
}

export function updateTaskStatus(projectId: string, taskId: string, newStatus: Task["status"]): void {
  const project = mockProjects.find(p => p.id === projectId)
  if (!project) return
  
  const task = project.tasks.find(t => t.id === taskId)
  if (!task) return
  
  task.status = newStatus
  task.progress = newStatus === 'done' ? 100 : 0
  
  // Dispatch custom event to notify other components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
}

export function deleteTask(projectId: string, taskId: string): void {
  const project = mockProjects.find(p => p.id === projectId)
  if (!project) return
  
  const taskIndex = project.tasks.findIndex(t => t.id === taskId)
  if (taskIndex === -1) return
  
  project.tasks.splice(taskIndex, 1)
  
  // Update project counts
  project.totalTasks = project.tasks.length
  project.completedTasks = project.tasks.filter(t => t.status === 'done').length
  
  // Dispatch custom event to notify other components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
}

export function getProjectTeamMembers(projectId: string): TeamMember[] {
  const project = mockProjects.find(p => p.id === projectId)
  return project?.team || []
}

export function updateTask(projectId: string, taskId: string, updates: Partial<Task>): void {
  const project = mockProjects.find(p => p.id === projectId)
  if (!project) return
  
  const task = project.tasks.find(t => t.id === taskId)
  if (!task) return
  
  const merged = { ...task, ...updates } as Task
  if (updates.status === 'done' && !canMarkTaskDone(merged)) {
    throw new Error('Complete all subtasks before marking this task as done.')
  }
  const applied = { ...updates }
  if (merged.subtasks && merged.subtasks.length > 0) {
    applied.progress = getTaskProgressFromSubtasks(merged)
  } else if (updates.status !== undefined) {
    applied.progress = updates.status === 'done' ? 100 : 0
  }
  Object.assign(task, applied)
  
  // Dispatch custom event to notify other components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
}

export function addTask(projectId: string, taskData: Omit<Task, 'id'>): Task | null {
  console.log("[addTask] Adding task to project:", projectId, taskData)
  
  const project = mockProjects.find(p => p.id === projectId)
  if (!project) {
    console.log("[addTask] Project not found:", projectId)
    return null
  }
  
  // Generate new task ID
  const maxId = project.tasks.reduce((max, task) => {
    const taskNum = parseInt(task.id.replace(/\D/g, ''))
    return taskNum > max ? taskNum : max
  }, 0)
  
  const newTask: Task = {
    ...taskData,
    id: `t${maxId + 1}`,
  }
  
  console.log("[addTask] Generated new task:", newTask)
  
  project.tasks.push(newTask)
  
  // Update project counts
  project.totalTasks = project.tasks.length
  project.completedTasks = project.tasks.filter(t => t.status === 'done').length
  
  console.log("[addTask] Project now has", project.tasks.length, "tasks")
  
  // Dispatch custom event to notify other components
  if (typeof window !== 'undefined') {
    console.log("[addTask] Dispatching projectDataUpdated event for project:", projectId)
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
  
  return newTask
}

export function getProjectWithProgress(project: Project): Project {
  // Calculate progress based on completed tasks
  const completedTasks = project.tasks.filter(t => t.status === 'done').length
  const totalTasks = project.tasks.length
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  
  return {
    ...project,
    progress,
    totalTasks,
    completedTasks,
  }
}

export function reorderTasks(projectId: string, taskId: string, newIndex: number): void {
  const project = mockProjects.find(p => p.id === projectId)
  if (!project) return
  
  const taskIndex = project.tasks.findIndex(t => t.id === taskId)
  if (taskIndex === -1) return
  
  // Remove task from current position
  const [task] = project.tasks.splice(taskIndex, 1)
  
  // Insert at new position
  project.tasks.splice(newIndex, 0, task)
  
  console.log('[reorderTasks] Reordered task:', taskId, 'to index:', newIndex)
  
  // Dispatch custom event to notify other components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
}