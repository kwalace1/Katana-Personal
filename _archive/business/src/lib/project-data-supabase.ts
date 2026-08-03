/**
 * Supabase-powered Project Data Layer
 * This replaces the mock data with real database operations
 */

import * as api from './supabase-api'
import type { Project, Task, Milestone, TeamMember } from './project-data'
import { getTaskProgressFromSubtasks, canMarkTaskDone, enrichSubtaskUpdates } from './project-data'
import { getSubtasksCache, setSubtasksCache, getTaskWithCachedSubtasks } from './subtasks-cache'

export { getTaskWithCachedSubtasks, getTaskDisplayProgressWithCache } from './subtasks-cache'

// Configuration flag - set to true to use Supabase, false for mock data
const USE_SUPABASE = import.meta.env.VITE_SUPABASE_URL ? true : false

// Cache for projects data
let projectsCache: Project[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 5000 // 5 seconds

// ==================== PUBLIC API ====================

export async function getAllProjects(): Promise<Project[]> {
  if (!USE_SUPABASE) {
    return []
  }

  // Check cache
  const now = Date.now()
  if (projectsCache && now - cacheTimestamp < CACHE_DURATION) {
    return projectsCache
  }

  const projects = await api.getAllProjects()
  
  // Calculate progress for all projects dynamically
  const projectsWithProgress = await Promise.all(
    projects.map(project => getProjectWithProgress(project))
  )
  
  projectsCache = projectsWithProgress
  cacheTimestamp = now
  
  return projectsWithProgress
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  if (!USE_SUPABASE) {
    return undefined
  }

  const project = await api.getProjectById(id)
  if (!project) return undefined
  
  // Calculate progress dynamically
  return await getProjectWithProgress(project)
}

/** Projects and tasks assigned to a person (HR employee id and/or legacy display name). For Employee Portal "My Projects". */
export async function getProjectsAndTasksAssignedTo(
  assigneeName: string,
  employeeId?: string | null
): Promise<{ projectId: string; projectName: string; tasks: Task[] }[]> {
  if (!USE_SUPABASE) return []
  return api.getProjectsAndTasksAssignedTo(assigneeName, employeeId)
}

export async function createProject(projectData: {
  name: string
  status: 'active' | 'completed' | 'on-hold'
  deadline: string
  createdBy?: { name: string; avatar: string }
  owner?: { name: string; avatar: string }
}): Promise<string | null> {
  if (!USE_SUPABASE) {
    // For mock data, handle in the calling component
    return null
  }

  const projectId = await api.createProject({
    name: projectData.name,
    status: projectData.status,
    progress: 0,
    deadline: projectData.deadline,
    totalTasks: 0,
    completedTasks: 0,
    starred: false,
    createdBy: projectData.createdBy,
    owner: projectData.owner,
  })

  // Clear cache to force refresh
  projectsCache = null

  return projectId
}

export async function updateProject(projectId: string, updates: Partial<Project>): Promise<boolean> {
  if (!USE_SUPABASE) return false
  const success = await api.updateProject(projectId, updates)
  if (success) {
    projectsCache = null
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
    }
  }
  return success
}

export async function deleteProject(projectId: string): Promise<boolean> {
  if (!USE_SUPABASE) {
    // For mock data, handle in the calling component
    return false
  }

  const success = await api.deleteProject(projectId)

  // Clear cache to force refresh
  projectsCache = null

  // Emit event to refresh project lists
  window.dispatchEvent(new CustomEvent('projectDataUpdated', { 
    detail: { projectId } 
  }))

  return success
}

export async function updateTaskStatus(
  projectId: string,
  taskId: string,
  newStatus: Task['status'],
  /** When provided, use for validation and to preserve subtasks (avoids losing them if server is stale) */
  clientTask?: Task
): Promise<void> {
  const cachedSubtasks = getSubtasksCache(taskId)
  const taskWithSubtasksForValidation: Task = clientTask?.id === taskId
    ? { ...clientTask, id: taskId, subtasks: cachedSubtasks ?? clientTask.subtasks ?? [] }
    : { id: taskId, title: '', status: newStatus, priority: 'medium', assignee: { name: '', avatar: '' }, deadline: '', progress: 0, subtasks: cachedSubtasks ?? [] }
  const mergedForValidation: Task = { ...taskWithSubtasksForValidation, status: newStatus }
  if (newStatus === 'done' && !canMarkTaskDone(mergedForValidation)) {
    throw new Error('Complete all subtasks before marking this task as done.')
  }

  if (!USE_SUPABASE) {
    const { updateTaskStatus: mockUpdate } = await import('./project-data')
    return mockUpdate(projectId, taskId, newStatus)
  }

  const project = await api.getProjectById(projectId)
  const serverTask = project?.tasks.find((t) => t.id === taskId)
  const baseTask = serverTask ?? (clientTask?.id === taskId ? clientTask : undefined)
  const subtasksForTask = cachedSubtasks ?? baseTask?.subtasks ?? []
  const mergedForPayload: Task = baseTask
    ? { ...baseTask, id: taskId, subtasks: subtasksForTask }
    : { id: taskId, title: '', status: newStatus, priority: 'medium', assignee: { name: '', avatar: '' }, deadline: '', progress: 0, subtasks: cachedSubtasks ?? [] }
  const progress = getTaskProgressFromSubtasks({ ...mergedForPayload, status: newStatus })
  const payload: Partial<Task> = { status: newStatus, progress }
  if (subtasksForTask.length > 0) {
    payload.subtasks = subtasksForTask
  }
  const saved = await api.updateTask(taskId, payload)
  if (!saved) {
    throw new Error('Failed to save task status — please try again.')
  }

  const taskForNotify = baseTask ?? clientTask
  if (taskForNotify && newStatus === 'done') {
    const { notifyPmTaskCompleted } = await import('@/lib/notification-modules')
    void notifyPmTaskCompleted({
      projectId,
      taskId,
      taskTitle: taskForNotify.title,
      assigneeEmployeeId: taskForNotify.assigneeEmployeeId,
    })
  } else if (taskForNotify) {
    const { notifyPmTaskStatusChange } = await import('@/lib/notification-modules')
    void notifyPmTaskStatusChange({
      projectId,
      taskId,
      taskTitle: taskForNotify.title,
      assigneeEmployeeId: taskForNotify.assigneeEmployeeId,
      newStatus,
    })
  }

  projectsCache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  if (!USE_SUPABASE) {
    const { deleteTask: mockDelete } = await import('./project-data')
    return mockDelete(projectId, taskId)
  }

  // Get task info before deleting
  const project = await api.getProjectById(projectId)
  const task = project?.tasks.find((t) => t.id === taskId)
  
  await api.deleteTask(taskId)
  
  // Log activity
  if (task) {
    await api.addActivity(projectId, {
      type: 'task_deleted',
      description: `Deleted task "${task.title}"`,
      user: 'You',
      timestamp: 'Just now',
    })
  }
  
  // Clear cache and dispatch event
  projectsCache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
}

export async function getProjectTeamMembers(projectId: string): Promise<TeamMember[]> {
  if (!USE_SUPABASE) {
    const { getProjectTeamMembers: mockGet } = await import('./project-data')
    return mockGet(projectId)
  }

  return api.getProjectTeam(projectId)
}

export async function updateTask(projectId: string, taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const subtasksTouched = updates.subtasks !== undefined
  const subtasksBeforeThisUpdate = subtasksTouched ? getSubtasksCache(taskId) : null

  if (!USE_SUPABASE) {
    if (updates.subtasks != null) {
      const { getProjectById: mockGetProjectById } = await import('./project-data')
      const mockProject = mockGetProjectById(projectId)
      const mockTask = mockProject?.tasks.find((t) => t.id === taskId)
      const beforeSubtasks = subtasksBeforeThisUpdate ?? mockTask?.subtasks ?? []
      const enriched = enrichSubtaskUpdates(beforeSubtasks, updates.subtasks, 'You')
      updates = { ...updates, subtasks: enriched }
      setSubtasksCache(taskId, enriched)
    }
    const { updateTask: mockUpdate, getProjectById: mockGetProjectById } = await import('./project-data')
    mockUpdate(projectId, taskId, updates)
    return mockGetProjectById(projectId)?.tasks.find((t) => t.id === taskId) ?? null
  }

  const assigneeTouched =
    updates.assigneeEmployeeId !== undefined ||
    updates.assignee !== undefined ||
    updates.assignees !== undefined
  const priorityTouched = updates.priority !== undefined

  let taskBefore: Task | undefined
  if (assigneeTouched || subtasksTouched || priorityTouched || updates.status !== undefined) {
    const projectBefore = await api.getProjectById(projectId)
    const current = projectBefore?.tasks.find((t) => t.id === taskId)
    if (current) {
      taskBefore = {
        ...current,
        subtasks: subtasksTouched
          ? (subtasksBeforeThisUpdate ?? current.subtasks ?? [])
          : (current.subtasks ?? getSubtasksCache(taskId) ?? []),
      }
    }
  }
  let taskBeforeAssignee: Task | undefined
  if (assigneeTouched) {
    taskBeforeAssignee = taskBefore
  }

  // Progress: from subtasks when task has any, else from status (done = 100%, else 0%)
  const applied: Partial<Task> = { ...updates }
  delete applied.progress

  if (updates.subtasks !== undefined) {
    const beforeSubtasks = taskBefore?.subtasks ?? subtasksBeforeThisUpdate ?? []
    let actorName = 'You'
    try {
      const { getCurrentUserDisplayName } = await import('@/lib/auth-helpers')
      actorName = await getCurrentUserDisplayName()
    } catch {
      // keep fallback
    }
    applied.subtasks = enrichSubtaskUpdates(beforeSubtasks, updates.subtasks, actorName)
    setSubtasksCache(taskId, applied.subtasks)
  }

  const needProgress = updates.status !== undefined || updates.subtasks !== undefined
  if (needProgress) {
    const project = await api.getProjectById(projectId)
    const current = project?.tasks.find((t) => t.id === taskId)
    const merged: Task = {
      ...current,
      ...updates,
      id: taskId,
      subtasks: applied.subtasks ?? updates.subtasks ?? current?.subtasks,
    } as Task
    if (updates.status === 'done' && !canMarkTaskDone(merged)) {
      throw new Error('Complete all subtasks before marking this task as done.')
    }
    if (merged.subtasks && merged.subtasks.length > 0) {
      applied.progress = getTaskProgressFromSubtasks(merged)
    } else if (updates.status !== undefined) {
      applied.progress = updates.status === 'done' ? 100 : 0
    }
  }

  const savedTask = await api.updateTask(taskId, applied)

  const projectAfter = await api.getProjectById(projectId)
  const taskAfter =
    projectAfter?.tasks.find((t) => t.id === taskId) ??
    (savedTask ? { ...savedTask, subtasks: applied.subtasks ?? savedTask.subtasks } : undefined)
  const projectName = projectAfter?.name ?? 'Project'

  // Log activity for status changes
  if (applied.status === 'done') {
    if (taskAfter) {
      await api.addActivity(projectId, {
        type: 'task_completed',
        description: `Completed task "${taskAfter.title}"`,
        user: 'You',
        timestamp: 'Just now',
      })
      const { notifyPmTaskCompleted, notifyPmTaskCompletedForTeam } = await import('@/lib/notification-modules')
      void notifyPmTaskCompleted({
        projectId,
        taskId,
        taskTitle: taskAfter.title,
        assigneeEmployeeId: taskAfter.assigneeEmployeeId,
        assigneeName: taskAfter.assignee?.name,
      })
      void notifyPmTaskCompletedForTeam({
        projectId,
        projectName,
        taskId,
        taskTitle: taskAfter.title,
        assigneeEmployeeId: taskAfter.assigneeEmployeeId,
        assigneeName: taskAfter.assignee?.name,
      })
    }
  }

  if (
    taskAfter &&
    taskBefore &&
    updates.status !== undefined &&
    updates.status !== 'done' &&
    taskBefore.status !== taskAfter.status
  ) {
    await api.addActivity(projectId, {
      type: 'task_status_changed',
      description: `Moved "${taskAfter.title}" to ${taskAfter.status.replace(/-/g, ' ')}`,
      user: 'You',
      timestamp: 'Just now',
    })
  }

  if (
    taskAfter &&
    taskBefore &&
    priorityTouched &&
    taskBefore.priority !== taskAfter.priority
  ) {
    await api.addActivity(projectId, {
      type: 'task_priority_changed',
      description: `Changed "${taskAfter.title}" priority to ${taskAfter.priority}`,
      user: 'You',
      timestamp: 'Just now',
    })
    const { notifyPmTaskPriorityChanged } = await import('@/lib/notification-modules')
    void notifyPmTaskPriorityChanged({
      projectId,
      taskId,
      taskTitle: taskAfter.title,
      newPriority: taskAfter.priority,
      assigneeEmployeeId: taskAfter.assigneeEmployeeId,
      assigneeName: taskAfter.assignee?.name,
    })
  }

  if (taskAfter && taskBeforeAssignee && assigneeTouched) {
    const { assigneeChanged, notifyPmTaskReassigned } = await import('@/lib/notification-modules')
    if (assigneeChanged(taskBeforeAssignee, taskAfter)) {
      void notifyPmTaskReassigned({
        projectId,
        taskId,
        taskTitle: taskAfter.title,
        assigneeEmployeeId: taskAfter.assigneeEmployeeId,
        assigneeName: taskAfter.assignee?.name,
      })
    }
  }

  if (taskAfter && updates.status !== undefined && updates.status !== 'done') {
    const { notifyPmTaskStatusChange } = await import('@/lib/notification-modules')
    void notifyPmTaskStatusChange({
      projectId,
      taskId,
      taskTitle: taskAfter.title,
      assigneeEmployeeId: taskAfter.assigneeEmployeeId,
      assigneeName: taskAfter.assignee?.name,
      newStatus: taskAfter.status,
    })
  }

  if (taskAfter && updates.subtasks !== undefined) {
    const beforeSubtasks = taskBefore?.subtasks ?? []
    const afterSubtasks = updates.subtasks
    const beforeById = new Map(beforeSubtasks.map((s) => [s.id, s]))

    const {
      notifyPmSubtasksUpdated,
      notifyPmSubtaskCreated,
      notifyPmSubtaskCompleted,
    } = await import('@/lib/notification-modules')

    let actorName = 'You'
    try {
      const { getCurrentUserDisplayName } = await import('@/lib/auth-helpers')
      actorName = await getCurrentUserDisplayName()
    } catch {
      // keep fallback
    }

    for (const sub of afterSubtasks) {
      const title = sub.title.trim()
      if (!title) continue
      const prev = beforeById.get(sub.id)
      if (!prev) {
        await api.addActivity(projectId, {
          type: 'subtask_created',
          description: `added subtask "${title}" to "${taskAfter.title}"`,
          user: actorName,
          timestamp: 'Just now',
        })
        void notifyPmSubtaskCreated({
          projectId,
          projectName,
          taskId,
          taskTitle: taskAfter.title,
          subtaskTitle: title,
          assigneeEmployeeId: taskAfter.assigneeEmployeeId,
          assigneeName: taskAfter.assignee?.name,
        })
      } else if (!prev.completed && sub.completed) {
        await api.addActivity(projectId, {
          type: 'subtask_completed',
          description: `completed subtask "${title}" on "${taskAfter.title}"`,
          user: actorName,
          timestamp: 'Just now',
        })
        void notifyPmSubtaskCompleted({
          projectId,
          projectName,
          taskId,
          taskTitle: taskAfter.title,
          subtaskTitle: title,
          subtaskId: sub.id,
          actorName,
          assigneeEmployeeId: taskAfter.assigneeEmployeeId,
          assigneeName: taskAfter.assignee?.name,
        })
      }
    }

    if (afterSubtasks.length > 0) {
      const completedCount = afterSubtasks.filter((s) => s.completed).length
      void notifyPmSubtasksUpdated({
        projectId,
        taskId,
        taskTitle: taskAfter.title,
        assigneeEmployeeId: taskAfter.assigneeEmployeeId,
        assigneeName: taskAfter.assignee?.name,
        completedCount,
        totalCount: afterSubtasks.length,
      })
    }
  }
  
  // Clear cache and dispatch event
  projectsCache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }

  return taskAfter ?? savedTask ?? null
}

export async function addTask(projectId: string, taskData: Omit<Task, 'id'>): Promise<Task | null> {
  if (!USE_SUPABASE) {
    const { addTask: mockAdd } = await import('./project-data')
    const result = mockAdd(projectId, taskData)
    if (result?.id && taskData.subtasks?.length) {
      setSubtasksCache(result.id, taskData.subtasks)
    }
    return result
  }

  const progress = taskData.subtasks?.length
    ? getTaskProgressFromSubtasks({ ...taskData, id: '' } as Task)
    : (taskData.progress ?? 0)
  const toCreate = { ...taskData, progress }
  const taskId = await api.createTask(projectId, toCreate)
  if (!taskId) return null
  if (taskData.subtasks?.length) {
    setSubtasksCache(taskId, taskData.subtasks)
  }

  // Log activity
  await api.addActivity(projectId, {
    type: 'task_created',
    description: `Created task "${taskData.title}"`,
    user: 'You',
    timestamp: 'Just now',
  })

  // Clear cache and dispatch event
  projectsCache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }

  // Return the created task
  const project = await api.getProjectById(projectId)
  const created = project?.tasks.find((t) => t.id === taskId) || null
  if (created) {
    const { notifyPmTaskAssigned, notifyPmNewTaskOnProject } = await import('@/lib/notification-modules')
    const { getTaskAssignees } = await import('@/lib/task-assignees')
    for (const person of getTaskAssignees(created)) {
      void notifyPmTaskAssigned({
        projectId,
        taskId,
        taskTitle: created.title,
        assigneeEmployeeId: person.employeeId,
        assigneeName: person.name,
      })
    }
    void notifyPmNewTaskOnProject({
      projectId,
      projectName: project?.name ?? 'Project',
      taskId,
      taskTitle: created.title,
    })

    if (created.subtasks?.length) {
      for (const sub of created.subtasks) {
        const title = sub.title.trim()
        if (!title) continue
        await api.addActivity(projectId, {
          type: 'subtask_created',
          description: `Added subtask "${title}" to "${created.title}"`,
          user: 'You',
          timestamp: 'Just now',
        })
        const { notifyPmSubtaskCreated } = await import('@/lib/notification-modules')
        void notifyPmSubtaskCreated({
          projectId,
          projectName: project?.name ?? 'Project',
          taskId,
          taskTitle: created.title,
          subtaskTitle: title,
          assigneeEmployeeId: created.assigneeEmployeeId,
          assigneeName: created.assignee?.name,
        })
      }
    }
  }
  return created
}

export async function getProjectWithProgress(project: Project): Promise<Project> {
  // Calculate progress from Kanban status: % of tasks that are done (so it stays in sync with the board)
  const totalTasks = project.tasks.length
  const completedTasks = project.tasks.filter((t) => t.status === 'done').length
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return {
    ...project,
    progress,
    totalTasks,
    completedTasks,
  }
}

export async function reorderTasks(projectId: string, taskId: string, newIndex: number): Promise<void> {
  if (!USE_SUPABASE) {
    const { reorderTasks: mockReorder } = await import('./project-data')
    return mockReorder(projectId, taskId, newIndex)
  }

  await api.reorderTask(taskId, newIndex)
  
  // Clear cache and dispatch event
  projectsCache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
}

export async function getOverdueTasks(): Promise<number> {
  if (!USE_SUPABASE) {
    const { getOverdueTasks: mockGet } = await import('./project-data')
    return mockGet()
  }

  return api.getOverdueTasks()
}

export async function getUpcomingDeadlines(): Promise<number> {
  if (!USE_SUPABASE) {
    const { getUpcomingDeadlines: mockGet } = await import('./project-data')
    return mockGet()
  }

  return api.getUpcomingDeadlines()
}

// ==================== UTILITY FUNCTIONS ====================

export function invalidateCache(): void {
  projectsCache = null
  cacheTimestamp = 0
}

export function isUsingSupabase(): boolean {
  return USE_SUPABASE
}

/**
 * Helper function to automatically determine task status based on progress percentage
 * @param progress - Task progress percentage (0-100)
 * @returns Appropriate task status
 */
export function getStatusFromProgress(progress: number): Task['status'] {
  if (progress === 0) return 'todo'
  if (progress === 100) return 'done'
  if (progress >= 75) return 'review'
  if (progress >= 1) return 'in-progress'
  return 'todo'
}

// ==================== MILESTONE FUNCTIONS ====================

export async function addMilestone(projectId: string, milestoneData: Omit<Milestone, 'id'>): Promise<Milestone | null> {
  if (!USE_SUPABASE) {
    const { addMilestone: mockAdd } = await import('./project-data-milestones')
    return mockAdd(projectId, milestoneData)
  }

  const milestoneId = await api.createMilestone(projectId, milestoneData)
  if (!milestoneId) return null

  // Clear cache and dispatch event
  projectsCache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }

  // Return the created milestone
  return {
    id: milestoneId,
    name: milestoneData.name,
    date: milestoneData.date,
    status: milestoneData.status,
    description: milestoneData.description,
    taskIds: milestoneData.taskIds || [],
  }
}

export async function getProjectMilestones(projectId: string): Promise<Milestone[]> {
  if (!USE_SUPABASE) {
    const { getProjectMilestones: mockGet } = await import('./project-data-milestones')
    return mockGet(projectId)
  }

  return api.getProjectMilestones(projectId)
}

export async function updateMilestone(projectId: string, milestoneId: string, updates: Partial<Milestone>): Promise<void> {
  if (!USE_SUPABASE) {
    const { updateMilestone: mockUpdate } = await import('./project-data-milestones')
    mockUpdate(projectId, milestoneId, updates)
    return
  }

  await api.updateMilestone(milestoneId, updates)
  
  // Clear cache and dispatch event
  projectsCache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
}

export async function deleteMilestone(projectId: string, milestoneId: string): Promise<void> {
  if (!USE_SUPABASE) {
    const { deleteMilestone: mockDelete } = await import('./project-data-milestones')
    mockDelete(projectId, milestoneId)
    return
  }

  await api.deleteMilestone(milestoneId)
  
  // Clear cache and dispatch event
  projectsCache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
}

// ==================== ACTIVITY FUNCTIONS ====================

export async function addTeamMember(projectId: string, member: Omit<TeamMember, 'id'>): Promise<string | null> {
  if (!USE_SUPABASE) {
    return null
  }

  const memberId = await api.addTeamMember(projectId, member)

  if (memberId) {
    const project = await api.getProjectById(projectId)
    await api.addActivity(projectId, {
      type: 'team_member_added',
      description: `Added ${member.name} to the team`,
      user: 'You',
      timestamp: 'Just now',
    })
    const { notifyPmProjectTeamAdded } = await import('@/lib/notification-modules')
    void notifyPmProjectTeamAdded({
      projectId,
      projectName: project?.name ?? 'Project',
      memberName: member.name,
      hrEmployeeId: member.hrEmployeeId,
    })
  }

  // Clear cache to force refresh
  projectsCache = null

  // Emit event to refresh project data
  window.dispatchEvent(new CustomEvent('projectDataUpdated', { 
    detail: { projectId } 
  }))

  return memberId
}

export async function updateTeamMember(memberId: string, updates: Partial<Omit<TeamMember, 'id'>>): Promise<boolean> {
  if (!USE_SUPABASE) {
    return false
  }

  const success = await api.updateTeamMember(memberId, updates)

  // Clear cache to force refresh
  projectsCache = null

  return success
}

export async function deleteTeamMember(memberId: string): Promise<boolean> {
  if (!USE_SUPABASE) {
    return false
  }

  const success = await api.deleteTeamMember(memberId)

  // Clear cache to force refresh
  projectsCache = null

  return success
}

export async function addActivity(projectId: string, activity: { type: string; description: string; user: string }): Promise<void> {
  if (!USE_SUPABASE) {
    // For mock data, activity is not implemented yet
    return
  }

  // Get relative timestamp
  const timestamp = 'Just now'
  
  await api.addActivity(projectId, {
    type: activity.type,
    description: activity.description,
    user: activity.user,
    timestamp: timestamp,
  })

  // Clear cache and dispatch event
  projectsCache = null
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }
}

// Re-export types
export type { Project, Task, Milestone, TeamMember } from './project-data'

// ==================== SPRINT FUNCTIONS ====================

export async function getProjectSprints(projectId: string): Promise<import('./project-data').Sprint[]> {
  if (!USE_SUPABASE) {
    return []
  }

  return await api.getProjectSprints(projectId)
}

export async function createSprint(projectId: string, sprint: Omit<import('./project-data').Sprint, 'id' | 'taskIds'>): Promise<string | null> {
  if (!USE_SUPABASE) {
    console.warn('[createSprint] Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
    throw new Error('Supabase is not configured')
  }

  const sprintId = await api.createSprint(projectId, sprint)

  // Clear cache to force refresh
  projectsCache = null

  // Emit event to refresh project data
  window.dispatchEvent(new CustomEvent('projectDataUpdated', { 
    detail: { projectId } 
  }))

  return sprintId
}

export async function updateSprint(sprintId: string, updates: Partial<Omit<import('./project-data').Sprint, 'id' | 'taskIds'>>): Promise<boolean> {
  if (!USE_SUPABASE) {
    return false
  }

  const success = await api.updateSprint(sprintId, updates)

  // Clear cache to force refresh
  projectsCache = null

  return success
}

export async function deleteSprint(sprintId: string): Promise<boolean> {
  if (!USE_SUPABASE) {
    return false
  }

  const success = await api.deleteSprint(sprintId)

  // Clear cache to force refresh
  projectsCache = null

  return success
}

export async function addTaskToSprint(sprintId: string, taskId: string): Promise<boolean> {
  if (!USE_SUPABASE) {
    return false
  }

  const success = await api.addTaskToSprint(sprintId, taskId)

  // Clear cache to force refresh
  projectsCache = null

  return success
}

export async function removeTaskFromSprint(sprintId: string, taskId: string): Promise<boolean> {
  if (!USE_SUPABASE) {
    return false
  }

  const success = await api.removeTaskFromSprint(sprintId, taskId)

  // Clear cache to force refresh
  projectsCache = null

  return success
}

export async function startSprint(sprintId: string): Promise<boolean> {
  if (!USE_SUPABASE) {
    return false
  }

  const success = await api.startSprint(sprintId)

  // Clear cache to force refresh
  projectsCache = null

  return success
}

export async function completeSprint(sprintId: string): Promise<boolean> {
  if (!USE_SUPABASE) {
    return false
  }

  const success = await api.completeSprint(sprintId)

  // Clear cache to force refresh
  projectsCache = null

  return success
}

// ==================== FILE OPERATIONS ====================

export async function getProjectFiles(projectId: string) {
  if (!USE_SUPABASE) {
    return []
  }

  return await api.getProjectFiles(projectId)
}

export async function addProjectFile(projectId: string, file: any) {
  if (!USE_SUPABASE) {
    return null
  }

  const fileId = await api.addProjectFile(projectId, file)

  // Clear cache to force refresh
  projectsCache = null

  // Emit event to refresh project data
  window.dispatchEvent(new CustomEvent('projectDataUpdated', { 
    detail: { projectId } 
  }))

  return fileId
}

export async function deleteProjectFile(fileId: string, fileUrl?: string) {
  if (!USE_SUPABASE) {
    return false
  }

  const success = await api.deleteProjectFile(fileId, fileUrl)

  // Clear cache to force refresh
  projectsCache = null

  return success
}

export async function uploadFileToStorage(projectId: string, file: File, onProgress?: (progress: number) => void) {
  if (!USE_SUPABASE) {
    return null
  }

  return await api.uploadFileToStorage(projectId, file, onProgress)
}

export async function downloadFileFromStorage(filePath: string) {
  if (!USE_SUPABASE) {
    return null
  }

  return await api.downloadFileFromStorage(filePath)
}

