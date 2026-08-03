/**
 * Worker-facing Workforce API — used by Launchpad "My Work" and mobile clock-in flows.
 */

import { getTodayDateKey } from './due-date-utils'
import { checkoutJobPartsOnCompletion } from './wfm-integrations'
import { workforceTabPath } from './wfm-deep-links'
import {
  clockIn,
  clockOut,
  getJobs,
  getTechnicians,
  getTimesheets,
  updateJob,
  type Job,
  type Technician,
  type Timesheet,
} from './wfm-api'
import { isSupabaseConfigured } from './supabase'

export interface WfmMyWorkItem {
  id: string
  jobNumber: string
  title: string
  status: Job['status']
  priority: Job['priority']
  startDate: string | null
  endDate: string | null
  locationAddress: string | null
  customerName: string | null
  clientId: string | null
}

export interface WfmWorkerSession {
  technician: Technician
  openTimesheet: Timesheet | null
  activeJobId: string | null
}

export interface WfmWorkerActionResult {
  ok: boolean
  error?: string
  job?: Job | null
  timesheet?: Timesheet | null
  partsCheckedOut?: number
}

/** Match HR employee to workforce roster (employee_id, auth user, email, then name). */
export async function resolveTechnicianForEmployee(input: {
  employeeId: string
  email?: string | null
  name?: string | null
  authUserId?: string | null
}): Promise<Technician | null> {
  if (!isSupabaseConfigured) return null

  const technicians = await getTechnicians()
  const byEmployee = technicians.find((t) => t.employee_id === input.employeeId)
  if (byEmployee) return byEmployee

  const authUserId = input.authUserId?.trim()
  if (authUserId) {
    const byUser = technicians.find(
      (t) => (t as { user_id?: string | null }).user_id === authUserId,
    )
    if (byUser) return byUser
  }

  const email = input.email?.trim().toLowerCase()
  if (email) {
    const byEmail = technicians.find((t) => t.email?.trim().toLowerCase() === email)
    if (byEmail) return byEmail
  }

  const name = input.name?.trim().toLowerCase()
  if (name) {
    const byName = technicians.find((t) => t.name?.trim().toLowerCase() === name)
    if (byName) return byName
  }

  return null
}

export async function getMyWorkItems(technicianId: string): Promise<WfmMyWorkItem[]> {
  const jobs = await getJobs()
  const today = getTodayDateKey()

  return jobs
    .filter(
      (j) =>
        j.technician_id === technicianId &&
        j.is_active &&
        j.status !== 'cancelled' &&
        j.status !== 'completed',
    )
    .sort((a, b) => {
      const aOverdue = a.end_date && a.end_date < today ? 0 : 1
      const bOverdue = b.end_date && b.end_date < today ? 0 : 1
      if (aOverdue !== bOverdue) return aOverdue - bOverdue
      return (a.start_date ?? '').localeCompare(b.start_date ?? '')
    })
    .map(mapJobToMyWorkItem)
}

export function mapJobToMyWorkItem(job: Job): WfmMyWorkItem {
  return {
    id: job.id,
    jobNumber: job.job_number,
    title: job.title,
    status: job.status,
    priority: job.priority,
    startDate: job.start_date,
    endDate: job.end_date,
    locationAddress: job.location_address,
    customerName: job.customer_name,
    clientId: job.client_id,
  }
}

export async function getWorkerSession(technicianId: string): Promise<WfmWorkerSession | null> {
  const technicians = await getTechnicians()
  const technician = technicians.find((t) => t.id === technicianId)
  if (!technician) return null

  const timesheets = await getTimesheets(technicianId)
  const openTimesheet = timesheets.find((t) => !t.clock_out) ?? null

  return {
    technician,
    openTimesheet,
    activeJobId: openTimesheet?.job_id ?? null,
  }
}

export function myWorkDeepLink(jobId?: string): string {
  if (!jobId) return '/employee/work'
  return `/employee/work?job=${encodeURIComponent(jobId)}`
}

export function isWorkItemOverdue(item: WfmMyWorkItem, today = getTodayDateKey()): boolean {
  return Boolean(item.endDate && item.endDate < today && item.status !== 'completed')
}

export function isWorkItemDueToday(item: WfmMyWorkItem, today = getTodayDateKey()): boolean {
  return item.startDate === today || item.endDate === today
}

async function closeOpenTimesheet(timesheet: Timesheet): Promise<Timesheet | null> {
  return clockOut(timesheet.id)
}

/** Clock in on a job (or general) and mark job in progress when jobId provided. */
export async function workerStartJob(
  technicianId: string,
  jobId: string,
): Promise<WfmWorkerActionResult> {
  const session = await getWorkerSession(technicianId)
  if (!session) return { ok: false, error: 'Worker session not found' }

  if (session.openTimesheet && session.openTimesheet.job_id !== jobId) {
    await closeOpenTimesheet(session.openTimesheet)
  }

  const job = await updateJob(jobId, { status: 'in-progress', technician_id: technicianId })
  if (!job) return { ok: false, error: 'Could not start work item' }

  let timesheet = session.openTimesheet?.job_id === jobId ? session.openTimesheet : null
  if (!timesheet) {
    timesheet = await clockIn(technicianId, jobId, `Started ${job.job_number}`)
  }

  return { ok: true, job, timesheet }
}

/** Mark complete, clock out, and check out parts. */
export async function workerCompleteJob(
  technicianId: string,
  jobId: string,
): Promise<WfmWorkerActionResult> {
  const session = await getWorkerSession(technicianId)
  if (!session) return { ok: false, error: 'Worker session not found' }

  const job = await updateJob(jobId, { status: 'completed' })
  if (!job) return { ok: false, error: 'Could not complete work item' }

  let timesheet: Timesheet | null = null
  if (session.openTimesheet?.job_id === jobId) {
    timesheet = await clockOut(session.openTimesheet.id, `Completed ${job.job_number}`)
  } else {
    const sheets = await getTimesheets(technicianId, jobId)
    const open = sheets.find((t) => !t.clock_out)
    if (open) timesheet = await clockOut(open.id, `Completed ${job.job_number}`)
  }

  const parts = await checkoutJobPartsOnCompletion(jobId)

  return {
    ok: true,
    job,
    timesheet,
    partsCheckedOut: parts.checkedOut,
    error: parts.errors.length > 0 ? parts.errors.join('; ') : undefined,
  }
}

/** Pause work — set on hold without clocking out. */
export async function workerHoldJob(jobId: string): Promise<WfmWorkerActionResult> {
  const job = await updateJob(jobId, { status: 'on-hold' })
  if (!job) return { ok: false, error: 'Could not update status' }
  return { ok: true, job }
}

/** General clock-in (no specific job). */
export async function workerClockIn(
  technicianId: string,
  jobId?: string | null,
): Promise<WfmWorkerActionResult> {
  const session = await getWorkerSession(technicianId)
  if (!session) return { ok: false, error: 'Worker session not found' }
  if (session.openTimesheet) {
    return { ok: true, timesheet: session.openTimesheet, error: 'Already clocked in' }
  }
  const timesheet = await clockIn(technicianId, jobId ?? undefined)
  if (!timesheet) return { ok: false, error: 'Clock-in failed' }
  return { ok: true, timesheet }
}

/** Clock out active session. */
export async function workerClockOut(technicianId: string): Promise<WfmWorkerActionResult> {
  const session = await getWorkerSession(technicianId)
  if (!session?.openTimesheet) {
    return { ok: false, error: 'Not clocked in' }
  }
  const timesheet = await clockOut(session.openTimesheet.id)
  if (!timesheet) return { ok: false, error: 'Clock-out failed' }
  return { ok: true, timesheet }
}

/** Hours logged this week for a technician. */
export async function getWorkerHoursThisWeek(technicianId: string): Promise<number> {
  const timesheets = await getTimesheets(technicianId)
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  return timesheets.reduce((sum, ts) => {
    const clockInMs = new Date(ts.clock_in).getTime()
    if (clockInMs < weekStart.getTime()) return sum
    return sum + (ts.total_hours ?? 0)
  }, 0)
}

export function managerWorkLink(jobId: string): string {
  return workforceTabPath('work', 'list', jobId)
}
