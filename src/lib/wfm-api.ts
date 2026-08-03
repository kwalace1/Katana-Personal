import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import { coalesceRequest } from './request-coalesce'

// ============================================
// TYPES
// ============================================

export interface Technician {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: 'technician' | 'lead' | 'supervisor'
  status: 'active' | 'inactive' | 'on-leave'
  skills: string[] | null
  hourly_rate: number | null
  avatar_url: string | null
  notes: string | null
  is_active: boolean
  employee_id?: string | null
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  job_number: string
  title: string
  description: string | null
  client_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  location: string | null
  location_address: string | null
  status: 'assigned' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  technician_id: string | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  estimated_hours: number | null
  actual_hours: number | null
  notes: string | null
  completion_notes: string | null
  is_active: boolean
  project_id: string | null
  task_id: string | null
  invoice_id: string | null
  created_at: string
  updated_at: string
  technician?: Technician
}

export interface Schedule {
  id: string
  technician_id: string
  job_id: string | null
  schedule_date: string
  start_time: string | null
  end_time: string | null
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
  technician?: Technician
  job?: Job
}

export interface Timesheet {
  id: string
  technician_id: string
  job_id: string | null
  clock_in: string
  clock_out: string | null
  break_duration: number
  total_hours: number | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  technician?: Technician
  job?: Job
}

export interface JobNote {
  id: string
  job_id: string
  technician_id: string | null
  note: string
  created_by: string | null
  created_at: string
  technician?: Technician
}

// ============================================
// TECHNICIANS API
// ============================================

export async function getTechnicians(): Promise<Technician[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  return coalesceRequest('wfm:getTechnicians', async () => {
    const { data, error } = await supabase
      .from('wfm_technicians')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching technicians:', error)
      throw error
    }

    return data || []
  })
}

export async function getTechnician(id: string): Promise<Technician | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('wfm_technicians')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching technician:', error)
    return null
  }

  return data
}

export async function createTechnician(technician: Omit<Technician, 'id' | 'created_at' | 'updated_at'>): Promise<Technician | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('wfm_technicians')
    .insert({ ...technician, user_id: userId, organization_id: orgId })
    .select()
    .single()

  if (error) {
    console.error('Error creating technician:', error)
    throw error
  }

  return data
}

export async function updateTechnician(id: string, updates: Partial<Technician>): Promise<Technician | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { created_at, updated_at, ...updateData } = updates

  const { data, error } = await supabase
    .from('wfm_technicians')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating technician:', error)
    throw error
  }

  return data
}

export async function deleteTechnician(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  // Soft delete
  const { error } = await supabase
    .from('wfm_technicians')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error deleting technician:', error)
    return false
  }

  return true
}

export async function bulkCreateTechnicians(
  technicians: Omit<Technician, 'id' | 'created_at' | 'updated_at'>[]
): Promise<{ created: number; errors: string[] }> {
  if (!isSupabaseConfigured) {
    return { created: 0, errors: ['Supabase not configured'] }
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const results = { created: 0, errors: [] as string[] }

  for (const tech of technicians) {
    try {
      const { error } = await supabase
        .from('wfm_technicians')
        .insert({ ...tech, user_id: userId, organization_id: orgId })

      if (error) {
        results.errors.push(`${tech.name}: ${error.message}`)
      } else {
        results.created++
      }
    } catch (e) {
      results.errors.push(`${tech.name}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  return results
}

// ============================================
// JOBS API
// ============================================

export async function getJobs(): Promise<Job[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  return coalesceRequest('wfm:getJobs', async () => {
    const { data, error } = await supabase
      .from('wfm_jobs')
      .select(`
        *,
        technician:wfm_technicians(*)
      `)
      .eq('is_active', true)
      .order('start_date', { ascending: false })

    if (error) {
      console.error('Error fetching jobs:', error)
      throw error
    }

    return data || []
  })
}

export async function getJob(id: string): Promise<Job | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data, error } = await supabase
    .from('wfm_jobs')
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching job:', error)
    return null
  }

  return data
}

export async function createJob(job: Omit<Job, 'id' | 'job_number' | 'created_at' | 'updated_at' | 'technician'>): Promise<Job | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  // Generate job number (fallback if RPC missing or fails)
  let jobNumber: string
  const { data: rpcNumber, error: rpcError } = await supabase.rpc('generate_job_number')
  if (rpcError || rpcNumber == null || rpcNumber === '') {
    jobNumber = `JOB-${Date.now()}`
  } else {
    jobNumber = String(rpcNumber)
  }

  // Build insert payload: only include defined values so we don't send undefined to Postgres
  const row: Record<string, unknown> = {
    job_number: jobNumber,
    title: job.title ?? '',
    description: job.description ?? null,
    customer_name: job.customer_name ?? null,
    client_id: job.client_id ?? null,
    customer_phone: job.customer_phone ?? null,
    customer_email: job.customer_email ?? null,
    location: job.location ?? null,
    location_address: job.location_address ?? null,
    status: job.status ?? 'assigned',
    priority: job.priority ?? 'medium',
    technician_id: job.technician_id ?? null,
    start_date: job.start_date ?? null,
    end_date: job.end_date ?? null,
    start_time: job.start_time ?? null,
    end_time: job.end_time ?? null,
    estimated_hours: job.estimated_hours ?? null,
    actual_hours: job.actual_hours ?? null,
    notes: job.notes ?? null,
    completion_notes: job.completion_notes ?? null,
    is_active: job.is_active ?? true,
    project_id: job.project_id ?? null,
    task_id: job.task_id ?? null,
    invoice_id: job.invoice_id ?? null,
    user_id: userId,
    organization_id: orgId,
  }

  const { data, error } = await supabase
    .from('wfm_jobs')
    .insert(row)
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .single()

  if (error) {
    console.error('Error creating job:', error)
    throw error
  }

  if (data) {
    const { notifyWfmJobAssigned } = await import('@/lib/notification-modules')
    void notifyWfmJobAssigned(data)
  }

  return data
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<Job | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { data: prior } = await supabase
    .from('wfm_jobs')
    .select('technician_id, start_date, end_date')
    .eq('id', id)
    .maybeSingle()

  const {
    technician,
    created_at,
    updated_at,
    job_number,
    id: _id,
    ...rest
  } = updates

  const updateData: Record<string, unknown> = {}
  if (rest.title !== undefined) updateData.title = rest.title
  if (rest.technician_id !== undefined) updateData.technician_id = rest.technician_id
  if (rest.start_date !== undefined) updateData.start_date = rest.start_date
  if (rest.end_date !== undefined) updateData.end_date = rest.end_date
  if (rest.start_time !== undefined) updateData.start_time = rest.start_time
  if (rest.end_time !== undefined) updateData.end_time = rest.end_time
  if (rest.status !== undefined) updateData.status = rest.status
  if (rest.priority !== undefined) updateData.priority = rest.priority
  if (rest.description !== undefined) updateData.description = rest.description
  if (rest.location !== undefined) updateData.location = rest.location
  if (rest.location_address !== undefined) updateData.location_address = rest.location_address
  if (rest.notes !== undefined) updateData.notes = rest.notes
  if (rest.completion_notes !== undefined) updateData.completion_notes = rest.completion_notes
  if (rest.is_active !== undefined) updateData.is_active = rest.is_active

  const { data, error } = await supabase
    .from('wfm_jobs')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .single()

  if (error) {
    console.error('Error updating job:', error)
    throw error
  }

  if (data) {
    const { notifyWfmJobAssigned, notifyWfmJobRescheduled } =
      await import('@/lib/notification-modules')
    void notifyWfmJobAssigned(data, prior?.technician_id as string | null)
    void notifyWfmJobRescheduled(
      data,
      prior?.start_date as string | null,
      prior?.end_date as string | null
    )
  }

  return data
}

export async function deleteJob(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  // Soft delete
  const { error } = await supabase
    .from('wfm_jobs')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error deleting job:', error)
    return false
  }

  return true
}

// ============================================
// SCHEDULES API
// ============================================

export async function getSchedules(technicianId?: string, startDate?: string, endDate?: string): Promise<Schedule[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  let query = supabase
    .from('wfm_schedules')
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .order('schedule_date', { ascending: true })

  if (technicianId) {
    query = query.eq('technician_id', technicianId)
  }

  if (startDate) {
    query = query.gte('schedule_date', startDate)
  }

  if (endDate) {
    query = query.lte('schedule_date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching schedules:', error)
    throw error
  }

  return data || []
}

export async function createSchedule(schedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at' | 'technician' | 'job'>): Promise<Schedule | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('wfm_schedules')
    .insert({ ...schedule, user_id: userId, organization_id: orgId })
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .single()

  if (error) {
    console.error('Error creating schedule:', error)
    throw error
  }

  if (data) {
    const { notifyWfmScheduleChange } = await import('@/lib/notification-modules')
    void notifyWfmScheduleChange(data, 'created')
  }

  return data
}

export async function updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { technician, job, created_at, updated_at, ...updateData } = updates

  const { data, error } = await supabase
    .from('wfm_schedules')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .single()

  if (error) {
    console.error('Error updating schedule:', error)
    throw error
  }

  if (data) {
    const { notifyWfmScheduleChange } = await import('@/lib/notification-modules')
    void notifyWfmScheduleChange(data, 'updated')
  }

  return data
}

export async function deleteSchedule(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  const { error } = await supabase
    .from('wfm_schedules')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting schedule:', error)
    return false
  }

  return true
}

// ============================================
// TIMESHEETS API
// ============================================

export async function getTimesheets(technicianId?: string, jobId?: string): Promise<Timesheet[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  let query = supabase
    .from('wfm_timesheets')
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .order('clock_in', { ascending: false })

  if (technicianId) {
    query = query.eq('technician_id', technicianId)
  }

  if (jobId) {
    query = query.eq('job_id', jobId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching timesheets:', error)
    throw error
  }

  return data || []
}

export async function createTimesheet(timesheet: Omit<Timesheet, 'id' | 'total_hours' | 'created_at' | 'updated_at' | 'technician' | 'job'>): Promise<Timesheet | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('wfm_timesheets')
    .insert({ ...timesheet, user_id: userId, organization_id: orgId })
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .single()

  if (error) {
    console.error('Error creating timesheet:', error)
    throw error
  }

  return data
}

export async function updateTimesheet(id: string, updates: Partial<Timesheet>): Promise<Timesheet | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const { technician, job, total_hours, created_at, updated_at, ...updateData } = updates

  const { data, error } = await supabase
    .from('wfm_timesheets')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      technician:wfm_technicians(*),
      job:wfm_jobs(*)
    `)
    .single()

  if (error) {
    console.error('Error updating timesheet:', error)
    throw error
  }

  return data
}

export async function deleteTimesheet(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  const { error } = await supabase
    .from('wfm_timesheets')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting timesheet:', error)
    return false
  }

  return true
}

export async function clockIn(technicianId: string, jobId?: string, notes?: string): Promise<Timesheet | null> {
  return createTimesheet({
    technician_id: technicianId,
    job_id: jobId || null,
    clock_in: new Date().toISOString(),
    clock_out: null,
    break_duration: 0,
    notes: notes || null,
    status: 'pending',
    approved_by: null,
    approved_at: null,
  })
}

export async function clockOut(timesheetId: string, notes?: string): Promise<Timesheet | null> {
  return updateTimesheet(timesheetId, {
    clock_out: new Date().toISOString(),
    notes,
  })
}

export async function startBreak(timesheetId: string): Promise<Timesheet | null> {
  return updateTimesheet(timesheetId, {
    notes: `break_start:${new Date().toISOString()}`,
  } as any)
}

export async function endBreak(timesheetId: string, existingBreakDuration: number): Promise<Timesheet | null> {
  return updateTimesheet(timesheetId, {
    break_duration: existingBreakDuration,
    notes: null,
  } as any)
}

export async function approveTimesheet(timesheetId: string, approverId: string): Promise<Timesheet | null> {
  return updateTimesheet(timesheetId, {
    status: 'approved',
    approved_by: approverId,
    approved_at: new Date().toISOString(),
  } as any)
}

export async function rejectTimesheet(timesheetId: string, approverId: string, reason?: string): Promise<Timesheet | null> {
  return updateTimesheet(timesheetId, {
    status: 'rejected',
    approved_by: approverId,
    approved_at: new Date().toISOString(),
    notes: reason || null,
  } as any)
}

export async function submitTimesheetForApproval(timesheetId: string): Promise<Timesheet | null> {
  return updateTimesheet(timesheetId, {
    status: 'pending',
  } as any)
}

export function calculateOvertimeHours(totalHours: number, dailyThreshold = 8): { regular: number; overtime: number } {
  if (totalHours <= dailyThreshold) {
    return { regular: totalHours, overtime: 0 }
  }
  return { regular: dailyThreshold, overtime: totalHours - dailyThreshold }
}

export function calculateWeeklyOvertime(weeklyHours: number, weeklyThreshold = 40): { regular: number; overtime: number } {
  if (weeklyHours <= weeklyThreshold) {
    return { regular: weeklyHours, overtime: 0 }
  }
  return { regular: weeklyThreshold, overtime: weeklyHours - weeklyThreshold }
}

export function computeTimesheetTotalHours(clockIn: string, clockOut: string | null, breakDurationMinutes: number): number {
  if (!clockOut) return 0
  const start = new Date(clockIn).getTime()
  const end = new Date(clockOut).getTime()
  const workedMs = end - start - breakDurationMinutes * 60 * 1000
  return Math.max(0, Number((workedMs / (1000 * 60 * 60)).toFixed(2)))
}

export async function getActiveClockIn(technicianId: string): Promise<Timesheet | null> {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('wfm_timesheets')
    .select(`*, technician:wfm_technicians(*), job:wfm_jobs(*)`)
    .eq('technician_id', technicianId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching active clock-in:', error)
    return null
  }

  return data
}

// ============================================
// JOB NOTES API
// ============================================

export async function getJobNotes(jobId: string): Promise<JobNote[]> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured - returning empty array')
    return []
  }

  const { data, error } = await supabase
    .from('wfm_job_notes')
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching job notes:', error)
    throw error
  }

  return data || []
}

export async function createJobNote(note: Omit<JobNote, 'id' | 'created_at' | 'technician'>): Promise<JobNote | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data, error } = await supabase
    .from('wfm_job_notes')
    .insert({ ...note, user_id: userId, organization_id: orgId })
    .select(`
      *,
      technician:wfm_technicians(*)
    `)
    .single()

  if (error) {
    console.error('Error creating job note:', error)
    throw error
  }

  return data
}

export async function deleteJobNote(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return false
  }

  const { error } = await supabase
    .from('wfm_job_notes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting job note:', error)
    return false
  }

  return true
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export async function getWFMStats(): Promise<{
  totalTechnicians: number
  activeTechnicians: number
  totalJobs: number
  activeJobs: number
  completedJobs: number
  pendingTimesheets: number
}> {
  if (!isSupabaseConfigured) {
    return {
      totalTechnicians: 0,
      activeTechnicians: 0,
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      pendingTimesheets: 0,
    }
  }

  const [techData, jobData, timesheetData] = await Promise.all([
    supabase.from('wfm_technicians').select('status', { count: 'exact' }).eq('is_active', true),
    supabase.from('wfm_jobs').select('status', { count: 'exact' }).eq('is_active', true),
    supabase.from('wfm_timesheets').select('status', { count: 'exact' }).eq('status', 'pending'),
  ])

  const technicians = techData.data || []
  const jobs = jobData.data || []

  return {
    totalTechnicians: technicians.length,
    activeTechnicians: technicians.filter(t => t.status === 'active').length,
    totalJobs: jobs.length,
    activeJobs: jobs.filter(j => j.status === 'assigned' || j.status === 'in-progress').length,
    completedJobs: jobs.filter(j => j.status === 'completed').length,
    pendingTimesheets: timesheetData.count || 0,
  }
}

export async function getTechnicianActiveJobs(technicianId: string): Promise<number> {
  if (!isSupabaseConfigured) {
    return 0
  }

  const { count, error } = await supabase
    .from('wfm_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('technician_id', technicianId)
    .in('status', ['assigned', 'in-progress'])
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching technician active jobs:', error)
    return 0
  }

  return count || 0
}

// ============================================
// JOB TECHNICIANS (Multi-Assignment) API
// ============================================

export async function getJobTechnicians(jobId: string): Promise<Technician[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('wfm_job_technicians')
    .select('technician_id')
    .eq('job_id', jobId)

  if (error) {
    console.error('Error fetching job technicians:', error)
    return []
  }

  if (!data || data.length === 0) return []

  const techIds = data.map(r => r.technician_id)
  const { data: techs, error: techError } = await supabase
    .from('wfm_technicians')
    .select('*')
    .in('id', techIds)
    .eq('is_active', true)

  if (techError) {
    console.error('Error fetching technicians by ids:', techError)
    return []
  }

  return techs || []
}

export async function assignTechniciansToJob(
  jobId: string,
  technicianIds: string[]
): Promise<boolean> {
  if (!isSupabaseConfigured) return false

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data: priorRows } = await supabase
    .from('wfm_job_technicians')
    .select('technician_id')
    .eq('job_id', jobId)

  const previousTechnicianIds = (priorRows ?? []).map(
    (row) => row.technician_id as string
  )

  const { data: jobRow } = await supabase
    .from('wfm_jobs')
    .select('title')
    .eq('id', jobId)
    .maybeSingle()

  // Remove existing assignments
  const { error: deleteError } = await supabase
    .from('wfm_job_technicians')
    .delete()
    .eq('job_id', jobId)

  if (deleteError) {
    console.error('Error clearing job technicians:', deleteError)
    return false
  }

  if (technicianIds.length === 0) return true

  // Insert new assignments
  const rows = technicianIds.map(tid => ({
    job_id: jobId,
    technician_id: tid,
    role: 'assigned',
    user_id: userId,
    organization_id: orgId,
  }))

  const { error: insertError } = await supabase
    .from('wfm_job_technicians')
    .insert(rows)

  if (insertError) {
    console.error('Error assigning technicians:', insertError)
    return false
  }

  const { notifyWfmJobCrewAssigned } = await import('@/lib/notification-modules')
  void notifyWfmJobCrewAssigned({
    jobId,
    jobTitle: (jobRow?.title as string) ?? 'Job',
    technicianIds,
    previousTechnicianIds,
  })

  return true
}

// ============================================
// TIME-BASED SCHEDULING UTILITIES
// ============================================

/**
 * Calculate duration in hours between two HH:MM time strings on the same day.
 * Returns null if either time is missing or invalid.
 */
export function calculateDurationHours(startTime: string | null, endTime: string | null): number | null {
  if (!startTime || !endTime) return null
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null
  const startMinutes = sh * 60 + sm
  const endMinutes = eh * 60 + em
  if (endMinutes <= startMinutes) return null
  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100
}

/**
 * Format a duration in hours to a human-readable string like "2h 30m".
 */
export function formatDuration(hours: number | null): string {
  if (hours === null || hours <= 0) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export interface TimeConflict {
  jobId: string
  jobTitle: string
  technicianId: string
  technicianName: string
  date: string
  existingStart: string
  existingEnd: string
}

/**
 * Check whether assigning a technician to a job at a given date/time range
 * conflicts with any of that technician's existing jobs.
 */
export function detectTimeConflicts(
  technicianIds: string[],
  date: string,
  startTime: string,
  endTime: string,
  allJobs: Job[],
  jobTechAssignments: Record<string, string[]>,
  excludeJobId?: string,
): TimeConflict[] {
  if (!date || !startTime || !endTime) return []

  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const newStart = sh * 60 + sm
  const newEnd = eh * 60 + em
  if (newEnd <= newStart) return []

  const conflicts: TimeConflict[] = []

  for (const techId of technicianIds) {
    for (const job of allJobs) {
      if (excludeJobId && job.id === excludeJobId) continue
      if (!job.start_date || !job.start_time || !job.end_time) continue
      if (!job.is_active) continue

      // Check if this technician is assigned to this job
      const assignedTechs = jobTechAssignments[job.id] || []
      const isPrimaryTech = job.technician_id === techId
      if (!isPrimaryTech && !assignedTechs.includes(techId)) continue

      // Check if the dates overlap
      const jobStart = job.start_date.slice(0, 10)
      const jobEnd = (job.end_date || job.start_date).slice(0, 10)
      if (date < jobStart || date > jobEnd) continue

      // Check time overlap
      const [jsh, jsm] = job.start_time.split(':').map(Number)
      const [jeh, jem] = job.end_time.split(':').map(Number)
      const existStart = jsh * 60 + jsm
      const existEnd = jeh * 60 + jem

      if (newStart < existEnd && newEnd > existStart) {
        conflicts.push({
          jobId: job.id,
          jobTitle: job.title,
          technicianId: techId,
          technicianName: job.technician?.name || techId,
          date,
          existingStart: job.start_time,
          existingEnd: job.end_time,
        })
      }
    }
  }

  return conflicts
}

export async function getAllJobTechnicianAssignments(): Promise<Record<string, string[]>> {
  if (!isSupabaseConfigured) return {}

  const { data, error } = await supabase
    .from('wfm_job_technicians')
    .select('job_id, technician_id')

  if (error) {
    console.error('Error fetching all job technician assignments:', error)
    return {}
  }

  const map: Record<string, string[]> = {}
  for (const row of data || []) {
    if (!map[row.job_id]) map[row.job_id] = []
    map[row.job_id].push(row.technician_id)
  }
  return map
}

// ============================================
// HR TEAM SYNC
// ============================================

export interface WfmHrSyncResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

function hrStatusToWfm(status: string): Technician['status'] {
  if (status === 'On Leave') return 'on-leave'
  if (status === 'Inactive') return 'inactive'
  return 'active'
}

/** Sync active HR employees into wfm_technicians (match by employee_id or email). */
export async function syncTeamFromHrEmployees(): Promise<WfmHrSyncResult> {
  if (!isSupabaseConfigured) {
    return { created: 0, updated: 0, skipped: 0, errors: ['Supabase not configured'] }
  }

  const { getAllEmployees } = await import('./hr-api')
  const [employees, technicians] = await Promise.all([getAllEmployees(), getTechnicians()])

  let authUserByEmail = new Map<string, string>()
  try {
    const orgId = await getOrganizationId()
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('organization_id', orgId)
    for (const row of profiles ?? []) {
      const key = (row.email as string | null)?.trim().toLowerCase()
      if (key && row.id) authUserByEmail.set(key, row.id as string)
    }
  } catch {
    authUserByEmail = new Map()
  }

  const eligible = employees.filter(
    (e) => e.status === 'Active' || e.status === 'Onboarding',
  )

  const result: WfmHrSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] }

  for (const emp of eligible) {
    const emailKey = emp.email?.trim().toLowerCase() ?? ''
    const existing =
      technicians.find((t) => t.employee_id === emp.id) ??
      (emailKey ? technicians.find((t) => (t.email ?? '').trim().toLowerCase() === emailKey) : undefined)

    const linkedUserId =
      (emp as { user_id?: string | null }).user_id ??
      (emailKey ? authUserByEmail.get(emailKey) ?? null : null)

    const payload = {
      name: emp.name,
      email: emp.email || null,
      phone: emp.phone || null,
      role: 'technician' as const,
      status: hrStatusToWfm(emp.status),
      skills: null,
      hourly_rate: null,
      avatar_url: emp.photo_url ?? null,
      notes: null,
      is_active: true,
      employee_id: emp.id,
      ...(linkedUserId ? { user_id: linkedUserId } : {}),
    }

    try {
      if (existing) {
        const updated = await updateTechnician(existing.id, payload)
        if (updated) result.updated++
        else result.errors.push(`${emp.name}: update failed`)
      } else {
        const created = await createTechnician(payload)
        if (created) result.created++
        else result.errors.push(`${emp.name}: create failed`)
      }
    } catch (e) {
      result.errors.push(`${emp.name}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  result.skipped = employees.length - eligible.length
  return result
}


