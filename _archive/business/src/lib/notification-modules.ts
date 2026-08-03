/**
 * Module-specific notification dispatch (PM, HR, CS, Inventory, WFM, Support).
 */

import type { Task } from '@/lib/project-data'
import type { Goal, LearningPath, PerformanceReview } from '@/lib/hr-api'
import type { Client, ClientTask, ClientMilestone, ClientInteraction } from '@/lib/customer-success-api'
import type { PurchaseOrder, InventoryItem } from '@/lib/inventory-api'
import type { Job, Schedule, Technician } from '@/lib/wfm-api'
import type { SupportSubmission, SubmissionStatus } from '@/lib/support-api'
import { SUBMISSION_STATUS_LABELS } from '@/lib/support-api'
import { getTodayDateKey } from '@/lib/due-date-utils'
import { assigneesChanged } from '@/lib/task-assignees'
import {
  notifyUser,
  notifyUsers,
  resolveKatanaPlatformOperatorUserIds,
  resolveModuleStakeholderUserIds,
  resolveUserIdFromCsmId,
  resolveUserIdFromHrEmployeeId,
  resolveUserIdFromPmAssignee,
  resolveUserIdFromTechnicianId,
} from '@/lib/notification-recipients'
import { customerSuccessClientPath } from '@/lib/cs-deep-links'
import { myWorkDeepLink } from '@/lib/wfm-worker'

// —— Projects (PM) ——

export async function notifyPmTaskAssigned(options: {
  projectId: string
  taskId: string
  taskTitle: string
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
}): Promise<void> {
  const recipient = await resolveUserIdFromPmAssignee(options)
  if (!recipient) return

  const label = options.assigneeName?.trim() || 'you'
  await notifyUser(recipient, {
    sourceModule: 'projects',
    notificationType: 'task_assigned',
    title: 'Task assigned to you',
    body: `"${options.taskTitle}" was assigned to ${label === 'you' ? 'you' : options.assigneeName}.`,
    linkPath: `/projects/${options.projectId}`,
    dedupeKey: `projects:task:${options.taskId}:assign:${recipient}`,
    metadata: {
      project_id: options.projectId,
      task_id: options.taskId,
    },
    includeActor: true,
  })
}

export async function notifyPmTaskReassigned(options: {
  projectId: string
  taskId: string
  taskTitle: string
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
}): Promise<void> {
  const recipient = await resolveUserIdFromPmAssignee(options)
  if (!recipient) return

  await notifyUser(recipient, {
    sourceModule: 'projects',
    notificationType: 'task_reassigned',
    title: 'Task reassigned to you',
    body: `"${options.taskTitle}" is now assigned to you.`,
    linkPath: `/projects/${options.projectId}`,
    dedupeKey: `projects:task:${options.taskId}:reassign:${recipient}`,
    metadata: {
      project_id: options.projectId,
      task_id: options.taskId,
    },
    includeActor: true,
  })
}

export async function notifyPmTaskStatusChange(options: {
  projectId: string
  taskId: string
  taskTitle: string
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
  newStatus: string
}): Promise<void> {
  const recipient = await resolveUserIdFromPmAssignee(options)
  if (!recipient) return

  const statusLabel = options.newStatus.replace(/-/g, ' ')
  await notifyUser(recipient, {
    sourceModule: 'projects',
    notificationType: 'task_status_changed',
    title: 'Task status updated',
    body: `"${options.taskTitle}" is now ${statusLabel}.`,
    linkPath: `/projects/${options.projectId}`,
    dedupeKey: `projects:task:${options.taskId}:status:${options.newStatus}:${recipient}`,
    metadata: {
      project_id: options.projectId,
      task_id: options.taskId,
      status: options.newStatus,
    },
  })
}

export async function notifyPmTaskCompleted(options: {
  projectId: string
  taskId: string
  taskTitle: string
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
}): Promise<void> {
  const recipient = await resolveUserIdFromPmAssignee(options)
  if (!recipient) return

  await notifyUser(recipient, {
    sourceModule: 'projects',
    notificationType: 'task_completed',
    title: 'Task marked complete',
    body: `"${options.taskTitle}" was marked done.`,
    linkPath: `/projects/${options.projectId}`,
    dedupeKey: `projects:task:${options.taskId}:done:${recipient}`,
    metadata: {
      project_id: options.projectId,
      task_id: options.taskId,
    },
  })
}

export async function notifyPmTaskOverdue(options: {
  projectId: string
  taskId: string
  taskTitle: string
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
  reason?: 'past_due' | 'status_reverted'
}): Promise<void> {
  const recipient = await resolveUserIdFromPmAssignee(options)
  if (!recipient || !options.projectId) return

  const today = getTodayDateKey()
  const reason = options.reason ?? 'past_due'
  await notifyUser(recipient, {
    sourceModule: 'projects',
    notificationType: 'task_overdue',
    title: 'Project task overdue',
    body:
      reason === 'status_reverted'
        ? `"${options.taskTitle}" is past due and was moved back to backlog.`
        : `"${options.taskTitle}" is past its due date.`,
    linkPath: `/projects/${options.projectId}`,
    dedupeKey: `projects:task:${options.taskId}:overdue:${today}:${reason}`,
    metadata: {
      project_id: options.projectId,
      task_id: options.taskId,
      reason,
    },
  })
}

export async function notifyPmSubtasksUpdated(options: {
  projectId: string
  taskId: string
  taskTitle: string
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
  completedCount: number
  totalCount: number
}): Promise<void> {
  const recipient = await resolveUserIdFromPmAssignee(options)
  if (!recipient || options.totalCount === 0) return

  await notifyUser(recipient, {
    sourceModule: 'projects',
    notificationType: 'subtasks_updated',
    title: 'Subtasks updated',
    body: `"${options.taskTitle}": ${options.completedCount}/${options.totalCount} subtasks complete.`,
    linkPath: `/projects/${options.projectId}`,
    dedupeKey: `projects:task:${options.taskId}:subtasks:${options.completedCount}:${options.totalCount}`,
    metadata: {
      project_id: options.projectId,
      task_id: options.taskId,
      completed: options.completedCount,
      total: options.totalCount,
    },
  })
}

async function resolveProjectTeamUserIds(projectId: string): Promise<string[]> {
  const { getProjectTeam } = await import('@/lib/supabase-api')
  const team = await getProjectTeam(projectId)
  const ids = await Promise.all(
    team.map((member) =>
      resolveUserIdFromPmAssignee({
        assigneeEmployeeId: member.hrEmployeeId,
        assigneeName: member.name,
      })
    )
  )
  return [...new Set(ids.filter(Boolean) as string[])]
}

async function notifyPmProjectStakeholders(options: {
  projectId: string
  recipientUserIds: string[]
  notificationType: string
  title: string
  body: string
  dedupeKey: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  if (!options.recipientUserIds.length) return
  await notifyUsers({
    recipientUserIds: options.recipientUserIds,
    sourceModule: 'projects',
    notificationType: options.notificationType,
    title: options.title,
    body: options.body,
    linkPath: `/projects/${options.projectId}`,
    dedupeKey: options.dedupeKey,
    metadata: options.metadata,
    includeActor: true,
  })
}

export async function notifyPmProjectTeamAdded(options: {
  projectId: string
  projectName: string
  memberName: string
  hrEmployeeId?: string | null
}): Promise<void> {
  const recipient = await resolveUserIdFromPmAssignee({
    assigneeEmployeeId: options.hrEmployeeId,
    assigneeName: options.memberName,
  })
  await notifyUser(recipient, {
    sourceModule: 'projects',
    notificationType: 'project_team_added',
    title: 'Added to project team',
    body: `You were added to "${options.projectName}".`,
    linkPath: `/projects/${options.projectId}`,
    dedupeKey: `projects:team:${options.projectId}:${recipient ?? options.memberName}`,
    metadata: { project_id: options.projectId },
    includeActor: true,
  })
}

export async function notifyPmNewTaskOnProject(options: {
  projectId: string
  projectName: string
  taskId: string
  taskTitle: string
}): Promise<void> {
  const recipients = await resolveProjectTeamUserIds(options.projectId)
  await notifyPmProjectStakeholders({
    projectId: options.projectId,
    recipientUserIds: recipients,
    notificationType: 'project_task_created',
    title: 'New task on your project',
    body: `"${options.taskTitle}" was added to ${options.projectName}.`,
    dedupeKey: `projects:task:${options.taskId}:created:team`,
    metadata: { project_id: options.projectId, task_id: options.taskId },
  })
}

export async function notifyPmTaskCompletedForTeam(options: {
  projectId: string
  projectName: string
  taskId: string
  taskTitle: string
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
}): Promise<void> {
  const [teamIds, assigneeId] = await Promise.all([
    resolveProjectTeamUserIds(options.projectId),
    resolveUserIdFromPmAssignee(options),
  ])
  const recipients = [...new Set([...teamIds, ...(assigneeId ? [assigneeId] : [])])]
  await notifyPmProjectStakeholders({
    projectId: options.projectId,
    recipientUserIds: recipients,
    notificationType: 'project_task_completed',
    title: 'Task completed on your project',
    body: `"${options.taskTitle}" was marked done in ${options.projectName}.`,
    dedupeKey: `projects:task:${options.taskId}:done:team`,
    metadata: { project_id: options.projectId, task_id: options.taskId },
  })
}

export async function notifyPmSubtaskCreated(options: {
  projectId: string
  projectName: string
  taskId: string
  taskTitle: string
  subtaskTitle: string
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
}): Promise<void> {
  const [teamIds, assigneeId] = await Promise.all([
    resolveProjectTeamUserIds(options.projectId),
    resolveUserIdFromPmAssignee(options),
  ])
  const recipients = [...new Set([...teamIds, ...(assigneeId ? [assigneeId] : [])])]
  await notifyPmProjectStakeholders({
    projectId: options.projectId,
    recipientUserIds: recipients,
    notificationType: 'subtask_created',
    title: 'New subtask added',
    body: `"${options.subtaskTitle}" on "${options.taskTitle}" (${options.projectName}).`,
    dedupeKey: `projects:task:${options.taskId}:subtask:new:${options.subtaskTitle}`,
    metadata: { project_id: options.projectId, task_id: options.taskId },
  })
}

export async function notifyPmSubtaskCompleted(options: {
  projectId: string
  projectName: string
  taskId: string
  taskTitle: string
  subtaskTitle: string
  subtaskId?: string
  actorName?: string | null
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
}): Promise<void> {
  const [teamIds, assigneeId] = await Promise.all([
    resolveProjectTeamUserIds(options.projectId),
    resolveUserIdFromPmAssignee(options),
  ])
  const recipients = [...new Set([...teamIds, ...(assigneeId ? [assigneeId] : [])])]
  const who = options.actorName?.trim() || 'Someone'
  const dedupeKey = options.subtaskId
    ? `projects:task:${options.taskId}:subtask:${options.subtaskId}:done`
    : `projects:task:${options.taskId}:subtask:done:${options.subtaskTitle}`

  await notifyPmProjectStakeholders({
    projectId: options.projectId,
    recipientUserIds: recipients,
    notificationType: 'subtask_completed',
    title: 'Subtask completed',
    body: `${who} completed "${options.subtaskTitle}" on "${options.taskTitle}" (${options.projectName}).`,
    dedupeKey,
    metadata: { project_id: options.projectId, task_id: options.taskId },
  })
}

export async function notifyPmTaskPriorityChanged(options: {
  projectId: string
  taskId: string
  taskTitle: string
  newPriority: string
  assigneeEmployeeId?: string | null
  assigneeName?: string | null
}): Promise<void> {
  const recipient = await resolveUserIdFromPmAssignee(options)
  await notifyUser(recipient, {
    sourceModule: 'projects',
    notificationType: 'task_priority_changed',
    title: 'Task priority updated',
    body: `"${options.taskTitle}" is now ${options.newPriority} priority.`,
    linkPath: `/projects/${options.projectId}`,
    dedupeKey: `projects:task:${options.taskId}:priority:${options.newPriority}:${recipient ?? 'none'}`,
    metadata: {
      project_id: options.projectId,
      task_id: options.taskId,
      priority: options.newPriority,
    },
  })
}

export function assigneeChanged(
  before: Pick<Task, 'assigneeEmployeeId' | 'assignee' | 'assignees'> | undefined,
  after: Pick<Task, 'assigneeEmployeeId' | 'assignee' | 'assignees'>
): boolean {
  return assigneesChanged(before, after)
}

// —— HR ——

export async function notifyHrGoalAssigned(goal: Goal): Promise<void> {
  const recipient = await resolveUserIdFromHrEmployeeId(goal.employee_id)
  await notifyUser(recipient, {
    sourceModule: 'hr',
    notificationType: 'goal_assigned',
    title: 'New goal assigned',
    body: goal.goal,
    linkPath: '/employee/goals',
    dedupeKey: `hr:goal:${goal.id}`,
    metadata: { goal_id: goal.id, employee_id: goal.employee_id },
    includeActor: true,
  })
}

export async function notifyHrGoalReassigned(
  goal: Goal,
  previousEmployeeId?: string | null
): Promise<void> {
  if (!goal.employee_id || goal.employee_id === previousEmployeeId) return
  await notifyHrGoalAssigned(goal)
}

export async function notifyHrGoalBehind(goal: Pick<Goal, 'id' | 'employee_id' | 'goal'>): Promise<void> {
  const recipient = await resolveUserIdFromHrEmployeeId(goal.employee_id)
  await notifyUser(recipient, {
    sourceModule: 'hr',
    notificationType: 'goal_overdue',
    title: 'Goal is behind schedule',
    body: goal.goal,
    linkPath: '/employee/goals',
    dedupeKey: `hr:goal:${goal.id}:behind`,
    metadata: { goal_id: goal.id },
  })
}

export async function notifyHrTrainingAssigned(path: LearningPath): Promise<void> {
  const recipient = await resolveUserIdFromHrEmployeeId(path.employee_id)
  await notifyUser(recipient, {
    sourceModule: 'hr',
    notificationType: 'training_assigned',
    title: 'Training assigned',
    body: path.course,
    linkPath: '/employee/development',
    dedupeKey: `hr:training:${path.id}`,
    metadata: { learning_path_id: path.id },
  })
}

export async function notifyHrReviewScheduled(review: PerformanceReview): Promise<void> {
  const recipient = await resolveUserIdFromHrEmployeeId(review.employee_id)
  const due = review.review_date ? ` Scheduled ${review.review_date}.` : ''
  await notifyUser(recipient, {
    sourceModule: 'hr',
    notificationType: 'review_scheduled',
    title: 'Performance review scheduled',
    body: `${review.review_type} review${due}`,
    linkPath: '/employee/performance',
    dedupeKey: `hr:review:${review.id}`,
    metadata: { review_id: review.id },
    includeActor: true,
  })

  if (review.reviewer_id) {
    const reviewer = await resolveUserIdFromHrEmployeeId(review.reviewer_id)
    await notifyUser(reviewer, {
      sourceModule: 'hr',
      notificationType: 'review_reviewer_assigned',
      title: 'Review assigned to you',
      body: `${review.review_type} review for ${review.employee?.name ?? 'an employee'}${due}`,
      linkPath: '/hr',
      dedupeKey: `hr:review:${review.id}:reviewer`,
      metadata: { review_id: review.id },
      includeActor: true,
    })
  }
}

async function resolveHrStakeholderUserIds(): Promise<string[]> {
  return resolveModuleStakeholderUserIds('hr')
}

function formatHrDate(date: string | null | undefined): string {
  if (!date?.trim()) return 'TBD'
  const parsed = new Date(date.includes('T') ? date : `${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: date.includes('T') ? 'numeric' : undefined,
    minute: date.includes('T') ? '2-digit' : undefined,
  })
}

export async function notifyHrInterviewScheduled(options: {
  applicationId: string
  anonymousId?: string | null
  jobTitle?: string | null
  interviewDate: string
  isUpdate?: boolean
}): Promise<void> {
  const stakeholders = await resolveHrStakeholderUserIds()
  if (!stakeholders.length) return

  const candidate = options.anonymousId?.trim() || 'Candidate'
  const role = options.jobTitle?.trim() || 'open role'
  const when = formatHrDate(options.interviewDate)

  await notifyUsers({
    recipientUserIds: stakeholders,
    sourceModule: 'hr',
    notificationType: options.isUpdate ? 'hr_interview_updated' : 'hr_interview_scheduled',
    title: options.isUpdate ? 'Interview updated' : 'Interview scheduled',
    body: `${candidate} for ${role} · ${when}`,
    linkPath: '/hr',
    dedupeKey: `hr:interview:${options.applicationId}:${options.interviewDate.slice(0, 16)}`,
    metadata: { application_id: options.applicationId },
    includeActor: true,
  })
}

export async function notifyHrInterviewReminder(
  application: import('@/lib/recruitment-db').JobApplication,
  daysUntil: number
): Promise<void> {
  if (!application.id || !application.interviewDate) return

  const stakeholders = await resolveHrStakeholderUserIds()
  if (!stakeholders.length) return

  const candidate = application.anonymousId?.trim() || 'Candidate'
  const role = application.jobTitle?.trim() || 'open role'
  const when = formatHrDate(application.interviewDate)
  const today = new Date().toISOString().slice(0, 10)

  await notifyUsers({
    recipientUserIds: stakeholders,
    sourceModule: 'hr',
    notificationType: 'hr_interview_reminder',
    title: daysUntil === 0 ? 'Interview today' : 'Interview tomorrow',
    body: `${candidate} for ${role} · ${when}`,
    linkPath: '/hr',
    dedupeKey: `hr:interview:${application.id}:reminder:${today}:${daysUntil}`,
    metadata: { application_id: application.id },
  })
}

export async function notifyHrNewApplication(options: {
  applicationId: string
  jobTitle?: string | null
  anonymousId?: string | null
}): Promise<void> {
  const stakeholders = await resolveHrStakeholderUserIds()
  if (!stakeholders.length) return

  const role = options.jobTitle?.trim() || 'open role'
  const candidate = options.anonymousId?.trim() || 'New candidate'

  await notifyUsers({
    recipientUserIds: stakeholders,
    sourceModule: 'hr',
    notificationType: 'hr_application_received',
    title: 'New job application',
    body: `${candidate} applied for ${role}`,
    linkPath: '/hr',
    dedupeKey: `hr:application:${options.applicationId}`,
    metadata: { application_id: options.applicationId },
  })
}

// —— Candidate job applications (employee portal) ——

export async function notifyCandidateApplicationReceived(options: {
  recipientUserId: string
  applicationId: string
  jobTitle?: string | null
}): Promise<void> {
  const role = options.jobTitle?.trim() || 'the role'
  await notifyUser(options.recipientUserId, {
    sourceModule: 'hr',
    notificationType: 'job_application_received',
    title: 'Application submitted',
    body: `We received your application for ${role}.`,
    linkPath: '/employee/jobs',
    dedupeKey: `hr:job-app:${options.applicationId}:received`,
    metadata: {
      application_id: options.applicationId,
      job_title: options.jobTitle ?? null,
    },
  })
}

export async function notifyCandidateInterviewScheduled(options: {
  recipientUserId: string
  applicationId: string
  jobTitle?: string | null
  interviewDate?: string | null
  isUpdate?: boolean
}): Promise<void> {
  const role = options.jobTitle?.trim() || 'the role'
  const when = formatHrDate(options.interviewDate)
  await notifyUser(options.recipientUserId, {
    sourceModule: 'hr',
    notificationType: 'job_interview_scheduled',
    title: options.isUpdate ? 'Interview rescheduled' : 'Interview scheduled',
    body: `${role} · ${when}`,
    linkPath: '/employee/jobs',
    dedupeKey: `hr:job-app:${options.applicationId}:interview:${options.interviewDate?.slice(0, 16) ?? 'tbd'}`,
    metadata: {
      application_id: options.applicationId,
      interview_date: options.interviewDate ?? null,
      job_title: options.jobTitle ?? null,
    },
  })
}

export async function notifyCandidateOfferExtended(options: {
  recipientUserId: string
  applicationId: string
  jobTitle?: string | null
}): Promise<void> {
  const role = options.jobTitle?.trim() || 'the role'
  await notifyUser(options.recipientUserId, {
    sourceModule: 'hr',
    notificationType: 'job_offer_extended',
    title: 'Offer extended',
    body: `You received an offer for ${role}.`,
    linkPath: '/employee/jobs',
    dedupeKey: `hr:job-app:${options.applicationId}:offer`,
    metadata: {
      application_id: options.applicationId,
      job_title: options.jobTitle ?? null,
    },
  })
}

export async function notifyCandidateApplicationRejected(options: {
  recipientUserId: string
  applicationId: string
  jobTitle?: string | null
}): Promise<void> {
  const role = options.jobTitle?.trim() || 'the role'
  await notifyUser(options.recipientUserId, {
    sourceModule: 'hr',
    notificationType: 'job_application_rejected',
    title: 'Application update',
    body: `Your application for ${role} was not selected to move forward.`,
    linkPath: '/employee/jobs',
    dedupeKey: `hr:job-app:${options.applicationId}:rejected`,
    metadata: {
      application_id: options.applicationId,
      job_title: options.jobTitle ?? null,
    },
  })
}

export async function notifyHrTimeOffSubmitted(
  request: import('@/lib/hr-api').TimeOffRequest
): Promise<void> {
  const stakeholders = await resolveHrStakeholderUserIds()
  if (!stakeholders.length) return

  const employeeName = request.employee?.name ?? 'An employee'
  const range = `${formatHrDate(request.start_date)} – ${formatHrDate(request.end_date)}`

  await notifyUsers({
    recipientUserIds: stakeholders,
    sourceModule: 'hr',
    notificationType: 'hr_time_off_submitted',
    title: 'Time off request submitted',
    body: `${employeeName} · ${request.type} · ${range}`,
    linkPath: '/hr',
    dedupeKey: `hr:timeoff:${request.id}:submitted`,
    metadata: { time_off_id: request.id, employee_id: request.employee_id },
    includeActor: true,
  })
}

export async function notifyHrTimeOffDecided(
  request: import('@/lib/hr-api').TimeOffRequest
): Promise<void> {
  const recipient = await resolveUserIdFromHrEmployeeId(request.employee_id)
  if (!recipient) return

  const range = `${formatHrDate(request.start_date)} – ${formatHrDate(request.end_date)}`
  const approved = request.status === 'Approved'

  await notifyUser(recipient, {
    sourceModule: 'hr',
    notificationType: approved ? 'hr_time_off_approved' : 'hr_time_off_denied',
    title: approved ? 'Time off approved' : 'Time off denied',
    body: `${request.type} · ${range}${request.manager_notes?.trim() ? ` — ${request.manager_notes.trim()}` : ''}`,
    linkPath: '/employee',
    dedupeKey: `hr:timeoff:${request.id}:${request.status}`,
    metadata: { time_off_id: request.id },
  })
}

export async function notifyHrRecognitionReceived(
  recognition: import('@/lib/hr-api').Recognition
): Promise<void> {
  const recipient = await resolveUserIdFromHrEmployeeId(recognition.to_id)
  await notifyUser(recipient, {
    sourceModule: 'hr',
    notificationType: 'hr_recognition_received',
    title: 'You received recognition',
    body: `${recognition.from_name}: ${recognition.message}`,
    linkPath: '/employee',
    dedupeKey: `hr:recognition:${recognition.id}`,
    metadata: { recognition_id: recognition.id },
    includeActor: true,
  })
}

// —— Know Your Investor (KYI) ——

async function resolveKyiStakeholderUserIds(): Promise<string[]> {
  return resolveModuleStakeholderUserIds('kyi')
}

export async function notifyKyiLeadsAddedToPool(options: {
  count: number
  needsGeocodeCount?: number | null
  importBatchKey?: string | null
}): Promise<void> {
  const count = Math.max(0, options.count)
  if (count <= 0) return

  const stakeholders = await resolveKyiStakeholderUserIds()
  if (!stakeholders.length) return

  const dedupeKey =
    options.importBatchKey?.trim() ||
    `kyi:leads:import:${new Date().toISOString().slice(0, 16)}`

  let body = `${count} new lead${count === 1 ? '' : 's'} added to the pool. Review and geocode unmapped leads in Know Your Investor.`
  if (options.needsGeocodeCount != null && options.needsGeocodeCount > 0) {
    body += ` ${options.needsGeocodeCount} need geocoding.`
  }

  await notifyUsers({
    recipientUserIds: stakeholders,
    sourceModule: 'kyi',
    notificationType: 'kyi_leads_added',
    title: 'New leads in the pool',
    body,
    linkPath: '/kyi',
    dedupeKey,
    metadata: {
      lead_count: count,
      needs_geocode_count: options.needsGeocodeCount ?? null,
    },
    includeActor: true,
  })
}

export async function notifyKyiInvestorAdded(options: {
  companyId: number
  companyName?: string | null
  investorId: number
  investorName: string
  segmentType?: string | null
  sourceLeadId?: number | null
  addedViaOrbit?: boolean
}): Promise<void> {
  const stakeholders = await resolveKyiStakeholderUserIds()
  if (!stakeholders.length) return

  const seg = (options.segmentType ?? 'current_investor').toLowerCase()
  const companyLabel = options.companyName?.trim() || 'your company'
  const name = options.investorName.trim() || 'Investor'

  let title = 'Investor added to KYI'
  let notificationType = 'kyi_investor_added'
  let body = `${name} · ${companyLabel}`

  if (seg === 'targeted_investor') {
    title = options.sourceLeadId ? 'Lead added to targeted list' : 'Targeted investor added'
    notificationType = options.sourceLeadId ? 'kyi_lead_landed' : 'kyi_targeted_investor_added'
    body = options.sourceLeadId
      ? `${name} was added to targeted investors from the lead pool (${companyLabel}).`
      : `${name} was added to targeted investors (${companyLabel}).`
  } else if (seg === 'employee') {
    title = 'Team member added to KYI'
    notificationType = 'kyi_employee_added'
    body = `${name} was added to ${companyLabel}.`
  } else if (options.addedViaOrbit) {
    title = 'Investor added via Orbit'
    notificationType = 'kyi_orbit_investor_added'
    body = `${name} was added from Investor Orbit (${companyLabel}).`
  }

  await notifyUsers({
    recipientUserIds: stakeholders,
    sourceModule: 'kyi',
    notificationType,
    title,
    body,
    linkPath: `/kyi/companies/${options.companyId}`,
    dedupeKey: `kyi:investor:${options.investorId}:added`,
    metadata: {
      company_id: options.companyId,
      investor_id: options.investorId,
      source_lead_id: options.sourceLeadId ?? null,
      segment_type: seg,
    },
    includeActor: true,
  })
}

/** Call RPC after automated CI import (service role). Falls back to client notify when RPC missing. */
export async function notifyKyiLeadsImportedViaRpc(options: {
  leadCount: number
  needsGeocodeCount?: number | null
  importBatchKey?: string | null
}): Promise<void> {
  if (options.leadCount <= 0) return

  const { supabase, isSupabaseConfigured } = await import('@/lib/supabase')
  if (!isSupabaseConfigured) return

  const batchKey =
    options.importBatchKey?.trim() ||
    new Date().toISOString().slice(0, 16)

  const { error } = await supabase.rpc('notify_kyi_leads_imported', {
    p_lead_count: options.leadCount,
    p_needs_geocode_count: options.needsGeocodeCount ?? null,
    p_import_batch_key: batchKey,
  })

  if (!error) return

  await notifyKyiLeadsAddedToPool({
    count: options.leadCount,
    needsGeocodeCount: options.needsGeocodeCount,
    importBatchKey: batchKey,
  })
}

// —— Customer Success ——

type ClientCsmContext = Pick<Client, 'id' | 'name' | 'csm_id' | 'renewal_date'> | null | undefined

async function resolveClientCsmUserId(client: ClientCsmContext): Promise<string | null> {
  if (!client?.csm_id) return null
  return resolveUserIdFromCsmId(client.csm_id)
}

async function resolveClientNotificationRecipients(client: ClientCsmContext): Promise<string[]> {
  const csm = await resolveClientCsmUserId(client)
  if (csm) return [csm]
  return resolveModuleStakeholderUserIds('customer_success')
}

/** Client's assigned CSM plus optional task assignee (deduped auth user ids). */
async function resolveCsTaskRecipientUserIds(task: ClientTask): Promise<string[]> {
  const ids: string[] = []
  const clientCsm = await resolveClientCsmUserId(task.client)
  if (clientCsm) ids.push(clientCsm)
  if (task.assigned_to) {
    const assignee = await resolveUserIdFromCsmId(task.assigned_to)
    if (assignee) ids.push(assignee)
  }
  return [...new Set(ids)]
}

async function resolveCsMilestoneRecipientUserIds(
  milestone: ClientMilestone
): Promise<string[]> {
  const clientCsm = await resolveClientCsmUserId(milestone.client)
  return clientCsm ? [clientCsm] : []
}

async function resolveCsInteractionRecipientUserIds(
  interaction: ClientInteraction
): Promise<string[]> {
  const clientCsm = await resolveClientCsmUserId(interaction.client)
  if (clientCsm) return [clientCsm]
  const interactionCsm = await resolveUserIdFromCsmId(interaction.csm_id)
  return interactionCsm ? [interactionCsm] : []
}

function formatCsDate(date: string | null | undefined): string {
  if (!date?.trim()) return 'TBD'
  const parsed = new Date(date.includes('T') ? date : `${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function interactionTypeLabel(type: ClientInteraction['type']): string {
  if (type === 'meeting') return 'Meeting'
  if (type === 'call') return 'Call'
  if (type === 'note') return 'Note'
  return 'Email'
}

function csClientLink(clientId: string | null | undefined, tab: 'clients' | 'tasks' | 'interactions' = 'clients'): string {
  if (clientId) return customerSuccessClientPath(clientId, tab)
  return '/customer-success'
}

export async function notifyCsTaskCreated(task: ClientTask): Promise<void> {
  const recipients = await resolveCsTaskRecipientUserIds(task)
  if (!recipients.length) return

  const clientName = task.client?.name ?? 'a client'
  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_task_created',
    title: 'New customer task',
    body: `"${task.title}" for ${clientName} · due ${formatCsDate(task.due_date)}`,
    linkPath: csClientLink(task.client_id, 'tasks'),
    dedupeKey: `cs:task:${task.id}:created`,
    metadata: { task_id: task.id, client_id: task.client_id },
    includeActor: true,
  })
}

export async function notifyCsTaskAssigned(
  task: ClientTask,
  previousAssigneeId?: string | null
): Promise<void> {
  const assignee = task.assigned_to
  if (!assignee || assignee === previousAssigneeId) return

  const recipients = await resolveCsTaskRecipientUserIds(task)
  if (!recipients.length) return

  const clientName = task.client?.name ?? 'a client'
  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_task_assigned',
    title: 'Customer task assigned',
    body: `"${task.title}" for ${clientName}`,
    linkPath: csClientLink(task.client_id, 'tasks'),
    dedupeKey: `cs:task:${task.id}:assign:${assignee}`,
    metadata: { task_id: task.id, client_id: task.client_id },
    includeActor: true,
  })
}

export async function notifyCsTaskStatusChanged(
  task: ClientTask,
  previousStatus?: string | null
): Promise<void> {
  if (!previousStatus || task.status === previousStatus) return

  const recipients = await resolveCsTaskRecipientUserIds(task)
  if (!recipients.length) return

  const clientName = task.client?.name ?? 'a client'
  const statusLabel = task.status.replace(/-/g, ' ')
  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_task_status_changed',
    title: 'Customer task updated',
    body: `"${task.title}" for ${clientName} is now ${statusLabel}.`,
    linkPath: csClientLink(task.client_id, 'tasks'),
    dedupeKey: `cs:task:${task.id}:status:${task.status}`,
    metadata: { task_id: task.id, client_id: task.client_id, status: task.status },
  })
}

export async function notifyCsTaskOverdue(task: ClientTask): Promise<void> {
  const recipients = await resolveCsTaskRecipientUserIds(task)
  if (!recipients.length) return

  const clientName = task.client?.name ?? 'a client'
  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_task_overdue',
    title: 'Customer task overdue',
    body: `"${task.title}" for ${clientName} was due ${formatCsDate(task.due_date)}.`,
    linkPath: csClientLink(task.client_id, 'tasks'),
    dedupeKey: `cs:task:${task.id}:overdue`,
    metadata: { task_id: task.id, client_id: task.client_id },
  })
}

export async function notifyCsMilestoneCreated(milestone: ClientMilestone): Promise<void> {
  const recipients = await resolveCsMilestoneRecipientUserIds(milestone)
  if (!recipients.length) return

  const clientName = milestone.client?.name ?? 'a client'
  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_milestone_created',
    title: 'Customer milestone added',
    body: `"${milestone.title}" for ${clientName} · target ${formatCsDate(milestone.target_date)}`,
    linkPath: csClientLink(milestone.client_id, 'clients'),
    dedupeKey: `cs:milestone:${milestone.id}:created`,
    metadata: { milestone_id: milestone.id, client_id: milestone.client_id },
    includeActor: true,
  })
}

export async function notifyCsMilestoneUpdated(
  milestone: ClientMilestone,
  previous?: Pick<ClientMilestone, 'status' | 'target_date' | 'title'>
): Promise<void> {
  const recipients = await resolveCsMilestoneRecipientUserIds(milestone)
  if (!recipients.length || !previous) return

  const clientName = milestone.client?.name ?? 'a client'

  if (previous.status !== milestone.status) {
    const statusLabel = milestone.status.replace(/-/g, ' ')
    await notifyUsers({
      recipientUserIds: recipients,
      sourceModule: 'customer_success',
      notificationType: 'cs_milestone_status_changed',
      title: 'Milestone status updated',
      body: `"${milestone.title}" for ${clientName} is now ${statusLabel}.`,
      linkPath: csClientLink(milestone.client_id, 'clients'),
      dedupeKey: `cs:milestone:${milestone.id}:status:${milestone.status}`,
      metadata: { milestone_id: milestone.id, client_id: milestone.client_id },
    })
  }

  if (previous.target_date !== milestone.target_date) {
    await notifyUsers({
      recipientUserIds: recipients,
      sourceModule: 'customer_success',
      notificationType: 'cs_milestone_rescheduled',
      title: 'Milestone date updated',
      body: `"${milestone.title}" for ${clientName} · target ${formatCsDate(milestone.target_date)}`,
      linkPath: csClientLink(milestone.client_id, 'clients'),
      dedupeKey: `cs:milestone:${milestone.id}:date:${milestone.target_date}`,
      metadata: { milestone_id: milestone.id, client_id: milestone.client_id },
    })
  }
}

export async function notifyCsFollowUpScheduled(options: {
  client: Client
  previousRenewalDate?: string | null
}): Promise<void> {
  const { client, previousRenewalDate } = options
  if (!client.renewal_date || client.renewal_date === previousRenewalDate) return

  const recipients = await resolveClientNotificationRecipients(client)
  if (!recipients.length) return

  const isNew = !previousRenewalDate?.trim()
  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: 'cs_follow_up_scheduled',
    title: isNew ? 'Follow-up scheduled' : 'Follow-up date updated',
    body: `${client.name} · next follow-up ${formatCsDate(client.renewal_date)}`,
    linkPath: csClientLink(client.id),
    dedupeKey: `cs:client:${client.id}:followup:${client.renewal_date.slice(0, 10)}`,
    metadata: { client_id: client.id, follow_up_date: client.renewal_date },
    includeActor: true,
  })
}

export async function notifyCsClientUpdate(options: {
  client: Client
  previousCsmId?: string | null
  previousStatus?: string
  previousHealthScore?: number
  previousRenewalDate?: string | null
}): Promise<void> {
  const { client, previousCsmId, previousStatus, previousHealthScore, previousRenewalDate } =
    options
  const recipients = await resolveClientNotificationRecipients(client)
  if (!recipients.length) return

  if (client.csm_id && client.csm_id !== previousCsmId) {
    const assignee = await resolveUserIdFromCsmId(client.csm_id)
    if (assignee) {
      await notifyUser(assignee, {
        sourceModule: 'customer_success',
        notificationType: 'cs_client_assigned',
        title: 'Client assigned to you',
        body: client.name,
        linkPath: csClientLink(client.id),
        dedupeKey: `cs:client:${client.id}:csm:${client.csm_id}`,
        metadata: { client_id: client.id },
        includeActor: true,
      })
    }
  }

  await notifyCsFollowUpScheduled({ client, previousRenewalDate })

  if (previousStatus && client.status === 'at-risk' && previousStatus !== 'at-risk') {
    await notifyUsers({
      recipientUserIds: recipients,
      sourceModule: 'customer_success',
      notificationType: 'cs_client_at_risk',
      title: 'Client health at risk',
      body: `${client.name} needs attention.`,
      linkPath: csClientLink(client.id),
      dedupeKey: `cs:client:${client.id}:at-risk`,
      metadata: { client_id: client.id },
    })
  }

  if (
    previousHealthScore != null &&
    client.health_score < previousHealthScore - 14
  ) {
    await notifyUsers({
      recipientUserIds: recipients,
      sourceModule: 'customer_success',
      notificationType: 'cs_health_drop',
      title: 'Client health score dropped',
      body: `${client.name} is now ${client.health_score}% (was ${previousHealthScore}%).`,
      linkPath: csClientLink(client.id),
      dedupeKey: `cs:client:${client.id}:health:${client.health_score}`,
      metadata: { client_id: client.id },
    })
  }

  const renewal = client.renewal_date
  if (renewal) {
    const days = Math.ceil(
      (new Date(renewal).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (days >= 0 && days <= 30) {
      await notifyUsers({
        recipientUserIds: recipients,
        sourceModule: 'customer_success',
        notificationType: 'cs_renewal_soon',
        title: 'Follow-up coming up',
        body: `${client.name} follow-up in ${days} day${days === 1 ? '' : 's'} (${formatCsDate(renewal)}).`,
        linkPath: csClientLink(client.id),
        dedupeKey: `cs:client:${client.id}:followup-soon:${renewal.slice(0, 10)}`,
        metadata: { client_id: client.id },
      })
    }
  }
}

export async function notifyCsNewClientForCsm(client: Client): Promise<void> {
  if (!client.csm_id) return
  await notifyCsClientUpdate({ client, previousCsmId: null })
}

export async function notifyCsInteractionLogged(
  interaction: ClientInteraction
): Promise<void> {
  const recipients = await resolveCsInteractionRecipientUserIds(interaction)
  if (!recipients.length) return

  const clientName = interaction.client?.name ?? 'a client'
  const typeLabel = interactionTypeLabel(interaction.type)
  const isMeeting = interaction.type === 'meeting'

  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: isMeeting ? 'cs_meeting_scheduled' : 'cs_interaction',
    title: isMeeting ? 'Meeting scheduled' : 'New client interaction',
    body: isMeeting
      ? `${interaction.subject} with ${clientName} · ${formatCsDate(interaction.interaction_date)}`
      : `${typeLabel}: ${interaction.subject} (${clientName})`,
    linkPath: csClientLink(interaction.client_id, 'interactions'),
    dedupeKey: `cs:interaction:${interaction.id}:created`,
    metadata: {
      interaction_id: interaction.id,
      client_id: interaction.client_id,
      interaction_type: interaction.type,
    },
    includeActor: true,
  })
}

export async function notifyCsInteractionUpdated(
  interaction: ClientInteraction,
  previous?: Pick<ClientInteraction, 'type' | 'subject' | 'interaction_date'>
): Promise<void> {
  if (!previous) return

  const recipients = await resolveCsInteractionRecipientUserIds(interaction)
  if (!recipients.length) return

  const clientName = interaction.client?.name ?? 'a client'
  const dateChanged = previous.interaction_date !== interaction.interaction_date
  const typeChanged = previous.type !== interaction.type
  const subjectChanged = previous.subject !== interaction.subject

  if (!dateChanged && !typeChanged && !subjectChanged) return

  const isMeeting = interaction.type === 'meeting'
  const typeLabel = interactionTypeLabel(interaction.type)

  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'customer_success',
    notificationType: isMeeting ? 'cs_meeting_updated' : 'cs_interaction_updated',
    title: isMeeting ? 'Meeting updated' : 'Interaction updated',
    body: isMeeting
      ? `${interaction.subject} with ${clientName} · ${formatCsDate(interaction.interaction_date)}`
      : `${typeLabel}: ${interaction.subject} (${clientName})`,
    linkPath: csClientLink(interaction.client_id, 'interactions'),
    dedupeKey: `cs:interaction:${interaction.id}:updated:${interaction.interaction_date}:${interaction.type}`,
    metadata: {
      interaction_id: interaction.id,
      client_id: interaction.client_id,
      interaction_type: interaction.type,
    },
  })
}

// —— Inventory ——

export async function notifyInventoryPurchaseOrder(options: {
  po: PurchaseOrder
  previousStatus?: string
  event: 'created' | 'status_changed'
}): Promise<void> {
  const stakeholders = await resolveModuleStakeholderUserIds('inventory')
  if (!stakeholders.length) return

  const poLabel = options.po.po_number ?? options.po.id
  let title = 'New purchase order'
  let body = `PO ${poLabel} was created.`
  if (options.event === 'status_changed' && options.previousStatus) {
    title = 'Purchase order updated'
    body = `PO ${poLabel}: ${options.previousStatus} → ${options.po.status}.`
  }

  await notifyUsers({
    recipientUserIds: stakeholders,
    sourceModule: 'inventory',
    notificationType: options.event === 'created' ? 'po_created' : 'po_status_changed',
    title,
    body,
    linkPath: `/inventory/purchase-orders/${options.po.id}`,
    dedupeKey: `inventory:po:${options.po.id}:${options.po.status}`,
    metadata: { po_id: options.po.id, status: options.po.status },
  })
}

export async function notifyInventoryLowStock(options: {
  item: InventoryItem
  actorName?: string
}): Promise<void> {
  const stakeholders = await resolveModuleStakeholderUserIds('inventory')
  if (!stakeholders.length) return

  await notifyUsers({
    recipientUserIds: stakeholders,
    sourceModule: 'inventory',
    notificationType: 'low_stock',
    title: 'Low stock alert',
    body: `${options.item.product_name} (${options.item.sku}) is at ${options.item.on_hand_qty} on hand.`,
    linkPath: `/inventory/items/${options.item.id}`,
    dedupeKey: `inventory:low:${options.item.id}:${options.item.on_hand_qty}`,
    metadata: { item_id: options.item.id },
  })
}

export async function notifyInventoryCheckOut(options: {
  item: InventoryItem
  quantity: number
  userName?: string
}): Promise<void> {
  const available = options.item.on_hand_qty - options.item.allocated
  const isLow =
    options.item.min_qty > 0 && available <= options.item.min_qty

  if (isLow) {
    await notifyInventoryLowStock({ item: options.item })
    return
  }

  const stakeholders = await resolveModuleStakeholderUserIds('inventory')
  if (!stakeholders.length) return

  await notifyUsers({
    recipientUserIds: stakeholders,
    sourceModule: 'inventory',
    notificationType: 'inventory_checkout',
    title: 'Inventory checked out',
    body: `${options.quantity}× ${options.item.product_name}${options.userName ? ` by ${options.userName}` : ''}.`,
    linkPath: `/inventory/items/${options.item.id}`,
    dedupeKey: `inventory:checkout:${options.item.id}:${Date.now().toString().slice(0, 13)}`,
    metadata: { item_id: options.item.id, quantity: options.quantity },
  })
}

export async function notifyWfmJobAssigned(
  job: Job,
  previousTechnicianId?: string | null
): Promise<void> {
  const techId = job.technician_id
  if (!techId || techId === previousTechnicianId) return

  const recipient = await resolveUserIdFromTechnicianId(techId)
  const techName = job.technician?.name ?? 'you'
  await notifyUser(recipient, {
    sourceModule: 'workforce',
    notificationType: 'job_assigned',
    title: 'Job assigned to you',
    body: `${job.title}${techName !== 'you' ? ` (${techName})` : ''}`,
    linkPath: myWorkDeepLink(job.id),
    dedupeKey: `wfm:job:${job.id}:tech:${techId}`,
    metadata: { job_id: job.id },
  })
}

export async function notifyWfmScheduleChange(
  schedule: Schedule,
  event: 'created' | 'updated'
): Promise<void> {
  const recipient = await resolveUserIdFromTechnicianId(schedule.technician_id)
  const jobTitle = schedule.job?.title ?? 'a job'
  const date = schedule.schedule_date
  await notifyUser(recipient, {
    sourceModule: 'workforce',
    notificationType: event === 'created' ? 'schedule_created' : 'schedule_updated',
    title: event === 'created' ? 'New schedule entry' : 'Schedule updated',
    body: `${jobTitle} on ${date}`,
    linkPath: schedule.job_id ? myWorkDeepLink(schedule.job_id) : myWorkDeepLink(),
    dedupeKey: `wfm:schedule:${schedule.id}:${event}`,
    metadata: { schedule_id: schedule.id, job_id: schedule.job_id },
  })
}

export async function notifyWfmJobRescheduled(
  job: Job,
  previousStart?: string | null,
  previousEnd?: string | null
): Promise<void> {
  if (job.start_date === previousStart && job.end_date === previousEnd) return
  const recipient = await resolveUserIdFromTechnicianId(job.technician_id)
  await notifyUser(recipient, {
    sourceModule: 'workforce',
    notificationType: 'job_rescheduled',
    title: 'Job schedule changed',
    body: `${job.title}: ${job.start_date ?? 'TBD'} – ${job.end_date ?? 'TBD'}`,
    linkPath: myWorkDeepLink(job.id),
    dedupeKey: `wfm:job:${job.id}:dates:${job.start_date}:${job.end_date}`,
    metadata: { job_id: job.id },
  })
}

export async function notifyWfmJobCrewAssigned(options: {
  jobId: string
  jobTitle: string
  technicianIds: string[]
  previousTechnicianIds?: string[]
}): Promise<void> {
  const previous = new Set(options.previousTechnicianIds ?? [])
  const newlyAssigned = options.technicianIds.filter((id) => !previous.has(id))
  if (!newlyAssigned.length) return

  await Promise.all(
    newlyAssigned.map(async (technicianId) => {
      const recipient = await resolveUserIdFromTechnicianId(technicianId)
      await notifyUser(recipient, {
        sourceModule: 'workforce',
        notificationType: 'job_crew_assigned',
        title: 'Added to job crew',
        body: `You were assigned to "${options.jobTitle}".`,
        linkPath: '/workforce',
        dedupeKey: `wfm:job:${options.jobId}:crew:${technicianId}`,
        metadata: { job_id: options.jobId, technician_id: technicianId },
        includeActor: true,
      })
    })
  )
}

// —— Katana Support ——

export async function notifySupportNewSubmission(submission: SupportSubmission): Promise<void> {
  const operators = await resolveKatanaPlatformOperatorUserIds()
  if (!operators.length) return

  const orgLabel = submission.organization_name?.trim() || 'A pilot organization'
  const typeLabel = submission.submission_type === 'issue' ? 'Issue' : 'Feedback'

  await notifyUsers({
    recipientUserIds: operators,
    sourceModule: 'support',
    notificationType: 'support_submission_created',
    title: 'New support submission',
    body: `${typeLabel}: "${submission.subject}" from ${orgLabel}`,
    linkPath: '/support',
    dedupeKey: `support:submission:${submission.id}:created`,
    metadata: {
      submission_id: submission.id,
      organization_id: submission.organization_id,
    },
  })
}

export async function notifySupportSubmissionUpdated(options: {
  submission: SupportSubmission
  previousStatus?: SubmissionStatus
  previousPriority?: string
  previousAssignedToUserId?: string | null
  actorUserId?: string | null
}): Promise<void> {
  const { submission, previousStatus, previousPriority, previousAssignedToUserId, actorUserId } =
    options
  const submitterId = submission.submitter_user_id

  if (previousStatus && submission.status !== previousStatus) {
    const statusLabel = SUBMISSION_STATUS_LABELS[submission.status] ?? submission.status
    await notifyUser(submitterId, {
      sourceModule: 'support',
      notificationType: 'support_status_changed',
      title: 'Support ticket updated',
      body: `"${submission.subject}" is now ${statusLabel}.`,
      linkPath: '/support',
      dedupeKey: `support:submission:${submission.id}:status:${submission.status}`,
      metadata: { submission_id: submission.id, status: submission.status },
      actorUserId,
      includeActor: true,
    })
  }

  if (previousPriority && submission.priority !== previousPriority) {
    await notifyUser(submitterId, {
      sourceModule: 'support',
      notificationType: 'support_priority_changed',
      title: 'Support ticket priority updated',
      body: `"${submission.subject}" priority is now ${submission.priority}.`,
      linkPath: '/support',
      dedupeKey: `support:submission:${submission.id}:priority:${submission.priority}`,
      metadata: { submission_id: submission.id, priority: submission.priority },
      actorUserId,
      includeActor: true,
    })
  }

  const assigneeId = submission.assigned_to_user_id
  if (
    assigneeId &&
    assigneeId !== previousAssignedToUserId &&
    assigneeId !== submitterId
  ) {
    await notifyUser(assigneeId, {
      sourceModule: 'support',
      notificationType: 'support_assigned',
      title: 'Support ticket assigned to you',
      body: `"${submission.subject}" from ${submission.submitter_name}`,
      linkPath: '/support',
      dedupeKey: `support:submission:${submission.id}:assign:${assigneeId}`,
      metadata: { submission_id: submission.id },
      actorUserId,
      includeActor: true,
    })
  }
}

export async function notifyFinanceUncategorizedReview(options: {
  uncategorizedCount: number
}): Promise<void> {
  if (options.uncategorizedCount <= 0) return

  const recipients = await resolveModuleStakeholderUserIds('finance')
  if (recipients.length === 0) return

  await notifyUsers({
    recipientUserIds: recipients,
    sourceModule: 'finance',
    notificationType: 'uncategorized_transactions',
    title: 'Transactions need categorization',
    body: `${options.uncategorizedCount} bank transaction${options.uncategorizedCount === 1 ? '' : 's'} need review in Finance.`,
    linkPath: '/finance?tab=transactions',
    dedupeKey: `finance:uncategorized:${options.uncategorizedCount}`,
    metadata: { uncategorized_count: options.uncategorizedCount },
  })
}

export type { Technician }
