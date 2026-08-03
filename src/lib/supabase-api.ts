import { getTodayDateKey, dateKeyDaysFromNow } from './due-date-utils'
import {
  buildAssigneeDbPayload,
  enrichTaskWithAssignees,
  getTaskAssignees,
  isAssigneesColumnError,
  isTaskAssignedTo,
  mergeAssigneeFields,
  MULTI_ASSIGNEE_AVATAR_PREFIX,
  parseTaskAssigneesFromDb,
} from './task-assignees'
import { supabase } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import { coalesceRequest } from './request-coalesce'
import type { Project, Task, Milestone, TeamMember, ProjectFile, Activity, Sprint } from './project-data'
import { getTaskProgressFromSubtasks } from './project-data'
import { reconcilePmTasksOverdue } from './overdue-reconcile'

// ==================== PROJECTS ====================

export async function getAllProjects(): Promise<Project[]> {
  const organizationId = await getOrganizationId()
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (projectsError) {
    console.error('Error fetching projects:', projectsError)
    throw projectsError
  }

  // Fetch related data for each project
  const projectsWithData = await Promise.all(
    (projects ?? []).map(async (project) => {
      const [tasks, team, files, activities, milestones] = await Promise.all([
        getProjectTasks(project.id),
        getProjectTeam(project.id),
        getProjectFiles(project.id),
        getProjectActivities(project.id),
        getProjectMilestones(project.id),
      ])

      return {
        id: project.id,
        name: project.name,
        status: project.status as Project['status'],
        progress: project.progress,
        deadline: project.deadline,
        totalTasks: project.total_tasks,
        completedTasks: project.completed_tasks,
        starred: project.starred,
        description: project.description ?? undefined,
        createdBy: project.created_by_name ? { name: project.created_by_name, avatar: project.created_by_avatar || '' } : undefined,
        owner: project.owner_name ? { name: project.owner_name, avatar: project.owner_avatar || '' } : undefined,
        createdAt: project.created_at ?? undefined,
        tasks,
        team,
        files,
        activities,
        milestones,
      }
    })
  )

  return projectsWithData
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !project) {
    console.error('Error fetching project:', error)
    return null
  }

  const [tasks, team, files, activities, milestones] = await Promise.all([
    getProjectTasks(project.id),
    getProjectTeam(project.id),
    getProjectFiles(project.id),
    getProjectActivities(project.id),
    getProjectMilestones(project.id),
  ])

  return {
    id: project.id,
    name: project.name,
    status: project.status as Project['status'],
    progress: project.progress,
    deadline: project.deadline,
    totalTasks: project.total_tasks,
    completedTasks: project.completed_tasks,
    starred: project.starred,
    description: project.description ?? undefined,
    createdBy: project.created_by_name ? { name: project.created_by_name, avatar: project.created_by_avatar || '' } : undefined,
    owner: project.owner_name ? { name: project.owner_name, avatar: project.owner_avatar || '' } : undefined,
    createdAt: project.created_at ?? undefined,
    tasks,
    team,
    files,
    activities,
    milestones,
  }
}

type ProjectPersonRef = { name: string; avatar: string; hrEmployeeId?: string | null }

async function ensureProjectAssigneeOnTeam(
  projectId: string,
  assignee: ProjectPersonRef & { role?: string }
): Promise<void> {
  const name = assignee.name.trim()
  if (!name) return

  const team = await getProjectTeam(projectId)
  const normalizedName = name.toLowerCase()
  const alreadyOnTeam = team.some((member) => {
    if (assignee.hrEmployeeId && member.hrEmployeeId === assignee.hrEmployeeId) return true
    return member.name.trim().toLowerCase() === normalizedName
  })
  if (alreadyOnTeam) return

  await addTeamMember(projectId, {
    name,
    role: assignee.role ?? 'owner',
    avatar: assignee.avatar || '',
    capacity: 40,
    hrEmployeeId: assignee.hrEmployeeId ?? null,
  })
}

export async function createProject(project: Omit<Project, 'id' | 'tasks' | 'team' | 'files' | 'activities' | 'milestones'>): Promise<string | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const explicitOwner = project.owner?.name?.trim()
    ? project.owner
    : undefined
  const owner = explicitOwner ?? (project.createdBy?.name?.trim() ? project.createdBy : undefined)

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: project.name,
      status: project.status,
      progress: project.progress,
      deadline: project.deadline,
      total_tasks: project.totalTasks,
      completed_tasks: project.completedTasks,
      starred: project.starred ?? false,
      description: project.description ?? null,
      created_by_name: project.createdBy?.name?.trim() || null,
      created_by_avatar: project.createdBy?.avatar || null,
      owner_name: owner?.name?.trim() || null,
      owner_avatar: owner?.avatar || null,
      user_id: userId,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating project:', error)
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('No data returned from create project')
  }

  const projectId = data.id as string

  if (owner?.name?.trim()) {
    await ensureProjectAssigneeOnTeam(projectId, { ...owner, role: 'owner' })
  }

  const creatorName = project.createdBy?.name?.trim()
  if (
    creatorName &&
    (!owner?.name?.trim() ||
      (owner.name.trim().toLowerCase() !== creatorName.toLowerCase() &&
        owner.hrEmployeeId !== project.createdBy?.hrEmployeeId))
  ) {
    await ensureProjectAssigneeOnTeam(projectId, {
      name: project.createdBy!.name,
      avatar: project.createdBy!.avatar || '',
      hrEmployeeId: project.createdBy?.hrEmployeeId ?? null,
      role: 'member',
    })
  }

  return projectId
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<boolean> {
  const dbUpdates: any = {}
  
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.progress !== undefined) dbUpdates.progress = updates.progress
  if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline
  if (updates.totalTasks !== undefined) dbUpdates.total_tasks = updates.totalTasks
  if (updates.completedTasks !== undefined) dbUpdates.completed_tasks = updates.completedTasks
  if (updates.starred !== undefined) dbUpdates.starred = updates.starred
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.owner !== undefined) {
    dbUpdates.owner_name = updates.owner.name?.trim() ? updates.owner.name : null
    dbUpdates.owner_avatar = updates.owner.name?.trim() ? (updates.owner.avatar || null) : null
  }

  const { error } = await supabase
    .from('projects')
    .update(dbUpdates)
    .eq('id', id)

  if (error) {
    console.error('Error updating project:', error)
    return false
  }

  if (updates.owner?.name?.trim()) {
    await ensureProjectAssigneeOnTeam(id, { ...updates.owner, role: 'owner' })
  }

  return true
}

export async function deleteProject(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting project:', error)
    return false
  }

  return true
}

// ==================== TASKS ====================

/** Map DB tasks row → app Task */
function mapTaskRowToTask(task: {
  id: string
  title: string
  status: string
  priority: string
  assignee_name: string
  assignee_avatar: string
  start_date: string | null
  deadline: string
  progress: number
  description: string | null
  milestone_id: string | null
  project_id: string
  assignee_employee_id?: string | null
  assignees?: unknown
  subtasks?: unknown
}): Task {
  const raw = task as { subtasks?: unknown; assignees?: unknown }
  let subtasks: unknown[] = []
  if (Array.isArray(raw.subtasks)) {
    subtasks = raw.subtasks
  } else if (typeof raw.subtasks === 'string') {
    try {
      const parsed = JSON.parse(raw.subtasks)
      subtasks = Array.isArray(parsed) ? parsed : []
    } catch {
      subtasks = []
    }
  }
  const assignees = parseTaskAssigneesFromDb(raw.assignees)
  const mapped: Task = enrichTaskWithAssignees({
    id: task.id,
    title: task.title,
    status: task.status as Task['status'],
    priority: task.priority as Task['priority'],
    assignee: { name: task.assignee_name, avatar: task.assignee_avatar },
    assigneeEmployeeId: task.assignee_employee_id ?? null,
    assignees,
    startDate: task.start_date || undefined,
    deadline: task.deadline,
    progress: task.progress,
    description: task.description || undefined,
    milestoneId: task.milestone_id || undefined,
    subtasks: subtasks as Task['subtasks'],
  })
  if (subtasks.length > 0) {
    mapped.progress = getTaskProgressFromSubtasks(mapped)
  }
  return mapped
}

export async function getProjectTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })

  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }

  const tasks = (data ?? []).map((task) =>
    mapTaskRowToTask(task as Parameters<typeof mapTaskRowToTask>[0]),
  )
  return reconcilePmTasksOverdue(tasks, projectId)
}

/** Projects and tasks assigned to the given person (HR id and/or legacy assignee display name). Used by Employee Portal "My Projects". */
export async function getProjectsAndTasksAssignedTo(
  assigneeName: string,
  employeeId?: string | null
): Promise<{ projectId: string; projectName: string; tasks: Task[] }[]> {
  const name = (assigneeName ?? '').trim()
  const eid = (employeeId ?? '').trim()
  if (!name && !eid) return []

  return coalesceRequest(
    `pm:getProjectsAndTasksAssignedTo:${name}|${eid}`,
    () => getProjectsAndTasksAssignedToImpl(name, eid),
  )
}

async function getProjectsAndTasksAssignedToImpl(
  name: string,
  eid: string
): Promise<{ projectId: string; projectName: string; tasks: Task[] }[]> {
  type DbRow = Parameters<typeof mapTaskRowToTask>[0]
  const merged = new Map<string, DbRow>()

  if (eid) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assignee_employee_id', eid)
      .order('deadline', { ascending: true })
    if (error) console.error('Error fetching tasks by assignee_employee_id:', error)
    data?.forEach((t) => merged.set(t.id, t as DbRow))
  }
  if (name) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assignee_name', name)
      .order('deadline', { ascending: true })
    if (error) console.error('Error fetching tasks by assignee_name:', error)
    data?.forEach((t) => {
      if (!merged.has(t.id)) merged.set(t.id, t as DbRow)
    })
  }

  // Include tasks where user appears in the multi-assignee list
  const { data: multiRows, error: multiError } = await supabase
    .from('tasks')
    .select('*')
    .neq('assignees', '[]')
  if (multiError) {
    console.error('Error fetching tasks with assignees list:', multiError)
  } else {
    multiRows?.forEach((row) => {
      const mapped = mapTaskRowToTask(row as DbRow)
      if (isTaskAssignedTo(mapped, { employeeId: eid, name }) && !merged.has(row.id)) {
        merged.set(row.id, row as DbRow)
      }
    })
  }

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from('tasks')
    .select('*')
    .like('assignee_avatar', `${MULTI_ASSIGNEE_AVATAR_PREFIX}%`)
  if (fallbackError) {
    console.error('Error fetching tasks with assignee avatar fallback:', fallbackError)
  } else {
    fallbackRows?.forEach((row) => {
      const mapped = mapTaskRowToTask(row as DbRow)
      if (isTaskAssignedTo(mapped, { employeeId: eid, name }) && !merged.has(row.id)) {
        merged.set(row.id, row as DbRow)
      }
    })
  }

  const tasksData = [...merged.values()]
  if (tasksData.length === 0) return []

  const projectIds = [...new Set(tasksData.map((t) => t.project_id))]
  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, name')
    .in('id', projectIds)

  const projectNamesById = new Map<string, string>()
  projectsData?.forEach((p) => projectNamesById.set(p.id, p.name ?? ''))

  const byProject = new Map<string, Task[]>()
  for (const row of tasksData) {
    const task = mapTaskRowToTask(row)
    const list = byProject.get(row.project_id) ?? []
    list.push(task)
    byProject.set(row.project_id, list)
  }

  for (const [projectId, list] of byProject.entries()) {
    byProject.set(projectId, await reconcilePmTasksOverdue(list, projectId))
  }

  return Array.from(byProject.entries()).map(([projectId, tasks]) => ({
    projectId,
    projectName: projectNamesById.get(projectId) ?? 'Project',
    tasks,
  }))
}

export async function createTask(projectId: string, task: Omit<Task, 'id'>): Promise<string | null> {
  const userId = await getCurrentUserId()
  // Get the current max order_index for this project
  const { data: maxOrderData } = await supabase
    .from('tasks')
    .select('order_index')
    .eq('project_id', projectId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrderIndex = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].order_index + 1 : 0

  // tasks.deadline is NOT NULL in DB; use default when empty
  const deadlineValue = task.deadline?.trim()
    ? task.deadline
    : dateKeyDaysFromNow(30)

  // Default start_date to today so tasks span from creation to deadline on the calendar
  const todayStr = getTodayDateKey()
  const startDateValue = task.startDate?.trim() || todayStr

  const subtasksJson = task.subtasks && task.subtasks.length > 0 ? task.subtasks : []
  const mergedAssignees = mergeAssigneeFields(task)
  const assigneePayload = buildAssigneeDbPayload(mergedAssignees.assignees)
  const orgId = await getOrganizationId()
  const insertPayload: Record<string, unknown> = {
    project_id: projectId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assignee_name: assigneePayload.assignee_name,
    assignee_avatar: assigneePayload.assignee_avatar,
    assignee_employee_id: assigneePayload.assignee_employee_id,
    assignees: assigneePayload.assignees,
    start_date: startDateValue,
    deadline: deadlineValue,
    progress: task.progress ?? 0,
    description: task.description || null,
    milestone_id: task.milestoneId || null,
    order_index: nextOrderIndex,
    subtasks: subtasksJson,
    user_id: userId,
    organization_id: orgId,
  }

  let { data, error } = await supabase
    .from('tasks')
    .insert(insertPayload)
    .select()
    .single()

  // If optional json columns don't exist yet, retry without them
  if (error) {
    const msg = error.message?.toLowerCase() ?? ''
    if (msg.includes('subtask')) {
      console.warn('subtasks column not found, retrying without it')
      delete insertPayload.subtasks
    }
    if (isAssigneesColumnError(error.message)) {
      console.warn('assignees column not found, persisting multi-assignee via assignee_avatar fallback')
      delete insertPayload.assignees
      const fallbackPayload = buildAssigneeDbPayload(mergedAssignees.assignees, { useAvatarFallback: true })
      insertPayload.assignee_avatar = fallbackPayload.assignee_avatar
      insertPayload.assignee_name = fallbackPayload.assignee_name
      insertPayload.assignee_employee_id = fallbackPayload.assignee_employee_id
    }
    if (msg.includes('subtask') || isAssigneesColumnError(error.message)) {
      const retry = await supabase.from('tasks').insert(insertPayload).select().single()
      data = retry.data
      error = retry.error
    }
  }

  if (error) {
    console.error('Error creating task:', error)
    throw new Error(error.message)
  }
  if (!data) {
    throw new Error('No data returned from create task')
  }

  return data.id
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const dbUpdates: Record<string, unknown> = {}
  let assigneePayload: ReturnType<typeof buildAssigneeDbPayload> | null = null
  
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority
  if (updates.assignee !== undefined) {
    dbUpdates.assignee_name = updates.assignee.name
    dbUpdates.assignee_avatar = updates.assignee.avatar
  }
  if (updates.assigneeEmployeeId !== undefined) {
    dbUpdates.assignee_employee_id = updates.assigneeEmployeeId
  }
  if (updates.assignees !== undefined) {
    const merged = mergeAssigneeFields({
      assignees: updates.assignees,
      assignee: updates.assignee ?? { name: 'Unassigned', avatar: '' },
      assigneeEmployeeId: updates.assigneeEmployeeId ?? null,
    })
    assigneePayload = buildAssigneeDbPayload(merged.assignees)
    dbUpdates.assignees = assigneePayload.assignees
    dbUpdates.assignee_name = assigneePayload.assignee_name
    dbUpdates.assignee_avatar = assigneePayload.assignee_avatar
    dbUpdates.assignee_employee_id = assigneePayload.assignee_employee_id
  }
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate?.trim() || null
  if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline || null // Convert empty string to NULL
  if (updates.progress !== undefined) dbUpdates.progress = updates.progress
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.milestoneId !== undefined) dbUpdates.milestone_id = updates.milestoneId
  if (updates.subtasks !== undefined) dbUpdates.subtasks = updates.subtasks

  let { data, error } = await supabase
    .from('tasks')
    .update(dbUpdates)
    .eq('id', taskId)
    .select()
    .single()

  if (error && isAssigneesColumnError(error.message) && assigneePayload) {
    console.warn('assignees column not found, persisting multi-assignee via assignee_avatar fallback')
    const fallbackPayload = buildAssigneeDbPayload(assigneePayload.assignees, { useAvatarFallback: true })
    const retryPayload = { ...dbUpdates }
    delete retryPayload.assignees
    retryPayload.assignee_name = fallbackPayload.assignee_name
    retryPayload.assignee_avatar = fallbackPayload.assignee_avatar
    retryPayload.assignee_employee_id = fallbackPayload.assignee_employee_id
    const retry = await supabase.from('tasks').update(retryPayload).eq('id', taskId).select().single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Error updating task:', error)
    throw new Error(error.message || 'Failed to update task')
  }

  if (!data) return null
  return mapTaskRowToTask(data as Parameters<typeof mapTaskRowToTask>[0])
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) {
    console.error('Error deleting task:', error)
    return false
  }

  return true
}

export async function reorderTask(taskId: string, newOrderIndex: number): Promise<boolean> {
  const { error } = await supabase
    .from('tasks')
    .update({ order_index: newOrderIndex })
    .eq('id', taskId)

  if (error) {
    console.error('Error reordering task:', error)
    return false
  }

  return true
}

// ==================== MILESTONES ====================

export async function getProjectMilestones(projectId: string): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching milestones:', error)
    return []
  }

  // Get task IDs for each milestone
  const milestonesWithTasks = await Promise.all(
    data.map(async (milestone) => {
      const { data: taskData } = await supabase
        .from('milestone_tasks')
        .select('task_id')
        .eq('milestone_id', milestone.id)

      return {
        id: milestone.id,
        name: milestone.name,
        date: milestone.date,
        status: milestone.status as Milestone['status'],
        description: milestone.description || undefined,
        taskIds: taskData?.map((t) => t.task_id) || [],
      }
    })
  )

  return milestonesWithTasks
}

export async function createMilestone(projectId: string, milestone: Omit<Milestone, 'id'>): Promise<string | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('milestones')
    .insert({
      project_id: projectId,
      name: milestone.name,
      date: milestone.date,
      status: milestone.status,
      description: milestone.description || null,
      user_id: userId,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creating milestone:', error)
    return null
  }

  // Add task associations if provided
  if (milestone.taskIds && milestone.taskIds.length > 0) {
    const taskAssociations = milestone.taskIds.map((taskId) => ({
      milestone_id: data.id,
      task_id: taskId,
      user_id: userId,
      organization_id: orgId,
    }))

    await supabase.from('milestone_tasks').insert(taskAssociations)
  }

  return data.id
}

export async function updateMilestone(milestoneId: string, updates: Partial<Milestone>): Promise<boolean> {
  const userId = await getCurrentUserId()
  const dbUpdates: any = {}
  
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.date !== undefined) dbUpdates.date = updates.date
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.description !== undefined) dbUpdates.description = updates.description

  const { error } = await supabase
    .from('milestones')
    .update(dbUpdates)
    .eq('id', milestoneId)

  if (error) {
    console.error('Error updating milestone:', error)
    return false
  }

  // Update task associations if provided
  if (updates.taskIds !== undefined) {
    const orgId = await getOrganizationId()
    // First, remove all existing associations
    await supabase.from('milestone_tasks').delete().eq('milestone_id', milestoneId)
    
    // Then add new associations
    if (updates.taskIds.length > 0) {
      const taskAssociations = updates.taskIds.map((taskId) => ({
        milestone_id: milestoneId,
        task_id: taskId,
        user_id: userId,
        organization_id: orgId,
      }))
      await supabase.from('milestone_tasks').insert(taskAssociations)
    }
  }

  return true
}

export async function deleteMilestone(milestoneId: string): Promise<boolean> {
  // First, remove all task associations
  await supabase.from('milestone_tasks').delete().eq('milestone_id', milestoneId)
  
  // Then delete the milestone
  const { error } = await supabase
    .from('milestones')
    .delete()
    .eq('id', milestoneId)

  if (error) {
    console.error('Error deleting milestone:', error)
    return false
  }

  return true
}

// ==================== TEAM MEMBERS ====================

export async function getProjectTeam(projectId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('project_id', projectId)

  if (error) {
    console.error('Error fetching team members:', error)
    return []
  }

  return data.map((member) => {
    const row = member as { hr_employee_id?: string | null }
    return {
      id: member.id,
      name: member.name,
      role: member.role,
      avatar: member.avatar,
      capacity: member.capacity,
      hrEmployeeId: row.hr_employee_id ?? null,
    }
  })
}

export async function addTeamMember(projectId: string, member: Omit<TeamMember, 'id'>): Promise<string | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const insertRow: Record<string, unknown> = {
    project_id: projectId,
    name: member.name,
    role: member.role,
    avatar: member.avatar,
    capacity: member.capacity,
    user_id: userId,
    organization_id: orgId,
  }
  if (member.hrEmployeeId) {
    insertRow.hr_employee_id = member.hrEmployeeId
  }
  const { data, error } = await supabase
    .from('team_members')
    .insert(insertRow)
    .select()
    .single()

  if (error || !data) {
    console.error('Error adding team member:', error)
    return null
  }

  return data.id
}

export async function updateTeamMember(memberId: string, updates: Partial<Omit<TeamMember, 'id'>>): Promise<boolean> {
  const payload: Record<string, unknown> = {}
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.role !== undefined) payload.role = updates.role
  if (updates.avatar !== undefined) payload.avatar = updates.avatar
  if (updates.capacity !== undefined) payload.capacity = updates.capacity
  if (updates.hrEmployeeId !== undefined) payload.hr_employee_id = updates.hrEmployeeId

  if (Object.keys(payload).length === 0) return true

  const { error } = await supabase
    .from('team_members')
    .update(payload)
    .eq('id', memberId)

  if (error) {
    console.error('Error updating team member:', error)
    return false
  }

  return true
}

export async function deleteTeamMember(memberId: string): Promise<boolean> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', memberId)

  if (error) {
    console.error('Error deleting team member:', error)
    return false
  }

  return true
}

// ==================== FILES ====================

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching files:', error)
    return []
  }

  return data.map((file) => ({
    id: file.id,
    name: file.name,
    type: file.type,
    uploadedBy: file.uploaded_by,
    uploadedAt: file.uploaded_at,
    size: file.size,
    url: file.file_url || '',
  }))
}

export async function addProjectFile(projectId: string, file: Omit<ProjectFile, 'id'>): Promise<string | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('project_files')
    .insert({
      project_id: projectId,
      name: file.name,
      type: file.type,
      uploaded_by: file.uploadedBy,
      uploaded_at: file.uploadedAt,
      size: file.size,
      file_url: file.url || '',
      user_id: userId,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error adding file:', error)
    return null
  }

  return data.id
}

export async function deleteProjectFile(fileId: string, fileUrl?: string): Promise<boolean> {
  try {
    // If file URL exists, delete from storage first
    if (fileUrl) {
      const filePath = fileUrl.split('/').slice(-2).join('/')
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([filePath])
      
      if (storageError) {
        console.error('Error deleting file from storage:', storageError)
      }
    }

    // Delete from database
    const { error } = await supabase
      .from('project_files')
      .delete()
      .eq('id', fileId)

    if (error) {
      console.error('Error deleting file from database:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Error deleting file:', err)
    return false
  }
}

export async function uploadFileToStorage(
  projectId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; path: string } | null> {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    
    const { data, error } = await supabase.storage
      .from('project-files')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      console.error('Error uploading file:', error)
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('project-files')
      .getPublicUrl(data.path)

    return {
      url: urlData.publicUrl,
      path: data.path,
    }
  } catch (err) {
    console.error('Error uploading file:', err)
    return null
  }
}

export async function downloadFileFromStorage(filePath: string): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage
      .from('project-files')
      .download(filePath)

    if (error) {
      console.error('Error downloading file:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Error downloading file:', err)
    return null
  }
}

// ==================== ACTIVITIES ====================

export async function getProjectActivities(projectId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('project_id', projectId)
    .neq('type', 'comment')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching activities:', error)
    return []
  }

  return data.map((activity) => ({
    id: activity.id,
    type: activity.type,
    description: activity.description,
    user: activity.user,
    timestamp: activity.timestamp || activity.created_at,
  }))
}

/** Recent activities across all projects (for Hub activity feed). */
export async function getRecentProjectActivities(limit: number = 20): Promise<Array<{ id: string; project_id: string; type: string; description: string; user: string; created_at: string }>> {
  const { data, error } = await supabase
    .from('activities')
    .select('id, project_id, type, description, user, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent project activities:', error)
    return []
  }
  return data ?? []
}

export async function addActivity(projectId: string, activity: Omit<Activity, 'id'>): Promise<string | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const timestamp =
    activity.timestamp && Number.isFinite(new Date(activity.timestamp).getTime())
      ? activity.timestamp
      : new Date().toISOString()
  const { data, error } = await supabase
    .from('activities')
    .insert({
      project_id: projectId,
      type: activity.type,
      description: activity.description,
      user: activity.user,
      timestamp,
      user_id: userId,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error adding activity:', error)
    return null
  }

  return data.id
}

// ==================== TASK COMMENTS ====================

export async function getTaskComments(taskId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('task_id', taskId)
    .eq('type', 'comment')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching task comments:', error)
    return []
  }

  return data.map((a) => ({
    id: a.id,
    type: a.type,
    description: a.description,
    user: a.user,
    timestamp: a.timestamp || a.created_at,
  }))
}

export async function addTaskComment(
  projectId: string,
  taskId: string,
  comment: string,
  userName: string
): Promise<Activity | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('activities')
    .insert({
      project_id: projectId,
      task_id: taskId,
      type: 'comment',
      description: comment,
      user: userName,
      timestamp: new Date().toISOString(),
      user_id: userId,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error adding task comment:', error)
    return null
  }

  return {
    id: data.id,
    type: data.type,
    description: data.description,
    user: data.user,
    timestamp: data.timestamp || data.created_at,
  }
}

// ==================== UTILITY FUNCTIONS ====================

export async function getOverdueTasks(): Promise<number> {
  const today = getTodayDateKey()

  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'done')
    .lt('deadline', today)

  if (error) {
    console.error('Error fetching overdue tasks:', error)
    return 0
  }

  return count || 0
}

export async function getUpcomingDeadlines(): Promise<number> {
  const today = new Date()
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'done')
    .gte('deadline', getTodayDateKey(today))
    .lte('deadline', getTodayDateKey(nextWeek))

  if (error) {
    console.error('Error fetching upcoming deadlines:', error)
    return 0
  }

  return count || 0
}

// ==================== SPRINTS ====================

export async function getProjectSprints(projectId: string): Promise<Sprint[]> {
  const { data: sprintsData, error } = await supabase
    .from('sprints')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error || !sprintsData) {
    console.error('Error fetching sprints:', error)
    return []
  }

  // For each sprint, get the associated task IDs
  const sprints = await Promise.all(
    sprintsData.map(async (sprint) => {
      const { data: sprintTasks } = await supabase
        .from('sprint_tasks')
        .select('task_id')
        .eq('sprint_id', sprint.id)

      return {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal || '',
        startDate: sprint.start_date,
        endDate: sprint.end_date,
        status: sprint.status as 'planned' | 'active' | 'completed',
        taskIds: sprintTasks?.map(st => st.task_id) || [],
      }
    })
  )

  return sprints
}

export async function createSprint(projectId: string, sprint: Omit<Sprint, 'id' | 'taskIds'>): Promise<string | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('sprints')
    .insert({
      project_id: projectId,
      name: sprint.name,
      goal: sprint.goal,
      start_date: sprint.startDate,
      end_date: sprint.endDate,
      status: sprint.status,
      user_id: userId,
      organization_id: orgId,
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error creating sprint:', error)
    return null
  }

  return data.id
}

export async function updateSprint(sprintId: string, updates: Partial<Omit<Sprint, 'id' | 'taskIds'>>): Promise<boolean> {
  const updateData: any = {}
  if (updates.name) updateData.name = updates.name
  if (updates.goal !== undefined) updateData.goal = updates.goal
  if (updates.startDate) updateData.start_date = updates.startDate
  if (updates.endDate) updateData.end_date = updates.endDate
  if (updates.status) updateData.status = updates.status

  const { error } = await supabase
    .from('sprints')
    .update(updateData)
    .eq('id', sprintId)

  if (error) {
    console.error('Error updating sprint:', error)
    return false
  }

  return true
}

export async function deleteSprint(sprintId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sprints')
    .delete()
    .eq('id', sprintId)

  if (error) {
    console.error('Error deleting sprint:', error)
    return false
  }

  return true
}

export async function addTaskToSprint(sprintId: string, taskId: string): Promise<boolean> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { error, data } = await supabase
    .from('sprint_tasks')
    .insert({
      sprint_id: sprintId,
      task_id: taskId,
      user_id: userId,
      organization_id: orgId,
    })
    .select()

  if (error) {
    console.error('Error adding task to sprint:', error)
    console.error('Sprint ID:', sprintId, 'Task ID:', taskId)
    return false
  }

  console.log('[addTaskToSprint] Successfully added task to sprint:', data)
  return true
}

export async function removeTaskFromSprint(sprintId: string, taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sprint_tasks')
    .delete()
    .eq('sprint_id', sprintId)
    .eq('task_id', taskId)

  if (error) {
    console.error('Error removing task from sprint:', error)
    return false
  }

  return true
}

export async function startSprint(sprintId: string): Promise<boolean> {
  // First, set any existing active sprint to completed
  await supabase
    .from('sprints')
    .update({ status: 'completed' })
    .eq('status', 'active')

  // Then activate this sprint
  return await updateSprint(sprintId, { status: 'active' })
}

export async function completeSprint(sprintId: string): Promise<boolean> {
  return await updateSprint(sprintId, { status: 'completed' })
}
