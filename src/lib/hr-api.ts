/**
 * HR Supabase API Layer
 * All database operations for HR management
 */

import { supabase } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import { reconcileHrGoalsOverdue } from './overdue-reconcile'
import { sanitizeModuleAccessForSave, type PilotAccessOptions } from './pilot-access'
import { fetchOrgModulesDetailForCurrentOrg } from './org-module-access'
import { isUnrestrictedModuleOrg } from './module-bundles'
import { hasRole } from './tenant-context'
import { formatDateOnly } from './due-date-utils'
import { coalesceRequest } from './request-coalesce'

async function pilotAccessOptionsForCurrentOrg(): Promise<PilotAccessOptions> {
  const detail = await fetchOrgModulesDetailForCurrentOrg()
  return {
    bypassPilot: isUnrestrictedModuleOrg(detail.tier, detail.modules),
  }
}

// ==================== TYPE DEFINITIONS ====================

export interface Employee {
  id: string
  name: string
  position: string
  department: string
  status: 'Active' | 'Onboarding' | 'Inactive' | 'On Leave'
  email: string
  phone?: string
  manager_id?: string | null
  photo_url?: string | null
  hire_date: string
  next_review_date?: string | null
  last_review_date?: string | null
  performance_score?: number | null
  /** Module IDs this employee can access (e.g. ['workforce','inventory','employee']). Empty = no module access. */
  module_access?: string[] | null
  location?: string | null
  timezone?: string | null
  bio?: string | null
  created_at: string
  updated_at: string
  manager?: Employee
}

export type PerformanceReviewFormat = 'standard' | 'self_assessment'

export interface PerformanceReview {
  id: string
  employee_id: string
  review_period: string
  /** Standard manager review vs employee self-assessment */
  review_format?: PerformanceReviewFormat
  review_type: 'quarterly' | 'annual' | 'probation' | 'promotion'
  review_date: string
  collaboration: number
  accountability: number
  trustworthy: number
  leadership: number
  strengths?: string | null
  improvements?: string | null
  goals?: string | null
  reviewer_id?: string | null
  trend: 'up' | 'down' | 'stable'
  status: 'on-time' | 'overdue' | 'upcoming'
  created_at: string
  updated_at: string
  employee?: Employee
  reviewer?: Employee
}

export interface Goal {
  id: string
  employee_id: string
  goal: string
  category: string
  progress: number
  status: 'On Track' | 'Behind' | 'Complete' | 'Cancelled'
  due_date: string
  created_date: string
  description?: string | null
  created_at: string
  updated_at: string
  employee?: Employee
}

export interface GoalComment {
  id: string
  goal_id: string
  author_id?: string | null
  author_name: string
  comment: string
  comment_type: 'general' | 'feedback' | 'milestone' | 'concern'
  created_at: string
}

export interface Feedback360 {
  id: string
  employee_id: string
  self_rating?: number | null
  manager_rating?: number | null
  peer_rating?: number | null
  direct_report_rating?: number | null
  overall_score?: number | null
  feedback_count: number
  status: 'in-progress' | 'complete'
  period: string
  created_at: string
  updated_at: string
  employee?: Employee
}

export interface Mentorship {
  id: string
  mentor_id: string
  mentee_id: string
  focus: string
  match_score: number
  start_date: string
  end_date?: string | null
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  mentor?: Employee
  mentee?: Employee
}

export interface Recognition {
  id: string
  from_id?: string | null
  from_name: string
  to_id: string
  to_name: string
  type: 'Peer Recognition' | 'Manager Recognition'
  category: string
  message: string
  recognition_date: string
  created_at: string
}

/** Company / HR notices for Employee Portal */
export interface HrNotice {
  id: string
  organization_id?: string | null
  title: string
  body: string
  priority: 'low' | 'normal' | 'high'
  published_at: string
  expires_at?: string | null
  created_at: string
}

export type TrainingPriority = 'high' | 'medium' | 'low'

export interface TrainingCourse {
  id: string
  organization_id?: string | null
  title: string
  description?: string | null
  category: string
  level: 'beginner' | 'intermediate' | 'advanced'
  duration_hours: number
  skills: string[]
  certifications: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LearningPath {
  id: string
  employee_id: string
  course: string
  course_id?: string | null
  progress: number
  due_date: string
  status: 'in-progress' | 'completed' | 'not-started'
  priority?: TrainingPriority
  notes?: string | null
  created_at: string
  updated_at: string
  employee?: Employee
  training_course?: TrainingCourse | null
}

export interface AssignTrainingInput {
  employee_id: string
  course_id: string
  priority: TrainingPriority
  due_date: string
  notes?: string
}

export interface EmployeeCredential {
  name: string
  source: string
  earnedDate: string
}

export interface EmployeeSkill {
  name: string
  level: number
  category: string
}

export interface CareerPath {
  id: string
  employee_id: string
  current_role_name: string
  next_role: string
  time_to_promotion: string
  readiness: number
  required_skills: string[]
  created_at: string
  updated_at: string
  employee?: Employee
}

export interface Activity {
  id: string
  type: 'employee_added' | 'review_completed' | 'goal_added' | 'goal_completed' | 'recognition_given' | 'interview_scheduled' | 'employee_updated'
  description: string
  employee_id?: string | null
  employee_name?: string | null
  created_at: string
}

export interface TimeOffRequest {
  id: string
  employee_id: string
  type: 'Vacation' | 'Sick' | 'Personal' | 'Bereavement' | 'Jury Duty' | 'Unpaid' | 'Other'
  start_date: string
  end_date: string
  reason?: string | null
  status: 'Pending' | 'Approved' | 'Denied' | 'Cancelled'
  manager_notes?: string | null
  decided_by?: string | null
  decided_at?: string | null
  created_at: string
  updated_at: string
  employee?: Employee
}

// ==================== EMPLOYEES ====================

export async function getAllEmployees(): Promise<Employee[]> {
  return coalesceRequest('hr:getAllEmployees', () => getAllEmployeesImpl())
}

async function getAllEmployeesImpl(): Promise<Employee[]> {
  const orgId = await getOrganizationId()
  let query = supabase
    .from('hr_employees')
    .select(`
      *,
      manager:manager_id(*)
    `)
    .order('name')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  let { data, error } = await query

  if (error && orgId) {
    const msg = (error.message || '').toLowerCase()
    if (msg.includes('organization_id') || msg.includes('column') || msg.includes('schema')) {
      const fallback = await supabase
        .from('hr_employees')
        .select(`
          *,
          manager:manager_id(*)
        `)
        .order('name')
      data = fallback.data
      error = fallback.error
    }
  }

  if (error) {
    console.error('Error fetching employees:', error)
    return []
  }

  // Ensure manager photos are included
  return (data || []).map(employee => ({
    ...employee,
    manager: employee.manager ? {
      ...employee.manager,
      photo_url: employee.manager.photo_url || null
    } : null
  }))
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  return coalesceRequest(`hr:getEmployeeById:${id}`, () => getEmployeeByIdImpl(id))
}

async function getEmployeeByIdImpl(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('hr_employees')
    .select(`
      *,
      manager:manager_id(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching employee:', error)
    return null
  }

  return data
}

/** Get HR employee by email (for resolving current user's module access). */
export async function getEmployeeByEmail(email: string): Promise<Employee | null> {
  if (!email?.trim()) return null
  const normalized = email.trim().toLowerCase()
  return coalesceRequest(`hr:getEmployeeByEmail:${normalized}`, async () => {
    const { data, error } = await supabase
      .from('hr_employees')
      .select(`
        *,
        manager:manager_id(*)
      `)
      .ilike('email', email.trim())
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching employee by email:', error)
      return null
    }
    return data
  })
}

export async function createEmployee(employee: Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'manager'>): Promise<Employee | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { manager, ...rest } = employee as Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { manager?: Employee }

  let moduleAccess = rest.module_access ?? []
  if (moduleAccess.length > 0) {
    const canManage = await hasRole(['owner', 'admin'])
    if (!canManage) {
      throw new Error('Only organization owners and admins can assign module access')
    }
    moduleAccess = sanitizeModuleAccessForSave(
      moduleAccess,
      (await fetchOrgModulesDetailForCurrentOrg()).modules,
      await pilotAccessOptionsForCurrentOrg(),
    )
  }

  const rowWithModules = {
    ...rest,
    module_access: moduleAccess,
    user_id: userId,
    organization_id: orgId,
  }

  const doInsert = (row: typeof rowWithModules) =>
    supabase
      .from('hr_employees')
      .insert(row)
      .select(`
        *,
        manager:manager_id(*)
      `)
      .single()

  const { data, error } = await doInsert(rowWithModules)

  if (error) {
    const msg = (error.message || '').toLowerCase()
    const schemaOrColumnError =
      msg.includes('module_access') ||
      msg.includes('schema cache') ||
      msg.includes('column') ||
      msg.includes('does not exist') ||
      (error as { code?: string }).code === 'PGRST204' ||
      (error as { code?: string }).code === '42703'
    if (schemaOrColumnError) {
      const { module_access: _omit, ...rowWithoutModules } = rowWithModules
      const { data: retryData, error: retryError } = await doInsert(rowWithoutModules as typeof rowWithModules)
      if (retryError) {
        console.error('Error creating employee (retry without module_access):', retryError)
        throw new Error(retryError.message || 'Failed to create employee')
      }
      return retryData ? { ...retryData, module_access: rest.module_access ?? [] } : null
    }
    console.error('Error creating employee:', error)
    throw new Error(error.message || 'Failed to create employee')
  }

  return data
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee | null> {
  if (updates.module_access !== undefined) {
    const canManage = await hasRole(['owner', 'admin'])
    if (!canManage) {
      throw new Error('Only organization owners and admins can change module access')
    }
    const orgDetail = await fetchOrgModulesDetailForCurrentOrg()
    updates = {
      ...updates,
      module_access: sanitizeModuleAccessForSave(
        updates.module_access,
        orgDetail.modules,
        await pilotAccessOptionsForCurrentOrg(),
      ),
    }
  }

  const { data, error } = await supabase
    .from('hr_employees')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      manager:manager_id(*)
    `)
    .single()

  if (error) {
    console.error('Error updating employee:', error)
    return null
  }

  return data
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_employees')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting employee:', error)
    return false
  }

  return true
}

// ==================== PERFORMANCE REVIEWS ====================

export async function getAllPerformanceReviews(): Promise<PerformanceReview[]> {
  const { data, error } = await supabase
    .from('hr_performance_reviews')
    .select(`
      *,
      employee:employee_id(*),
      reviewer:reviewer_id(*)
    `)
    .order('review_date', { ascending: false })

  if (error) {
    console.error('Error fetching performance reviews:', error)
    return []
  }

  return data || []
}

export async function getPerformanceReviewsByEmployeeId(employeeId: string): Promise<PerformanceReview[]> {
  const { data, error } = await supabase
    .from('hr_performance_reviews')
    .select(`
      *,
      employee:employee_id(*),
      reviewer:reviewer_id(*)
    `)
    .eq('employee_id', employeeId)
    .order('review_date', { ascending: false })

  if (error) {
    console.error('Error fetching employee performance reviews:', error)
    return []
  }

  return data || []
}

export async function createPerformanceReview(review: Omit<PerformanceReview, 'id' | 'created_at' | 'updated_at' | 'employee' | 'reviewer'>): Promise<PerformanceReview | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('hr_performance_reviews')
    .insert({ ...review, user_id: userId, organization_id: orgId })
    .select(`
      *,
      employee:employee_id(*),
      reviewer:reviewer_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating performance review:', error)
    return null
  }

  if (data?.employee_id) {
    await syncEmployeePerformanceScore(data.employee_id)
  }

  if (data) {
    const { notifyHrReviewScheduled } = await import('@/lib/notification-modules')
    void notifyHrReviewScheduled(data)
  }

  return data
}

export async function updatePerformanceReview(id: string, updates: Partial<PerformanceReview>): Promise<PerformanceReview | null> {
  const { data, error } = await supabase
    .from('hr_performance_reviews')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      employee:employee_id(*),
      reviewer:reviewer_id(*)
    `)
    .single()

  if (error) {
    console.error('Error updating performance review:', error)
    return null
  }

  if (data?.employee_id) {
    await syncEmployeePerformanceScore(data.employee_id)
  }

  return data
}

export async function deletePerformanceReview(id: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('hr_performance_reviews')
    .select('employee_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('hr_performance_reviews')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting performance review:', error)
    return false
  }

  if (existing?.employee_id) {
    await syncEmployeePerformanceScore(existing.employee_id)
  }

  return true
}

// ==================== GOALS ====================

export async function getAllGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('hr_goals')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .order('due_date')

  if (error) {
    console.error('Error fetching goals:', error)
    return []
  }

  return reconcileHrGoalsOverdue(data || [])
}

export async function getGoalsByEmployeeId(employeeId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('hr_goals')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .eq('employee_id', employeeId)
    .order('due_date')

  if (error) {
    console.error('Error fetching employee goals:', error)
    return []
  }

  return reconcileHrGoalsOverdue(data || [])
}

export async function createGoal(goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'employee'>): Promise<Goal | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('hr_goals')
    .insert({ ...goal, user_id: userId, organization_id: orgId })
    .select(`
      *,
      employee:employee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating goal:', error)
    return null
  }

  if (data) {
    const { notifyHrGoalAssigned } = await import('@/lib/notification-modules')
    void notifyHrGoalAssigned(data)
  }

  return data
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | null> {
  const { data: prior } = await supabase
    .from('hr_goals')
    .select('employee_id')
    .eq('id', id)
    .maybeSingle()

  const { data, error } = await supabase
    .from('hr_goals')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      employee:employee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error updating goal:', error)
    return null
  }

  if (data) {
    const { notifyHrGoalReassigned } = await import('@/lib/notification-modules')
    void notifyHrGoalReassigned(data, prior?.employee_id as string | null)
  }

  return data
}

export async function deleteGoal(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_goals')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting goal:', error)
    return false
  }

  return true
}

// ==================== GOAL COMMENTS ====================

export async function getGoalComments(goalId: string): Promise<GoalComment[]> {
  const { data, error } = await supabase
    .from('hr_goal_comments')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching goal comments:', error)
    return []
  }

  return data || []
}

export async function createGoalComment(comment: Omit<GoalComment, 'id' | 'created_at'>): Promise<GoalComment | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('hr_goal_comments')
    .insert({ ...comment, user_id: userId, organization_id: orgId })
    .select('*')
    .single()

  if (error) {
    console.error('Error creating goal comment:', error)
    return null
  }

  return data
}

// ==================== 360 FEEDBACK ====================

export async function getAll360Feedback(): Promise<Feedback360[]> {
  const { data, error } = await supabase
    .from('hr_360_feedback')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching 360 feedback:', error)
    return []
  }

  return data || []
}

export async function get360FeedbackByEmployeeId(employeeId: string): Promise<Feedback360[]> {
  const { data, error } = await supabase
    .from('hr_360_feedback')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching employee 360 feedback:', error)
    return []
  }

  return data || []
}

export async function create360Feedback(feedback: Omit<Feedback360, 'id' | 'created_at' | 'updated_at' | 'employee'>): Promise<Feedback360 | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('hr_360_feedback')
    .insert({ ...feedback, user_id: userId, organization_id: orgId })
    .select(`
      *,
      employee:employee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating 360 feedback:', error)
    return null
  }

  return data
}

// ==================== MENTORSHIPS ====================

export async function getAllMentorships(): Promise<Mentorship[]> {
  const { data, error } = await supabase
    .from('hr_mentorships')
    .select(`
      *,
      mentor:mentor_id(*),
      mentee:mentee_id(*)
    `)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error fetching mentorships:', error)
    return []
  }

  return data || []
}

export async function createMentorship(mentorship: Omit<Mentorship, 'id' | 'created_at' | 'updated_at' | 'mentor' | 'mentee'>): Promise<Mentorship | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('hr_mentorships')
    .insert({ ...mentorship, user_id: userId, organization_id: orgId })
    .select(`
      *,
      mentor:mentor_id(*),
      mentee:mentee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating mentorship:', error)
    return null
  }

  return data
}

export async function deleteMentorship(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_mentorships')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting mentorship:', error)
    return false
  }

  return true
}

// ==================== RECOGNITIONS ====================

export async function getAllRecognitions(): Promise<Recognition[]> {
  const { data, error } = await supabase
    .from('hr_recognitions')
    .select('*')
    .order('recognition_date', { ascending: false })

  if (error) {
    console.error('Error fetching recognitions:', error)
    return []
  }

  return data || []
}

export async function getRecognitionsByEmployeeId(employeeId: string): Promise<Recognition[]> {
  const { data, error } = await supabase
    .from('hr_recognitions')
    .select('*')
    .eq('to_id', employeeId)
    .order('recognition_date', { ascending: false })

  if (error) {
    console.error('Error fetching recognitions for employee:', error)
    return []
  }

  return data || []
}

export async function createRecognition(recognition: Omit<Recognition, 'id' | 'created_at'>): Promise<Recognition | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('hr_recognitions')
    .insert({ ...recognition, user_id: userId, organization_id: orgId })
    .select('*')
    .single()

  if (error) {
    console.error('Error creating recognition:', error)
    throw new Error(error.message || 'Failed to create recognition')
  }

  if (data) {
    const { notifyHrRecognitionReceived } = await import('@/lib/notification-modules')
    void notifyHrRecognitionReceived(data)
  }

  return data
}

export async function deleteRecognition(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_recognitions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting recognition:', error)
    return false
  }

  return true
}

// ==================== HR NOTICES (Employee Portal) ====================

export async function getHrNoticesForPortal(): Promise<HrNotice[]> {
  const { data, error } = await supabase
    .from('hr_notices')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(25)

  if (error) {
    // Table missing until migration is applied — fail soft for portal
    const msg = (error.message || '').toLowerCase()
    if (msg.includes('does not exist') || msg.includes('schema cache') || error.code === '42P01') {
      return []
    }
    console.error('Error fetching hr_notices:', error)
    return []
  }

  const now = Date.now()
  return (data || []).filter((row: { expires_at?: string | null }) => {
    if (!row.expires_at) return true
    return new Date(row.expires_at).getTime() >= now
  }) as HrNotice[]
}

// ==================== TRAINING COURSES ====================

const learningPathSelect = `
  *,
  employee:employee_id(*),
  training_course:course_id(*)
`

export async function getTrainingCourses(activeOnly = true): Promise<TrainingCourse[]> {
  let query = supabase
    .from('hr_training_courses')
    .select('*')
    .order('title')

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    const msg = (error.message || '').toLowerCase()
    if (msg.includes('does not exist') || msg.includes('schema cache') || error.code === '42P01') {
      return []
    }
    console.error('Error fetching training courses:', error)
    return []
  }

  return (data || []).map(normalizeTrainingCourse)
}

export async function createTrainingCourse(
  course: Pick<TrainingCourse, 'title' | 'description' | 'category' | 'level' | 'duration_hours' | 'skills' | 'certifications'>
): Promise<TrainingCourse | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('hr_training_courses')
    .insert({
      ...course,
      user_id: userId,
      organization_id: orgId,
      is_active: true,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error creating training course:', error)
    return null
  }

  return data ? normalizeTrainingCourse(data) : null
}

export async function updateTrainingCourse(
  id: string,
  updates: Partial<Pick<TrainingCourse, 'title' | 'description' | 'category' | 'level' | 'duration_hours' | 'skills' | 'certifications' | 'is_active'>>
): Promise<TrainingCourse | null> {
  const { data, error } = await supabase
    .from('hr_training_courses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating training course:', error)
    return null
  }

  return data ? normalizeTrainingCourse(data) : null
}

export async function deleteTrainingCourse(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_training_courses')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting training course:', error)
    return false
  }

  return true
}

function normalizeTrainingCourse(row: Record<string, unknown>): TrainingCourse {
  return {
    id: row.id as string,
    organization_id: (row.organization_id as string) ?? null,
    title: row.title as string,
    description: (row.description as string) ?? null,
    category: (row.category as string) || 'General',
    level: (row.level as TrainingCourse['level']) || 'intermediate',
    duration_hours: Number(row.duration_hours) || 0,
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    certifications: Array.isArray(row.certifications) ? (row.certifications as string[]) : [],
    is_active: row.is_active !== false,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

/** Certifications and skills earned from completed courses */
export function deriveEmployeeCredentials(
  learningPaths: LearningPath[],
  courses: TrainingCourse[]
): { certifications: EmployeeCredential[]; skills: EmployeeSkill[] } {
  const courseById = new Map(courses.map((c) => [c.id, c]))
  const certifications: EmployeeCredential[] = []
  const skillLevels = new Map<string, { level: number; category: string }>()

  for (const lp of learningPaths) {
    if (lp.status !== 'completed') continue
    const catalog = lp.course_id ? courseById.get(lp.course_id) : lp.training_course ?? null
    const earnedDate = lp.updated_at
      ? new Date(lp.updated_at).toLocaleDateString()
      : new Date().toLocaleDateString()
    const source = lp.course || catalog?.title || 'Training'

    if (catalog) {
      for (const cert of catalog.certifications) {
        certifications.push({ name: cert, source, earnedDate })
      }
      for (const skill of catalog.skills) {
        const existing = skillLevels.get(skill)
        skillLevels.set(skill, {
          level: Math.min(100, (existing?.level ?? 0) + 25),
          category: catalog.category === 'Leadership' ? 'Soft Skills' : 'Technical',
        })
      }
    }
  }

  const skills: EmployeeSkill[] = Array.from(skillLevels.entries()).map(([name, { level, category }]) => ({
    name,
    level,
    category,
  }))

  return { certifications, skills }
}

// ==================== LEARNING PATHS ====================

export async function getAllLearningPaths(): Promise<LearningPath[]> {
  const { data, error } = await supabase
    .from('hr_learning_paths')
    .select(learningPathSelect)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching learning paths:', error)
    return []
  }

  return data || []
}

export async function getLearningPathsByEmployeeId(employeeId: string): Promise<LearningPath[]> {
  const { data, error } = await supabase
    .from('hr_learning_paths')
    .select(learningPathSelect)
    .eq('employee_id', employeeId)
    .order('due_date')

  if (error) {
    console.error('Error fetching employee learning paths:', error)
    return []
  }

  return data || []
}

export async function assignTraining(input: AssignTrainingInput): Promise<LearningPath | null> {
  const courses = await getTrainingCourses(false)
  const course = courses.find((c) => c.id === input.course_id)
  if (!course) {
    console.error('Training course not found:', input.course_id)
    return null
  }

  return createLearningPath({
    employee_id: input.employee_id,
    course_id: input.course_id,
    course: course.title,
    progress: 0,
    due_date: input.due_date,
    status: 'not-started',
    priority: input.priority,
    notes: input.notes ?? null,
  })
}

export async function createLearningPath(
  learningPath: Omit<LearningPath, 'id' | 'created_at' | 'updated_at' | 'employee' | 'training_course'>
): Promise<LearningPath | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('hr_learning_paths')
    .insert({ ...learningPath, user_id: userId, organization_id: orgId })
    .select(learningPathSelect)
    .single()

  if (error) {
    console.error('Error creating learning path:', error)
    return null
  }

  if (data) {
    const { notifyHrTrainingAssigned } = await import('@/lib/notification-modules')
    void notifyHrTrainingAssigned(data)
  }

  return data
}

export async function updateLearningPath(
  id: string,
  updates: Partial<Pick<LearningPath, 'progress' | 'status' | 'due_date' | 'notes' | 'priority'>>
): Promise<LearningPath | null> {
  const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
  if (updates.progress === 100) {
    payload.status = 'completed'
  } else if (updates.progress !== undefined && updates.progress > 0 && updates.status === undefined) {
    payload.status = 'in-progress'
  }

  const { data, error } = await supabase
    .from('hr_learning_paths')
    .update(payload)
    .eq('id', id)
    .select(learningPathSelect)
    .single()

  if (error) {
    console.error('Error updating learning path:', error)
    return null
  }

  return data
}

export async function deleteLearningPath(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_learning_paths')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting learning path:', error)
    return false
  }

  return true
}

// ==================== CAREER PATHS ====================

export async function getAllCareerPaths(): Promise<CareerPath[]> {
  const { data, error } = await supabase
    .from('hr_career_paths')
    .select(`
      *,
      employee:employee_id(*)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching career paths:', error)
    return []
  }

  return data || []
}

export async function createCareerPath(careerPath: Omit<CareerPath, 'id' | 'created_at' | 'updated_at' | 'employee'>): Promise<CareerPath | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('hr_career_paths')
    .insert({ ...careerPath, user_id: userId, organization_id: orgId })
    .select(`
      *,
      employee:employee_id(*)
    `)
    .single()

  if (error) {
    console.error('Error creating career path:', error)
    return null
  }

  return data
}

export async function deleteCareerPath(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('hr_career_paths')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting career path:', error)
    return false
  }

  return true
}

// ==================== UTILITY FUNCTIONS ====================

/** Overall score (1–5) from the four CATL review dimensions */
export function getReviewOverallScore(
  review: Pick<PerformanceReview, 'collaboration' | 'accountability' | 'trustworthy' | 'leadership'>
): number {
  const values = [
    Number(review.collaboration),
    Number(review.accountability),
    Number(review.trustworthy),
    Number(review.leadership),
  ]
  if (values.some((v) => Number.isNaN(v))) return 0
  return values.reduce((sum, v) => sum + v, 0) / 4
}

/** Org-wide average: latest review per employee, then mean across employees */
export function calculateAveragePerformanceScore(
  reviews: PerformanceReview[],
  employees: Employee[] = []
): number {
  if (reviews.length > 0) {
    const latestByEmployee = new Map<string, PerformanceReview>()
    for (const review of reviews) {
      const existing = latestByEmployee.get(review.employee_id)
      const reviewTime = new Date(review.review_date).getTime()
      const existingTime = existing ? new Date(existing.review_date).getTime() : -1
      if (!existing || reviewTime >= existingTime) {
        latestByEmployee.set(review.employee_id, review)
      }
    }
    const scores = Array.from(latestByEmployee.values())
      .map(getReviewOverallScore)
      .filter((s) => s > 0)
    if (scores.length > 0) {
      return Number((scores.reduce((sum, s) => sum + s, 0) / scores.length).toFixed(2))
    }
  }

  const withStoredScore = employees.filter(
    (e) => e.performance_score != null && !Number.isNaN(Number(e.performance_score))
  )
  if (withStoredScore.length > 0) {
    return Number(
      (
        withStoredScore.reduce((sum, e) => sum + Number(e.performance_score), 0) /
        withStoredScore.length
      ).toFixed(2)
    )
  }

  return 0
}

async function syncEmployeePerformanceScore(employeeId: string): Promise<void> {
  const reviews = await getPerformanceReviewsByEmployeeId(employeeId)
  if (reviews.length === 0) {
    await updateEmployee(employeeId, { performance_score: null, last_review_date: null })
    return
  }
  const latest = reviews[0]
  await updateEmployee(employeeId, {
    performance_score: Number(getReviewOverallScore(latest).toFixed(2)),
    last_review_date: latest.review_date,
  })
}

export async function getHRStats() {
  const employees = await getAllEmployees()
  const reviews = await getAllPerformanceReviews()
  const goals = await getAllGoals()

  const totalEmployees = employees.length
  // All employees are active by default
  const activeEmployees = employees.filter((e) => e.status?.toLowerCase() === 'active').length
  const avgPerformanceScore = calculateAveragePerformanceScore(reviews, employees)

  const totalGoals = goals.length
  const onTrackGoals = goals.filter((g) => g.status === 'On Track').length
  const behindGoals = goals.filter((g) => g.status === 'Behind').length
  const completeGoals = goals.filter((g) => g.status === 'Complete').length

  const upcomingReviews = reviews.filter((r) => r.status === 'upcoming').length
  const overdueReviews = reviews.filter((r) => r.status === 'overdue').length

  return {
    totalEmployees,
    activeEmployees,
    avgPerformanceScore,
    totalGoals,
    onTrackGoals,
    behindGoals,
    completeGoals,
    upcomingReviews,
    overdueReviews,
  }
}

// ==================== ACTIVITIES ====================

export async function getRecentActivities(limit: number = 10): Promise<Activity[]> {
  try {
    const orgId = await getOrganizationId()
    let query = supabase
      .from('hr_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (orgId) {
      query = query.eq('organization_id', orgId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching activities:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching activities:', error)
    return []
  }
}

export async function logActivity(activity: Omit<Activity, 'id' | 'created_at'>): Promise<boolean> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { error } = await supabase
    .from('hr_activities')
    .insert({ ...activity, user_id: userId, organization_id: orgId })

  if (error) {
    console.error('Error logging activity:', error)
    return false
  }

  return true
}

// Helper function to log employee added
export async function logEmployeeAdded(employeeName: string, employeeId: string): Promise<void> {
  await logActivity({
    type: 'employee_added',
    description: `New employee ${employeeName} added to the system`,
    employee_id: employeeId,
    employee_name: employeeName,
  })
}

// Helper function to log review completed
export async function logReviewCompleted(employeeName: string, employeeId: string): Promise<void> {
  await logActivity({
    type: 'review_completed',
    description: `Performance review completed for ${employeeName}`,
    employee_id: employeeId,
    employee_name: employeeName,
  })
}

// Helper function to log goal added
export async function logGoalAdded(goalTitle: string, employeeName: string, employeeId: string): Promise<void> {
  await logActivity({
    type: 'goal_added',
    description: `New goal added for ${employeeName}: ${goalTitle}`,
    employee_id: employeeId,
    employee_name: employeeName,
  })
}

// Helper function to log goal completed
export async function logGoalCompleted(goalTitle: string, employeeName: string, employeeId: string): Promise<void> {
  await logActivity({
    type: 'goal_completed',
    description: `${employeeName} completed goal: ${goalTitle}`,
    employee_id: employeeId,
    employee_name: employeeName,
  })
}

// Helper function to log recognition
export async function logRecognitionGiven(fromName: string, toName: string, toId: string): Promise<void> {
  await logActivity({
    type: 'recognition_given',
    description: `${fromName} gave recognition to ${toName}`,
    employee_id: toId,
    employee_name: toName,
  })
}

// Helper function to log interview scheduled
export async function logInterviewScheduled(candidateId: string): Promise<void> {
  await logActivity({
    type: 'interview_scheduled',
    description: `Interview scheduled for candidate ${candidateId}`,
    employee_id: null,
    employee_name: candidateId,
  })
}

// ==================== TIME OFF REQUESTS ====================

export const TIME_OFF_TYPES: TimeOffRequest['type'][] = [
  'Vacation',
  'Sick',
  'Personal',
  'Bereavement',
  'Jury Duty',
  'Unpaid',
  'Other',
]

export type PortalHrFeedItem =
  | { kind: 'notice'; sortAt: number; notice: HrNotice }
  | { kind: 'time_off'; sortAt: number; request: TimeOffRequest }

function formatShortDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) {
    return formatDateOnly(iso, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Human-readable title for portal HR notices feed */
export function timeOffPortalNoticeTitle(req: TimeOffRequest): string {
  const range = `${formatShortDate(req.start_date)} – ${formatShortDate(req.end_date)}`
  switch (req.status) {
    case 'Pending':
      return `Time off request submitted — ${req.type}`
    case 'Approved':
      return `Time off approved — ${req.type}`
    case 'Denied':
      return `Time off denied — ${req.type}`
    case 'Cancelled':
      return `Time off request cancelled — ${req.type}`
    default:
      return `Time off — ${req.type}`
  }
}

export function timeOffPortalNoticeBody(req: TimeOffRequest): string {
  const range = `${formatShortDate(req.start_date)} to ${formatShortDate(req.end_date)}`
  const lines = [`Dates: ${range}`]
  if (req.reason?.trim()) lines.push(`Reason: ${req.reason.trim()}`)
  if (req.status === 'Approved' && req.manager_notes?.trim()) {
    lines.push(`Note from HR: ${req.manager_notes.trim()}`)
  }
  if (req.status === 'Denied' && req.manager_notes?.trim()) {
    lines.push(`Reason: ${req.manager_notes.trim()}`)
  }
  if (req.status === 'Pending') {
    lines.push('Your request is pending HR approval.')
  }
  return lines.join('\n')
}

export function buildPortalHrFeed(
  notices: HrNotice[],
  timeOffRequests: TimeOffRequest[]
): PortalHrFeedItem[] {
  const items: PortalHrFeedItem[] = notices.map((notice) => ({
    kind: 'notice',
    sortAt: new Date(notice.published_at).getTime(),
    notice,
  }))
  for (const request of timeOffRequests) {
    const sortAt = request.decided_at
      ? new Date(request.decided_at).getTime()
      : new Date(request.created_at).getTime()
    items.push({ kind: 'time_off', sortAt, request })
  }
  return items.sort((a, b) => {
    const aPending = a.kind === 'time_off' && a.request.status === 'Pending'
    const bPending = b.kind === 'time_off' && b.request.status === 'Pending'
    if (aPending !== bPending) return aPending ? -1 : 1

    const aHigh = a.kind === 'notice' && a.notice.priority === 'high'
    const bHigh = b.kind === 'notice' && b.notice.priority === 'high'
    if (aHigh !== bHigh) return aHigh ? -1 : 1

    if (a.kind === 'notice' && b.kind === 'notice') {
      const priorityOrder = { high: 3, normal: 2, low: 1 }
      const pr =
        priorityOrder[b.notice.priority] - priorityOrder[a.notice.priority]
      if (pr !== 0) return pr
    }

    return b.sortAt - a.sortAt
  })
}

export async function getTimeOffRequestsByEmployeeId(employeeId: string): Promise<TimeOffRequest[]> {
  const { data, error } = await supabase
    .from('hr_time_off_requests')
    .select(`*, employee:employee_id(*)`)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    const msg = (error.message || '').toLowerCase()
    if (msg.includes('does not exist') || msg.includes('schema cache') || error.code === '42P01') {
      return []
    }
    console.error('Error fetching employee time off requests:', error)
    return []
  }

  return (data as TimeOffRequest[]) || []
}

export async function submitEmployeeTimeOffRequest(input: {
  employeeId: string
  type: TimeOffRequest['type']
  start_date: string
  end_date: string
  reason?: string
}): Promise<TimeOffRequest | null> {
  if (!input.employeeId) return null
  if (input.end_date < input.start_date) {
    console.error('Time off end date must be on or after start date')
    return null
  }
  return createTimeOffRequest({
    employee_id: input.employeeId,
    type: input.type,
    start_date: input.start_date,
    end_date: input.end_date,
    reason: input.reason?.trim() || null,
  })
}

export async function getAllTimeOffRequests(): Promise<TimeOffRequest[]> {
  const { data, error } = await supabase
    .from('hr_time_off_requests')
    .select(`*, employee:employee_id(*)`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching time off requests:', error)
    return []
  }

  return (data as TimeOffRequest[]) || []
}

export async function getPendingTimeOffRequests(): Promise<TimeOffRequest[]> {
  const { data, error } = await supabase
    .from('hr_time_off_requests')
    .select(`*, employee:employee_id(*)`)
    .eq('status', 'Pending')
    .order('start_date', { ascending: true })

  if (error) {
    console.error('Error fetching pending time off requests:', error)
    return []
  }

  return (data as TimeOffRequest[]) || []
}

export async function createTimeOffRequest(
  request: Omit<TimeOffRequest, 'id' | 'status' | 'manager_notes' | 'decided_by' | 'decided_at' | 'created_at' | 'updated_at' | 'employee'>
): Promise<TimeOffRequest | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('hr_time_off_requests')
    .insert({ ...request, status: 'Pending', user_id: userId, organization_id: orgId })
    .select(`*, employee:employee_id(*)`)
    .single()

  if (error) {
    console.error('Error creating time off request:', error)
    return null
  }

  const created = data as TimeOffRequest
  const { notifyHrTimeOffSubmitted } = await import('@/lib/notification-modules')
  void notifyHrTimeOffSubmitted(created)

  return created
}

export async function decideTimeOffRequest(
  id: string,
  decision: 'Approved' | 'Denied',
  managerNotes?: string,
): Promise<TimeOffRequest | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('hr_time_off_requests')
    .update({
      status: decision,
      manager_notes: managerNotes ?? null,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`*, employee:employee_id(*)`)
    .single()

  if (error) {
    console.error('Error updating time off request:', error)
    return null
  }

  const decided = data as TimeOffRequest
  const { notifyHrTimeOffDecided } = await import('@/lib/notification-modules')
  void notifyHrTimeOffDecided(decided)

  return decided
}

