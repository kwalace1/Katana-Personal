import type { Project } from './project-data'
import { isTaskAssignedTo } from './task-assignees'

export type PmProjectScope = 'mine' | 'organization'

const PM_SCOPE_STORAGE_KEY = 'katana_pm_project_scope'

export interface PmUserContext {
  employeeId: string | null
  loginNames: string[]
  loginEmails: string[]
  orgRole?: string | null
}

export function loadPmProjectScope(): PmProjectScope {
  try {
    const value = localStorage.getItem(PM_SCOPE_STORAGE_KEY)
    return value === 'mine' ? 'mine' : 'organization'
  } catch {
    return 'organization'
  }
}

export function savePmProjectScope(scope: PmProjectScope): void {
  try {
    localStorage.setItem(PM_SCOPE_STORAGE_KEY, scope)
  } catch {
    // ignore storage errors
  }
}

/** True when the user appears on the project team roster or is the project owner. */
export function isUserOnProjectTeam(
  project: Pick<Project, 'team' | 'owner'>,
  ctx: Pick<PmUserContext, 'employeeId' | 'loginNames'>
): boolean {
  const { employeeId, loginNames } = ctx

  const onRoster = project.team.some((member) => {
    if (employeeId && member.hrEmployeeId === employeeId) return true
    const memberName = member.name.trim().toLowerCase()
    return loginNames.some((name) => name === memberName)
  })
  if (onRoster) return true

  const ownerName = project.owner?.name?.trim().toLowerCase()
  if (ownerName && loginNames.some((name) => name === ownerName)) return true

  return false
}

/** Projects the user should see in "My Projects" — team, owner, creator, or assigned tasks. */
export function isUserInvolvedInProject(project: Project, ctx: PmUserContext): boolean {
  if (isUserOnProjectTeam(project, ctx)) return true

  const { employeeId, loginNames } = ctx
  const hasAssignedTask = project.tasks.some((task) => {
    if (employeeId && isTaskAssignedTo(task, { employeeId })) return true
    return loginNames.some((name) => isTaskAssignedTo(task, { name }))
  })
  if (hasAssignedTask) return true

  const creatorName = project.createdBy?.name?.trim().toLowerCase()
  if (creatorName && loginNames.some((name) => name === creatorName)) return true

  return false
}

export function filterProjectsByScope(
  projects: Project[],
  scope: PmProjectScope,
  ctx: PmUserContext
): Project[] {
  if (scope === 'organization') return projects
  return projects.filter((project) => isUserInvolvedInProject(project, ctx))
}

function matchesLoginIdentity(
  label: string | undefined,
  ctx: Pick<PmUserContext, 'loginNames' | 'loginEmails'>
): boolean {
  const normalized = label?.trim().toLowerCase()
  if (!normalized) return false
  if (ctx.loginNames.some((name) => name === normalized)) return true
  return ctx.loginEmails.some((email) => email === normalized)
}

/** True when the logged-in user created the project (by display name or email). */
export function isUserProjectCreator(
  project: Pick<Project, 'createdBy'>,
  ctx: Pick<PmUserContext, 'loginNames' | 'loginEmails'>
): boolean {
  return matchesLoginIdentity(project.createdBy?.name, ctx)
}

/** Org owners/admins can edit any project; viewers never edit; members need team membership. */
export function canEditProject(project: Project, ctx: PmUserContext): boolean {
  if (ctx.orgRole === 'viewer') return false
  if (ctx.orgRole === 'owner' || ctx.orgRole === 'admin') return true
  if (isUserProjectCreator(project, ctx)) return true
  return isUserOnProjectTeam(project, ctx)
}

export function getPmScopeLabel(scope: PmProjectScope): string {
  return scope === 'mine' ? 'My Projects' : 'Organization'
}
