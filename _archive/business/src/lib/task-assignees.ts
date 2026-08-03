import type { Task, TeamMember } from './project-data'

export interface TaskAssignee {
  employeeId?: string | null
  name: string
  avatar: string
}

const PLACEHOLDER_AVATAR = '/placeholder.svg?height=32&width=32'
/** Encoded in assignee_avatar when assignees jsonb column is unavailable */
export const MULTI_ASSIGNEE_AVATAR_PREFIX = '__katana_assignees__:'

function assigneeKey(a: Pick<TaskAssignee, 'employeeId' | 'name'>): string {
  const eid = a.employeeId?.trim()
  if (eid) return `id:${eid}`
  return `name:${a.name.trim().toLowerCase()}`
}

export function normalizeTaskAssignee(raw: unknown): TaskAssignee | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  if (!name || name.toLowerCase() === 'unassigned') return null
  const employeeId =
    typeof row.employeeId === 'string'
      ? row.employeeId.trim() || null
      : typeof row.employee_id === 'string'
        ? row.employee_id.trim() || null
        : null
  const avatar =
    typeof row.avatar === 'string' && row.avatar.trim()
      ? row.avatar.trim()
      : PLACEHOLDER_AVATAR
  return { employeeId, name, avatar }
}

export function parseTaskAssigneesFromDb(raw: unknown): TaskAssignee[] {
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      list = Array.isArray(parsed) ? parsed : []
    } catch {
      list = []
    }
  }
  const out: TaskAssignee[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const normalized = normalizeTaskAssignee(item)
    if (!normalized) continue
    const key = assigneeKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

/** Fallback storage in assignee_avatar when tasks.assignees column is missing */
export function encodeAssigneesAvatarFallback(assignees: TaskAssignee[]): string {
  const serialized = serializeTaskAssigneesForDb(assignees)
  if (serialized.length <= 1) {
    return serialized[0]?.avatar?.trim() || PLACEHOLDER_AVATAR
  }
  return `${MULTI_ASSIGNEE_AVATAR_PREFIX}${JSON.stringify(serialized)}`
}

export function parseAssigneesAvatarFallback(avatar: string | null | undefined): TaskAssignee[] {
  const value = avatar?.trim() ?? ''
  if (!value.startsWith(MULTI_ASSIGNEE_AVATAR_PREFIX)) return []
  try {
    const parsed = JSON.parse(value.slice(MULTI_ASSIGNEE_AVATAR_PREFIX.length))
    return parseTaskAssigneesFromDb(parsed)
  } catch {
    return []
  }
}

export function buildAssigneeDbPayload(
  assignees: TaskAssignee[],
  options?: { useAvatarFallback?: boolean }
): {
  assignees: TaskAssignee[]
  assignee_name: string
  assignee_avatar: string
  assignee_employee_id: string | null
} {
  const serialized = serializeTaskAssigneesForDb(assignees)
  const primary = primaryAssigneeFromList(serialized)
  const useAvatarFallback = options?.useAvatarFallback === true
  return {
    assignees: serialized,
    assignee_name: primary.assignee.name,
    assignee_avatar: useAvatarFallback && serialized.length > 1
      ? encodeAssigneesAvatarFallback(serialized)
      : primary.assignee.avatar || PLACEHOLDER_AVATAR,
    assignee_employee_id: primary.assigneeEmployeeId,
  }
}

export function isAssigneesColumnError(message: string | undefined): boolean {
  const msg = (message ?? '').toLowerCase()
  return msg.includes('assignees') && (msg.includes('column') || msg.includes('schema'))
}

/** Resolve assignees from multi-assignee field or legacy single assignee columns */
export function getTaskAssignees(
  task: Pick<Task, 'assignees' | 'assignee' | 'assigneeEmployeeId'>
): TaskAssignee[] {
  const fromList = task.assignees ?? []
  if (fromList.length > 0) return fromList

  const fromAvatar = parseAssigneesAvatarFallback(task.assignee?.avatar)
  if (fromAvatar.length > 0) return fromAvatar

  const name = task.assignee?.name?.trim() ?? ''
  if (!name || name.toLowerCase() === 'unassigned') return []

  return [
    {
      employeeId: task.assigneeEmployeeId ?? null,
      name,
      avatar: task.assignee?.avatar?.trim() || PLACEHOLDER_AVATAR,
    },
  ]
}

export function primaryAssigneeFromList(assignees: TaskAssignee[]): {
  assignee: Task['assignee']
  assigneeEmployeeId: string | null
} {
  if (!assignees.length) {
    return {
      assignee: { name: 'Unassigned', avatar: PLACEHOLDER_AVATAR },
      assigneeEmployeeId: null,
    }
  }
  const first = assignees[0]
  return {
    assignee: { name: first.name, avatar: first.avatar || PLACEHOLDER_AVATAR },
    assigneeEmployeeId: first.employeeId?.trim() || null,
  }
}

export function mergeAssigneeFields(task: Partial<Task> & Pick<Task, 'assignee' | 'assigneeEmployeeId'>): {
  assignees: TaskAssignee[]
  assignee: Task['assignee']
  assigneeEmployeeId: string | null
} {
  const assignees =
    task.assignees && task.assignees.length > 0
      ? task.assignees
      : getTaskAssignees(task as Task)
  const primary = primaryAssigneeFromList(assignees)
  return { assignees, ...primary }
}

export function serializeTaskAssigneesForDb(assignees: TaskAssignee[]): TaskAssignee[] {
  const out: TaskAssignee[] = []
  const seen = new Set<string>()
  for (const raw of assignees) {
    const normalized = normalizeTaskAssignee(raw)
    if (!normalized) continue
    const key = assigneeKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }
  return out
}

export function formatAssigneeSummary(
  task: Pick<Task, 'assignees' | 'assignee' | 'assigneeEmployeeId'>
): string {
  const assignees = getTaskAssignees(task)
  if (!assignees.length) return 'Unassigned'
  if (assignees.length === 1) return assignees[0].name
  if (assignees.length === 2) return `${assignees[0].name}, ${assignees[1].name}`
  return `${assignees[0].name} +${assignees.length - 1}`
}

export function isTaskAssignedTo(
  task: Pick<Task, 'assignees' | 'assignee' | 'assigneeEmployeeId'>,
  options: { employeeId?: string | null; name?: string | null }
): boolean {
  const eid = options.employeeId?.trim()
  const name = options.name?.trim().toLowerCase()
  const assignees = getTaskAssignees(task)

  if (eid && assignees.some((a) => a.employeeId === eid)) return true
  if (name && assignees.some((a) => a.name.trim().toLowerCase() === name)) return true

  if (eid && task.assigneeEmployeeId === eid) return true
  if (name && (task.assignee?.name?.trim().toLowerCase() ?? '') === name) return true
  return false
}

export function isTaskUnassigned(
  task: Pick<Task, 'assignees' | 'assignee' | 'assigneeEmployeeId'>
): boolean {
  return getTaskAssignees(task).length === 0
}

export function assigneesChanged(
  before: Pick<Task, 'assignees' | 'assignee' | 'assigneeEmployeeId'> | undefined,
  after: Pick<Task, 'assignees' | 'assignee' | 'assigneeEmployeeId'>
): boolean {
  const beforeKeys = getTaskAssignees(before ?? { assignee: { name: '', avatar: '' } }).map(assigneeKey)
  const afterKeys = getTaskAssignees(after).map(assigneeKey)
  if (beforeKeys.length !== afterKeys.length) return true
  const beforeSet = new Set(beforeKeys)
  return afterKeys.some((key) => !beforeSet.has(key))
}

export function teamMemberToAssignee(member: TeamMember): TaskAssignee {
  return {
    employeeId: member.hrEmployeeId?.trim() || null,
    name: member.name,
    avatar: member.avatar?.trim() || PLACEHOLDER_AVATAR,
  }
}

export function enrichTaskWithAssignees(task: Task): Task {
  const assignees = getTaskAssignees(task)
  const primary = primaryAssigneeFromList(assignees)
  return {
    ...task,
    assignees,
    assignee: primary.assignee,
    assigneeEmployeeId: primary.assigneeEmployeeId,
  }
}
