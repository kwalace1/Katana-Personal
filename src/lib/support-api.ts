import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import { MODULES } from './module-access'
import {
  sendSupportSubmissionEmail,
  isSupportEmailConfigured,
  formatEmailJsError,
} from './support-email'

// ============================================
// TYPES
// ============================================

export type SubmissionType = 'issue' | 'feedback'
export type SubmissionCategory = 'bug' | 'feature' | 'question' | 'general' | 'ux' | 'performance'
export type SubmissionStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type SubmissionPriority = 'low' | 'medium' | 'high' | 'critical'

export interface SupportSubmission {
  id: string
  organization_id: string
  submitter_user_id: string
  submitter_name: string
  submitter_email: string
  organization_name: string | null
  submission_type: SubmissionType
  category: SubmissionCategory
  subject: string
  description: string
  module_context: string | null
  status: SubmissionStatus
  priority: SubmissionPriority
  admin_notes: string | null
  assigned_to_user_id: string | null
  assigned_to_name: string | null
  client_id: string | null
  last_updated_by_user_id: string | null
  last_updated_by_name: string | null
  last_updated_by_email: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export interface CreateSubmissionInput {
  submission_type: SubmissionType
  category: SubmissionCategory
  subject: string
  description: string
  module_context?: string | null
  priority?: SubmissionPriority
  submitter_name: string
  submitter_email: string
  organization_name: string
}

export interface UpdateSubmissionInput {
  status?: SubmissionStatus
  priority?: SubmissionPriority
  admin_notes?: string | null
  assigned_to_user_id?: string | null
  assigned_to_name?: string | null
  client_id?: string | null
}

export type SupportActivityType = 'status_changed' | 'priority_changed' | 'notes_updated'

export interface SupportSubmissionActivity {
  id: string
  submission_id: string
  organization_id: string
  actor_user_id: string
  actor_name: string
  actor_email: string
  action_type: SupportActivityType
  from_status: string | null
  to_status: string | null
  from_priority: string | null
  to_priority: string | null
  admin_notes: string | null
  created_at: string
}

export interface UpdateSubmissionActor {
  userId: string
  name: string
  email: string
}

export interface SupportStats {
  total: number
  open: number
  inProgress: number
  resolved: number
  issues: number
  feedback: number
}

export const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = {
  issue: 'Issue Report',
  feedback: 'Feedback',
}

export const SUBMISSION_CATEGORY_LABELS: Record<SubmissionCategory, string> = {
  bug: 'Bug',
  feature: 'Feature Request',
  question: 'Question',
  general: 'General',
  ux: 'UX / Design',
  performance: 'Performance',
}

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const SUBMISSION_PRIORITY_LABELS: Record<SubmissionPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export const MODULE_CONTEXT_OPTIONS = MODULES.map((m) => ({
  value: m.id,
  label: m.label,
}))

// ============================================
// API
// ============================================

export async function getMySubmissions(): Promise<SupportSubmission[]> {
  if (!isSupabaseConfigured) return []

  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('support_submissions')
    .select('*')
    .eq('submitter_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching my submissions:', error)
    return []
  }
  return (data ?? []) as SupportSubmission[]
}

export async function getAllSubmissions(): Promise<SupportSubmission[]> {
  if (!isSupabaseConfigured) return []

  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('support_submissions')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching all submissions:', error)
    return []
  }
  return (data ?? []) as SupportSubmission[]
}

/** All submissions across every organization — Katana platform operators only (RLS). */
export async function getAllPlatformSubmissions(): Promise<SupportSubmission[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('support_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching platform submissions:', error)
    return []
  }
  return (data ?? []) as SupportSubmission[]
}

export async function getSupportStats(): Promise<SupportStats> {
  const submissions = await getAllSubmissions()
  return {
    total: submissions.length,
    open: submissions.filter((s) => s.status === 'open').length,
    inProgress: submissions.filter((s) => s.status === 'in_progress').length,
    resolved: submissions.filter((s) => s.status === 'resolved' || s.status === 'closed').length,
    issues: submissions.filter((s) => s.submission_type === 'issue').length,
    feedback: submissions.filter((s) => s.submission_type === 'feedback').length,
  }
}

export async function createSubmission(input: CreateSubmissionInput): Promise<SupportSubmission | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured')
    return null
  }

  const [userId, orgId] = await Promise.all([getCurrentUserId(), getOrganizationId()])

  const row = {
    organization_id: orgId,
    submitter_user_id: userId,
    submitter_name: input.submitter_name,
    submitter_email: input.submitter_email,
    organization_name: input.organization_name,
    submission_type: input.submission_type,
    category: input.category,
    subject: input.subject.trim(),
    description: input.description.trim(),
    module_context: input.module_context ?? null,
    priority: input.priority ?? (input.submission_type === 'issue' ? 'medium' : 'low'),
    status: 'open' as const,
    user_id: userId,
  }

  const { data, error } = await supabase
    .from('support_submissions')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating submission:', error)
    throw new Error(error.message)
  }

  const created = data as SupportSubmission

  if (isSupportEmailConfigured()) {
    try {
      await sendSupportSubmissionEmail({
        ticketId: created.id,
        submissionType: created.submission_type,
        category: created.category,
        subject: created.subject,
        description: created.description,
        priority: created.priority,
        moduleContext: created.module_context,
        submitterName: created.submitter_name,
        submitterEmail: created.submitter_email,
        organizationName: created.organization_name ?? input.organization_name,
        organizationId: created.organization_id,
      })
    } catch (emailErr) {
      console.error('Support email failed:', emailErr)
      const detail = formatEmailJsError(emailErr)
      throw new Error(
        `Your request was saved but we could not email the support team: ${detail}`,
      )
    }
  }

  const { notifySupportNewSubmission } = await import('@/lib/notification-modules')
  void notifySupportNewSubmission(created)

  return created
}

export { isSupportEmailConfigured, getSupportInboxEmail } from './support-email'

export async function getRecentSupportActivity(limit: number = 50): Promise<SupportSubmissionActivity[]> {
  if (!isSupabaseConfigured) return []

  const orgId = await getOrganizationId()
  let query = supabase
    .from('support_submission_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching recent support activity:', error)
    return []
  }

  return (data ?? []) as SupportSubmissionActivity[]
}

export async function getSubmissionActivity(
  submissionId: string
): Promise<SupportSubmissionActivity[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('support_submission_activity')
    .select('*')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching submission activity:', error)
    return []
  }
  return (data ?? []) as SupportSubmissionActivity[]
}

export async function updateSubmission(
  id: string,
  input: UpdateSubmissionInput,
  previous?: SupportSubmission,
  actor?: UpdateSubmissionActor
): Promise<SupportSubmission | null> {
  if (!isSupabaseConfigured) return null

  const { data, error } = await supabase
    .from('support_submissions')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating submission:', error)
    throw new Error(error.message)
  }

  const updated = data as SupportSubmission

  if (previous && actor) {
    await logSubmissionActivity(updated, previous, input, actor)
  }

  const { notifySupportSubmissionUpdated } = await import('@/lib/notification-modules')
  void notifySupportSubmissionUpdated({
    submission: updated,
    previousStatus: previous?.status,
    previousPriority: previous?.priority,
    previousAssignedToUserId: previous?.assigned_to_user_id,
    actorUserId: actor?.userId,
  })

  return updated
}

async function logSubmissionActivity(
  updated: SupportSubmission,
  previous: SupportSubmission,
  input: UpdateSubmissionInput,
  actor: UpdateSubmissionActor
): Promise<void> {
  const rows: Array<Omit<SupportSubmissionActivity, 'id' | 'created_at'>> = []
  const notes = input.admin_notes ?? previous.admin_notes

  if (input.status && input.status !== previous.status) {
    rows.push({
      submission_id: updated.id,
      organization_id: updated.organization_id,
      actor_user_id: actor.userId,
      actor_name: actor.name,
      actor_email: actor.email,
      action_type: 'status_changed',
      from_status: previous.status,
      to_status: input.status,
      from_priority: null,
      to_priority: null,
      admin_notes: notes,
    })
  }

  if (input.priority && input.priority !== previous.priority) {
    rows.push({
      submission_id: updated.id,
      organization_id: updated.organization_id,
      actor_user_id: actor.userId,
      actor_name: actor.name,
      actor_email: actor.email,
      action_type: 'priority_changed',
      from_status: null,
      to_status: null,
      from_priority: previous.priority,
      to_priority: input.priority,
      admin_notes: null,
    })
  }

  const prevNotes = (previous.admin_notes ?? '').trim()
  const nextNotes = (input.admin_notes ?? '').trim()
  if (input.admin_notes !== undefined && nextNotes !== prevNotes) {
    rows.push({
      submission_id: updated.id,
      organization_id: updated.organization_id,
      actor_user_id: actor.userId,
      actor_name: actor.name,
      actor_email: actor.email,
      action_type: 'notes_updated',
      from_status: null,
      to_status: null,
      from_priority: null,
      to_priority: null,
      admin_notes: nextNotes || null,
    })
  }

  if (rows.length === 0) return

  const { error } = await supabase.from('support_submission_activity').insert(rows)
  if (error) {
    console.error('Error logging submission activity:', error)
  }
}

export async function deleteSubmission(id: string): Promise<void> {
  if (!isSupabaseConfigured) return

  const { error } = await supabase.from('support_submissions').delete().eq('id', id)

  if (error) {
    console.error('Error deleting submission:', error)
    throw new Error(error.message)
  }
}
