// Recruitment Database Functions
// Handles job postings and applications with Supabase

import { supabase } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import { logJobListingView } from './job-access-audit'
import type { AnonymousResumeProfile, SealedIdentity } from './anonymous-resume-profile'
import {
  applyBlindViewToApplication,
  BLIND_EMAIL,
  BLIND_FIRST_NAME,
  BLIND_LAST_NAME,
  BLIND_LOCATION,
  BLIND_PHONE,
  BLIND_RESUME_FILENAME,
  buildSealedIdentity,
  redactApplicationText,
  sealResumeProfileForStorage,
} from './anonymous-resume-profile'

export type { AnonymousResumeProfile, SealedIdentity }

export interface JobMatchCriteria {
  position?: string
  requiredSkills: string[]
  preferredSkills: string[]
  minExperience: '0-2' | '2-5' | '5-10' | '10+'
  preferredEducation: string[]
  certifications?: string[]
}

function parseMatchCriteria(v: unknown): JobMatchCriteria | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const req = parseJsonStringArray(o.required_skills ?? o.requiredSkills)
  const pref = parseJsonStringArray(o.preferred_skills ?? o.preferredSkills)
  const edu = parseJsonStringArray(o.preferred_education ?? o.preferredEducation)
  const minExp = String(o.min_experience ?? o.minExperience ?? '2-5')
  const validExp = ['0-2', '2-5', '5-10', '10+'].includes(minExp)
    ? (minExp as JobMatchCriteria['minExperience'])
    : '2-5'
  if (!req.length && !pref.length && !o.position) return undefined
  return {
    position: (o.position as string) || undefined,
    requiredSkills: req,
    preferredSkills: pref,
    minExperience: validExp,
    preferredEducation: edu.length ? edu : ["Bachelor's Degree"],
    certifications: parseJsonStringArray(o.certifications).length
      ? parseJsonStringArray(o.certifications)
      : undefined,
  }
}

function parseResumeProfile(v: unknown): AnonymousResumeProfile | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const skills = String(o.skills ?? '').trim()
  const experience = String(o.experience ?? '').trim()
  const education = String(o.education ?? '').trim()
  if (
    !skills &&
    !experience &&
    !education &&
    !o.summary &&
    !o.redacted_full_text &&
    !o.redactedFullText &&
    !o.storage_path &&
    !o.storagePath
  ) {
    return undefined
  }
  const piiRaw = o.pii_tokens ?? o.piiTokens
  const piiTokens = Array.isArray(piiRaw) ? piiRaw.map((x) => String(x)).filter(Boolean) : undefined

  const sealedRaw = o.sealed_identity ?? o.sealedIdentity
  let sealedIdentity: SealedIdentity | undefined
  if (sealedRaw && typeof sealedRaw === 'object') {
    const s = sealedRaw as Record<string, unknown>
    const sealedTokens = s.pii_tokens ?? s.piiTokens
    sealedIdentity = {
      firstName: String(s.first_name ?? s.firstName ?? ''),
      lastName: String(s.last_name ?? s.lastName ?? ''),
      email: String(s.email ?? ''),
      phone: String(s.phone ?? ''),
      location: String(s.location ?? ''),
      linkedin: (s.linkedin as string | null) ?? null,
      portfolio: (s.portfolio as string | null) ?? null,
      coverLetter: s.cover_letter != null ? String(s.cover_letter ?? s.coverLetter) : undefined,
      resumeFileName:
        s.resume_file_name != null
          ? String(s.resume_file_name ?? s.resumeFileName)
          : undefined,
      piiTokens: Array.isArray(sealedTokens)
        ? sealedTokens.map((x) => String(x)).filter(Boolean)
        : undefined,
    }
  }

  return {
    skills,
    experience,
    education,
    certifications: o.certifications ? String(o.certifications) : undefined,
    position: o.position ? String(o.position) : undefined,
    summary: o.summary ? String(o.summary) : undefined,
    redactedFullText: (o.redacted_full_text ?? o.redactedFullText)
      ? String(o.redacted_full_text ?? o.redactedFullText)
      : undefined,
    piiTokens: sealedIdentity?.piiTokens ?? piiTokens,
    storagePath: (o.storage_path ?? o.storagePath)
      ? String(o.storage_path ?? o.storagePath)
      : undefined,
    blindStoragePath: (o.blind_storage_path ?? o.blindStoragePath)
      ? String(o.blind_storage_path ?? o.blindStoragePath)
      : undefined,
    sealedIdentity,
    parsedAt: (o.parsed_at ?? o.parsedAt) ? String(o.parsed_at ?? o.parsedAt) : undefined,
  }
}

function sealedIdentityToJson(sealed: SealedIdentity): Record<string, unknown> {
  return {
    first_name: sealed.firstName,
    last_name: sealed.lastName,
    email: sealed.email,
    phone: sealed.phone,
    location: sealed.location,
    linkedin: sealed.linkedin ?? null,
    portfolio: sealed.portfolio ?? null,
    cover_letter: sealed.coverLetter ?? null,
    resume_file_name: sealed.resumeFileName ?? null,
    pii_tokens: sealed.piiTokens ?? null,
  }
}

function resumeProfileToJson(profile: AnonymousResumeProfile): Record<string, unknown> {
  return {
    skills: profile.skills,
    experience: profile.experience,
    education: profile.education,
    certifications: profile.certifications ?? null,
    position: profile.position ?? null,
    summary: profile.summary ?? null,
    redacted_full_text: profile.redactedFullText ?? null,
    pii_tokens: null,
    storage_path: profile.storagePath ?? null,
    blind_storage_path: profile.blindStoragePath ?? null,
    sealed_identity: profile.sealedIdentity ? sealedIdentityToJson(profile.sealedIdentity) : null,
    parsed_at: profile.parsedAt ?? new Date().toISOString(),
  }
}

function matchCriteriaToJson(criteria: JobMatchCriteria): Record<string, unknown> {
  return {
    position: criteria.position ?? null,
    required_skills: criteria.requiredSkills,
    preferred_skills: criteria.preferredSkills,
    min_experience: criteria.minExperience,
    preferred_education: criteria.preferredEducation,
    certifications: criteria.certifications ?? null,
  }
}

export type JobVisibility = 'public' | 'internal' | 'restricted'

export interface Job {
  id: string
  title: string
  department: string
  location: string
  type: "full-time" | "part-time" | "contract" | "internship"
  level: "entry" | "mid" | "senior" | "lead"
  salary: string
  postedDate: string
  description: string
  responsibilities: string[]
  qualifications: string[]
  benefits: string[]
  applicationCount?: number
  is_active?: boolean | string
  visibility?: JobVisibility
  restricted_departments?: string[]
  visible_to_roles?: string[] | null
  admin_visibility_override?: boolean
  matchCriteria?: JobMatchCriteria
}

type JobRow = Record<string, unknown>

function parseJsonStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x))
  if (typeof v === 'string') {
    try {
      const j = JSON.parse(v) as unknown
      return Array.isArray(j) ? j.map((x) => String(x)) : []
    } catch {
      return []
    }
  }
  return []
}

function mapJobRow(job: JobRow): Job {
  return {
    id: job.id as string,
    title: job.title as string,
    department: job.department as string,
    location: job.location as string,
    type: job.type as Job['type'],
    level: job.level as Job['level'],
    salary: job.salary as string,
    postedDate: job.posted_date as string,
    description: job.description as string,
    responsibilities: (job.responsibilities as string[]) ?? [],
    qualifications: (job.qualifications as string[]) ?? [],
    benefits: (job.benefits as string[]) ?? [],
    applicationCount: job.application_count as number | undefined,
    is_active: job.is_active as boolean | string | undefined,
    visibility: ((job.visibility as string) || 'public') as JobVisibility,
    restricted_departments: parseJsonStringArray(job.restricted_departments),
    visible_to_roles:
      job.visible_to_roles == null ? null : parseJsonStringArray(job.visible_to_roles),
    admin_visibility_override: !!(job.admin_visibility_override as boolean),
    matchCriteria: parseMatchCriteria(job.match_criteria),
  }
}

type JobViewer = { department: string | null; role: string }

async function getJobViewerProfile(): Promise<JobViewer | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user?.id) return null
  const { data } = await supabase
    .from('user_profiles')
    .select('department, role')
    .eq('id', session.user.id)
    .maybeSingle()
  if (!data) return null
  return {
    department: (data.department as string | null) ?? null,
    role: (data.role as string) ?? 'member',
  }
}

function isJobRowActive(row: JobRow): boolean {
  return row.is_active !== false && row.is_active !== 'false'
}

/** Anonymous users only see active public listings. Authenticated org users see listings allowed by RBAC. */
function jobRowVisibleToViewer(row: JobRow, viewer: JobViewer | null): boolean {
  if (!isJobRowActive(row)) return false
  if (row.admin_visibility_override) return true
  const vis = String(row.visibility ?? 'public').toLowerCase() as JobVisibility
  if (!viewer) {
    return vis === 'public'
  }
  if (vis === 'public' || vis === 'internal') return true
  if (vis === 'restricted') {
    const role = (viewer.role || '').toLowerCase()
    if (role === 'owner' || role === 'admin') return true
    const depts = parseJsonStringArray(row.restricted_departments).map((d) => d.toLowerCase().trim())
    const roles = row.visible_to_roles != null ? parseJsonStringArray(row.visible_to_roles).map((r) => r.toLowerCase()) : []
    const ud = (viewer.department ?? '').toLowerCase().trim()
    if (depts.length > 0 && ud && depts.includes(ud)) return true
    if (roles.length > 0 && roles.includes(role)) return true
    if (depts.length === 0 && roles.length === 0) return true
    return false
  }
  return true
}

async function filterJobRows(rows: JobRow[] | null): Promise<Job[]> {
  if (!rows?.length) return []
  const viewer = await getJobViewerProfile()
  const filtered = rows.filter((r) => jobRowVisibleToViewer(r, viewer))
  return filtered.map(mapJobRow)
}

/** Shown in HR when the applicant is still anonymized (avoids leaking names from upload filenames). */
export const ANONYMIZED_RESUME_LABEL = 'Resume (PDF)'

export function getResumeDisplayName(
  resumeFileName: string | null | undefined,
  isRevealed: boolean
): string | null {
  const trimmed = resumeFileName?.trim()
  if (!trimmed) return null
  return isRevealed ? trimmed : ANONYMIZED_RESUME_LABEL
}

export function hasResumeAttachment(application: {
  resumeFileName?: string | null
  resumeUrl?: string | null
}): boolean {
  return Boolean(application.resumeFileName?.trim() || application.resumeUrl?.trim())
}

export interface JobApplication {
  id?: string
  anonymousId?: string
  jobId: string
  jobTitle?: string
  department?: string
  status?: "new" | "reviewing" | "interview-scheduled" | "interviewed" | "offer" | "rejected" | "withdrawn"
  appliedDate?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  resumeFileName?: string | null
  resumeUrl?: string | null
  coverLetter: string
  linkedin?: string | null
  portfolio?: string | null
  isRevealed?: boolean
  revealedAt?: string | null
  revealedBy?: string | null
  revealedByName?: string | null
  notes?: string | null
  rating?: number | null
  interviewDate?: string | null
  resumeProfile?: AnonymousResumeProfile | null
}

/**
 * Fetch active job postings visible to the current viewer (or public only if signed out).
 */
export async function getAllJobs(): Promise<Job[]> {
  let query = supabase
    .from('job_postings')
    .select('*')
    .order('posted_date', { ascending: false })

  // Authenticated users (HR) are org-scoped. Signed-out careers viewers stay visibility-filtered only.
  try {
    const orgId = await getOrganizationId()
    query = query.eq('organization_id', orgId)
  } catch {
    // No organization — public careers path
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching jobs:', error)
    throw error
  }

  return filterJobRows(data as JobRow[])
}

/**
 * Fetch a single job posting by ID (respects visibility for current viewer).
 */
export async function getJobById(jobId: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .eq('id', jobId)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching job:', error)
    return null
  }

  const row = data as JobRow
  const viewer = await getJobViewerProfile()
  if (!jobRowVisibleToViewer(row, viewer)) return null

  void logJobListingView(jobId)
  return mapJobRow(row)
}

/**
 * Filter jobs by search query, location, and department
 */
export async function searchJobs(
  searchQuery?: string,
  location?: string,
  department?: string
): Promise<Job[]> {
  let query = supabase
    .from('job_postings')
    .select('*')
    .eq('is_active', true)

  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,department.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
  }

  if (location && location !== 'all') {
    query = query.ilike('location', `%${location}%`)
  }

  if (department && department !== 'all') {
    query = query.eq('department', department)
  }

  const { data, error } = await query.order('posted_date', { ascending: false })

  if (error) {
    console.error('Error searching jobs:', error)
    return []
  }

  return filterJobRows(data as JobRow[])
}

/**
 * Submit a new job application
 */
export type SubmitApplicationResult = { ok: true; applicationId: string } | { ok: false }

export async function submitJobApplication(
  application: JobApplication,
): Promise<SubmitApplicationResult> {
  const anonymousId = application.anonymousId || generateAnonymousId()
  const sealed = buildSealedIdentity(application)
  const piiTokens = application.resumeProfile?.piiTokens ?? sealed.piiTokens

  let resumeProfile = application.resumeProfile
  if (resumeProfile) {
    resumeProfile = sealResumeProfileForStorage(resumeProfile, sealed)
  }

  const redactedCover = redactApplicationText(application.coverLetter, piiTokens)

  const basePayload: Record<string, unknown> = {
    anonymous_id: anonymousId,
    job_id: application.jobId,
    status: 'new',
    first_name: BLIND_FIRST_NAME,
    last_name: BLIND_LAST_NAME,
    email: BLIND_EMAIL,
    phone: BLIND_PHONE,
    location: BLIND_LOCATION,
    resume_file_name: application.resumeFileName ? BLIND_RESUME_FILENAME : null,
    resume_url: application.resumeUrl || null,
    cover_letter: redactedCover,
    linkedin: null,
    portfolio: null,
    is_revealed: false,
  }

  if (resumeProfile) {
    basePayload.resume_profile = resumeProfileToJson(resumeProfile)
  }

  let applicantUserId: string | null = null
  try {
    applicantUserId = await getCurrentUserId()
    basePayload.user_id = applicantUserId
    const orgId = await getOrganizationId()
    if (orgId) basePayload.organization_id = orgId
  } catch {
    applicantUserId = null
  }

  let { data, error } = await supabase
    .from('job_applications')
    .insert(basePayload)
    .select('id')
    .single()

  if (error?.message?.includes('resume_profile') || error?.message?.includes('schema cache')) {
    delete basePayload.resume_profile
    const retry = await supabase.from('job_applications').insert(basePayload).select('id').single()
    data = retry.data
    error = retry.error
  }

  if (error || !data?.id) {
    console.error('Error submitting application:', error)
    return { ok: false }
  }

  try {
    const { data: jobRow } = await supabase
      .from('job_postings')
      .select('title')
      .eq('id', application.jobId)
      .maybeSingle()

    const { notifyHrNewApplication } = await import('@/lib/notification-modules')
    void notifyHrNewApplication({
      applicationId: data.id as string,
      jobTitle: (jobRow?.title as string) ?? application.jobTitle,
      anonymousId,
    })

    if (applicantUserId) {
      const { notifyCandidateApplicationReceived } = await import('@/lib/notification-modules')
      void notifyCandidateApplicationReceived({
        recipientUserId: applicantUserId,
        applicationId: data.id as string,
        jobTitle: (jobRow?.title as string) ?? application.jobTitle,
      })
    }
  } catch (notifyErr) {
    console.warn('[recruitment-db] Application notification skipped:', notifyErr)
  }

  window.dispatchEvent(new CustomEvent('applicationUpdated'))
  return { ok: true, applicationId: data.id as string }
}

// Helper function to generate anonymous ID
function generateAnonymousId(): string {
  const year = new Date().getFullYear()
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `APL-${year}-${timestamp}-${random}`
}

/**
 * Get all job applications (for HR/recruiter dashboard)
 */
export async function getAllApplications(): Promise<JobApplication[]> {
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('job_applications')
    .select(`
      *,
      job_postings (
        title,
        department
      )
    `)
    .eq('organization_id', orgId)
    .order('applied_date', { ascending: false })

  if (error) {
    console.error('Error fetching applications:', error)
    throw error
  }

  const mapped = (data ?? []).map(mapApplicationRow)
  const { reconcileHrInterviewReminders } = await import('@/lib/hr-notifications-reconcile')
  return reconcileHrInterviewReminders(mapped)
}

function mapApplicationRow(app: Record<string, unknown>): JobApplication {
  const postings = app.job_postings as { title?: string; department?: string } | null
  const mapped: JobApplication = {
    id: app.id as string,
    anonymousId: app.anonymous_id as string,
    jobId: app.job_id as string,
    jobTitle: postings?.title || '',
    department: postings?.department || '',
    status: app.status as JobApplication['status'],
    appliedDate: app.applied_date as string,
    firstName: app.first_name as string,
    lastName: app.last_name as string,
    email: app.email as string,
    phone: app.phone as string,
    location: app.location as string,
    resumeFileName: app.resume_file_name as string | null,
    resumeUrl: app.resume_url as string | null,
    coverLetter: app.cover_letter as string,
    linkedin: app.linkedin as string | null,
    portfolio: app.portfolio as string | null,
    isRevealed: app.is_revealed as boolean,
    revealedAt: app.revealed_at as string | null,
    revealedBy: app.revealed_by as string | null,
    revealedByName: app.revealed_by_name as string | null,
    notes: app.notes as string | null,
    rating: app.rating as number | null,
    interviewDate: app.interview_date as string | null,
    resumeProfile: parseResumeProfile(app.resume_profile) ?? null,
  }
  return applyBlindViewToApplication(mapped)
}

export function applicationResumeStoragePath(applicationId: string, fileName?: string): string {
  const ext = fileName?.split('.').pop()?.toLowerCase() || 'pdf'
  return `applications/${applicationId}/resume.${ext}`
}

/** Pre-redacted PDF generated at upload for blind review downloads. */
export function applicationBlindResumeStoragePath(applicationId: string): string {
  return `applications/${applicationId}/resume-blind.pdf`
}

/**
 * Upload resume PDF for an application (careers apply, HR add-candidate, or backfill).
 */
export async function uploadApplicationResume(
  applicationId: string,
  file: File,
): Promise<string | null> {
  const path = applicationResumeStoragePath(applicationId, file.name)

  const { error } = await supabase.storage.from('application-resumes').upload(path, file, {
    upsert: true,
    contentType: file.type || 'application/pdf',
  })

  if (error) {
    console.warn('[recruitment-db] Resume upload skipped:', error.message)
    return null
  }

  const { error: urlError } = await supabase
    .from('job_applications')
    .update({ resume_url: path })
    .eq('id', applicationId)

  if (urlError) {
    console.warn(
      '[recruitment-db] resume_url update failed (run supabase-hr-resume-anon-update-migration.sql for public apply):',
      urlError.message,
    )
  }

  const { data: existing } = await supabase
    .from('job_applications')
    .select('resume_profile')
    .eq('id', applicationId)
    .maybeSingle()

  const current = parseResumeProfile(existing?.resume_profile) ?? {
    skills: '',
    experience: '',
    education: '',
  }
  let blindPath: string | null = null
  try {
    const { generateAndStoreBlindedResumePdf } = await import('./anonymized-resume-pdf')
    blindPath = await generateAndStoreBlindedResumePdf(applicationId, file)
  } catch (err) {
    console.warn('[recruitment-db] Blind resume PDF generation skipped:', err)
  }

  const { error: profileError } = await supabase
    .from('job_applications')
    .update({
      resume_profile: resumeProfileToJson({
        ...current,
        storagePath: path,
        blindStoragePath: blindPath ?? current.blindStoragePath,
        sealedIdentity: current.sealedIdentity,
      }),
    })
    .eq('id', applicationId)

  if (profileError) {
    console.warn('[recruitment-db] resume_profile storage update failed:', profileError.message)
  }

  return path
}

/**
 * Persist anonymous resume profile (e.g. backfill or re-parse).
 */
export async function updateApplicationResumeProfile(
  applicationId: string,
  profile: AnonymousResumeProfile,
): Promise<boolean> {
  const { error } = await supabase
    .from('job_applications')
    .update({ resume_profile: resumeProfileToJson(profile) })
    .eq('id', applicationId)

  if (error) {
    console.error('Error updating resume profile:', error)
    return false
  }
  return true
}

/**
 * Save per-job match criteria used for blind candidate ranking.
 */
export async function updateJobMatchCriteria(
  jobId: string,
  criteria: JobMatchCriteria,
): Promise<boolean> {
  const { error } = await supabase
    .from('job_postings')
    .update({ match_criteria: matchCriteriaToJson(criteria) })
    .eq('id', jobId)

  if (error) {
    if (error.message?.includes('match_criteria') || error.message?.includes('schema cache')) {
      console.warn('[recruitment-db] match_criteria column missing — run supabase-hr-recruitment-matching-migration.sql')
    } else {
      console.error('Error updating match criteria:', error)
    }
    return false
  }
  return true
}

/**
 * Fetch all jobs with match criteria (for scoring in recruitment dashboard).
 */
export async function getJobsForMatching(): Promise<Job[]> {
  return getAllJobs()
}

/**
 * Get applications for a specific job
 */
export async function getApplicationsByJob(jobId: string): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select(`
      *,
      job_postings (
        title,
        department
      )
    `)
    .eq('job_id', jobId)
    .order('applied_date', { ascending: false })

  if (error) {
    console.error('Error fetching applications for job:', error)
    return []
  }

  return data.map(mapApplicationRow)
}

/** Portal-friendly application status labels for the employee jobs page. */
export type PortalApplicationStatus = 'under-review' | 'interview' | 'offer' | 'rejected'

export function mapApplicationStatusForPortal(
  status: JobApplication['status'] | undefined
): PortalApplicationStatus {
  switch (status) {
    case 'interview-scheduled':
    case 'interviewed':
      return 'interview'
    case 'offer':
      return 'offer'
    case 'rejected':
    case 'withdrawn':
      return 'rejected'
    default:
      return 'under-review'
  }
}

/**
 * Applications submitted by the signed-in user (employee portal).
 * Requires user_id on the application row (set at submit time when logged in).
 */
export async function getApplicationsByUserId(userId: string): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select(`
      *,
      job_postings (
        title,
        department
      )
    `)
    .eq('user_id', userId)
    .order('applied_date', { ascending: false })

  if (error) {
    console.error('Error fetching applications for user:', error)
    return []
  }

  return data.map(mapApplicationRow)
}

export async function getApplicationsForCurrentUser(): Promise<JobApplication[]> {
  try {
    const userId = await getCurrentUserId()
    return getApplicationsByUserId(userId)
  } catch {
    return []
  }
}

export async function hasUserAppliedToJob(jobId: string, userId?: string): Promise<boolean> {
  let uid = userId
  if (!uid) {
    try {
      uid = await getCurrentUserId()
    } catch {
      return false
    }
  }

  const { count, error } = await supabase
    .from('job_applications')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('user_id', uid)

  if (error) {
    console.error('Error checking existing application:', error)
    return false
  }

  return (count ?? 0) > 0
}

export type SubmitEmployeeApplicationResult =
  | { ok: true; applicationId: string }
  | { ok: false; reason?: 'already_applied' | 'submit_failed' }

/** Submit an internal job application from the employee portal. */
export async function submitEmployeeJobApplication(options: {
  jobId: string
  jobTitle?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  location?: string
  coverLetter?: string
}): Promise<SubmitEmployeeApplicationResult> {
  if (await hasUserAppliedToJob(options.jobId)) {
    return { ok: false, reason: 'already_applied' }
  }

  const result = await submitJobApplication({
    jobId: options.jobId,
    jobTitle: options.jobTitle,
    firstName: options.firstName,
    lastName: options.lastName,
    email: options.email,
    phone: options.phone ?? '',
    location: options.location ?? '',
    coverLetter: options.coverLetter?.trim() || 'Internal employee application.',
  })

  if (!result.ok) return { ok: false, reason: 'submit_failed' }
  return result
}

/** Resolve the applicant auth user for candidate notifications. */
export async function resolveApplicantUserIdForApplication(
  applicationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('user_id, resume_profile')
    .eq('id', applicationId)
    .maybeSingle()

  if (error || !data) return null
  if (data.user_id) return data.user_id as string

  const profile = parseResumeProfile(data.resume_profile)
  const email = profile?.sealedIdentity?.email
  if (!email) return null

  const { resolveUserIdFromEmail } = await import('@/lib/notification-recipients')
  return resolveUserIdFromEmail(email)
}

async function resolveJobTitleForApplication(applicationId: string): Promise<string | null> {
  const { data } = await supabase
    .from('job_applications')
    .select('job_postings ( title )')
    .eq('id', applicationId)
    .maybeSingle()

  const postings = data?.job_postings as { title?: string } | null
  return postings?.title?.trim() ?? null
}

async function dispatchCandidateApplicationNotifications(options: {
  applicationId: string
  status: NonNullable<JobApplication['status']>
  previousStatus?: string | null
  interviewDate?: string | null
  isInterviewUpdate?: boolean
}): Promise<void> {
  if (options.previousStatus === options.status && !options.isInterviewUpdate) return

  const recipientUserId = await resolveApplicantUserIdForApplication(options.applicationId)
  if (!recipientUserId) return

  const jobTitle = await resolveJobTitleForApplication(options.applicationId)
  const {
    notifyCandidateInterviewScheduled,
    notifyCandidateOfferExtended,
    notifyCandidateApplicationRejected,
  } = await import('@/lib/notification-modules')

  if (options.status === 'interview-scheduled' || options.isInterviewUpdate) {
    await notifyCandidateInterviewScheduled({
      recipientUserId,
      applicationId: options.applicationId,
      jobTitle,
      interviewDate: options.interviewDate,
      isUpdate: options.isInterviewUpdate,
    })
    return
  }

  if (options.status === 'offer') {
    await notifyCandidateOfferExtended({
      recipientUserId,
      applicationId: options.applicationId,
      jobTitle,
    })
    return
  }

  if (options.status === 'rejected') {
    await notifyCandidateApplicationRejected({
      recipientUserId,
      applicationId: options.applicationId,
      jobTitle,
    })
  }
}

/** Statuses where identity stays visible (no re-anonymization). */
export const IDENTITY_VISIBLE_STATUSES = [
  'interviewed',
  'offer',
  'rejected',
  'withdrawn',
] as const

const PRE_INTERVIEW_STATUSES = ['new', 'reviewing', 'interview-scheduled'] as const
const POST_INTERVIEW_STATUSES = ['interviewed', 'interview-scheduled', 'offer'] as const

/**
 * Update application status.
 * Rejected/withdrawn candidates stay identified — recruiters already know them after interview.
 * Identity is only re-hidden when moving back to pre-interview stages.
 */
export async function updateApplicationStatus(
  applicationId: string,
  status: "new" | "reviewing" | "interview-scheduled" | "interviewed" | "offer" | "rejected" | "withdrawn"
): Promise<boolean> {
  const { data: current, error: fetchError } = await supabase
    .from('job_applications')
    .select('status, is_revealed')
    .eq('id', applicationId)
    .maybeSingle()

  if (fetchError) {
    console.error('Error loading application before status update:', fetchError)
    return false
  }

  const updateData: Record<string, unknown> = { status }
  const prevStatus = current?.status as string | undefined
  const wasRevealed = !!current?.is_revealed

  if (PRE_INTERVIEW_STATUSES.includes(status as (typeof PRE_INTERVIEW_STATUSES)[number])) {
    updateData.is_revealed = false
    updateData.revealed_at = null
    updateData.revealed_by = null
  } else if (
    (status === 'rejected' || status === 'withdrawn') &&
    prevStatus &&
    POST_INTERVIEW_STATUSES.includes(prevStatus as (typeof POST_INTERVIEW_STATUSES)[number]) &&
    !wasRevealed
  ) {
    const { data: { user } } = await supabase.auth.getUser()
    updateData.is_revealed = true
    updateData.revealed_at = new Date().toISOString()
    updateData.revealed_by = user?.id ?? null
  }

  const { error } = await supabase
    .from('job_applications')
    .update(updateData)
    .eq('id', applicationId)

  if (error) {
    console.error('Error updating application status:', error)
    return false
  }

  try {
    const { data: appRow } = await supabase
      .from('job_applications')
      .select('interview_date')
      .eq('id', applicationId)
      .maybeSingle()

    await dispatchCandidateApplicationNotifications({
      applicationId,
      status,
      previousStatus: prevStatus,
      interviewDate: (appRow?.interview_date as string | null) ?? null,
    })
  } catch (notifyErr) {
    console.warn('[recruitment-db] Candidate status notification skipped:', notifyErr)
  }

  window.dispatchEvent(new CustomEvent('applicationUpdated'))
  return true
}

/**
 * Reveal applicant information.
 * Persists both the auth user id (`revealed_by`, uuid) and a friendly display
 * name (`revealed_by_name`, text) so the UI can render "Revealed by Jane Doe".
 */
const REVEAL_ALLOWED_STATUSES = ['interviewed', 'offer', 'rejected', 'withdrawn'] as const

export async function revealApplicantInfo(applicationId: string): Promise<boolean> {
  const { data: row, error: fetchError } = await supabase
    .from('job_applications')
    .select('status')
    .eq('id', applicationId)
    .maybeSingle()

  if (fetchError || !row?.status) {
    console.error('Error loading application before reveal:', fetchError)
    return false
  }

  if (!REVEAL_ALLOWED_STATUSES.includes(row.status as (typeof REVEAL_ALLOWED_STATUSES)[number])) {
    console.warn(
      '[recruitment-db] Reveal blocked: status must be interviewed or offer, got',
      row.status,
    )
    return false
  }

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  // Try to derive a human-readable name: hr_employees.name → user metadata → email
  let recruiterName: string | null = null
  if (userId) {
    const { data: emp } = await supabase
      .from('hr_employees')
      .select('name')
      .eq('user_id', userId)
      .maybeSingle()
    recruiterName = emp?.name ?? null
  }
  if (!recruiterName) {
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string }
    recruiterName = meta.full_name || meta.name || user?.email || null
  }

  const { error } = await supabase
    .from('job_applications')
    .update({
      is_revealed: true,
      revealed_at: new Date().toISOString(),
      revealed_by: userId,
      revealed_by_name: recruiterName,
    })
    .eq('id', applicationId)

  if (error) {
    console.error('Error revealing applicant info:', error)
    return false
  }

  return true
}

/**
 * Delete an application
 */
export async function deleteApplication(applicationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('job_applications')
    .delete()
    .eq('id', applicationId)

  if (error) {
    console.error('Error deleting application:', error)
    return false
  }

  // Dispatch event to notify other components
  window.dispatchEvent(new CustomEvent('applicationUpdated'))

  return true
}

/**
 * Add or update notes for an application
 */
export async function updateApplicationNotes(
  applicationId: string,
  notes: string
): Promise<boolean> {
  const { error } = await supabase
    .from('job_applications')
    .update({ notes })
    .eq('id', applicationId)

  if (error) {
    console.error('Error updating application notes:', error)
    return false
  }

  return true
}

/**
 * Rate an application
 */
export async function rateApplication(
  applicationId: string,
  rating: number
): Promise<boolean> {
  const { error } = await supabase
    .from('job_applications')
    .update({ rating })
    .eq('id', applicationId)

  if (error) {
    console.error('Error rating application:', error)
    return false
  }

  return true
}

export type CreateJobResult = { id: string } | { error: string }

/**
 * Create a new job posting
 */
export async function createJob(
  job: Omit<Job, 'id' | 'applicationCount'>,
): Promise<CreateJobResult> {
  const title = typeof job.title === 'string' ? job.title.trim() : ''
  if (!title) {
    return { error: 'Title is required' }
  }
  const department = typeof job.department === 'string' ? job.department.trim() : ''
  if (!department) {
    return { error: 'Department is required' }
  }
  if (!job.type) {
    return { error: 'Type is required' }
  }
  if (!job.level) {
    return { error: 'Level is required' }
  }

  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const corePayload: Record<string, unknown> = {
    title,
    department,
    location: job.location,
    type: job.type,
    level: job.level,
    salary: job.salary,
    posted_date: job.postedDate,
    description: job.description,
    responsibilities: job.responsibilities,
    qualifications: job.qualifications,
    benefits: job.benefits,
    is_active: true,
    user_id: userId,
    organization_id: orgId,
  }

  const rbacFields: Record<string, unknown> = {
    visibility: job.visibility ?? 'public',
    restricted_departments: job.restricted_departments ?? [],
    visible_to_roles: job.visible_to_roles ?? null,
    admin_visibility_override: job.admin_visibility_override ?? false,
  }

  console.info('[recruitment-db] createJob attempt:', { title, department })

  try {
    // Try with RBAC columns first (requires migration applied)
    const { data, error } = await supabase
      .from('job_postings')
      .insert({ ...corePayload, ...rbacFields })
      .select('id')
      .single()

    if (error) {
      // If failure is due to missing RBAC columns, retry without them
      if (error.message?.includes('column') || error.message?.includes('schema cache')) {
        console.warn('[recruitment-db] RBAC columns missing, retrying without them')
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('job_postings')
          .insert(corePayload)
          .select('id')
          .single()

        if (fallbackError) {
          console.error('Error creating job (fallback):', fallbackError)
          return { error: fallbackError.message }
        }
        if (!fallbackData?.id) {
          return { error: 'Insert succeeded but no id was returned' }
        }
        return { id: fallbackData.id }
      }

      console.error('Error creating job:', error)
      return { error: error.message }
    }

    if (!data?.id) {
      return { error: 'Insert succeeded but no id was returned' }
    }

    return { id: data.id }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('Error creating job:', e)
    return { error: message }
  }
}

/** Update visibility / department restrictions for an existing posting (HR admin). */
export async function updateJobPostingRbac(
  jobId: string,
  patch: {
    visibility?: JobVisibility
    restricted_departments?: string[]
    visible_to_roles?: string[] | null
    admin_visibility_override?: boolean
  },
): Promise<boolean> {
  const updatePayload: Record<string, unknown> = {}
  if (patch.visibility !== undefined) updatePayload.visibility = patch.visibility
  if (patch.restricted_departments !== undefined)
    updatePayload.restricted_departments = patch.restricted_departments
  if (patch.visible_to_roles !== undefined) updatePayload.visible_to_roles = patch.visible_to_roles
  if (patch.admin_visibility_override !== undefined)
    updatePayload.admin_visibility_override = patch.admin_visibility_override

  if (Object.keys(updatePayload).length === 0) return true

  const { error } = await supabase.from('job_postings').update(updatePayload).eq('id', jobId)
  if (error) {
    console.error('Error updating job RBAC:', error)
    return false
  }
  return true
}

/**
 * Soft-delete a job posting (sets is_active = false).
 * Keeps applications linked to the role; hides the listing from Careers and HR active lists.
 */
export async function deleteJob(jobId: string): Promise<{ ok: true } | { error: string }> {
  const id = typeof jobId === 'string' ? jobId.trim() : ''
  if (!id) {
    return { error: 'Job id is required' }
  }

  const { error } = await supabase
    .from('job_postings')
    .update({ is_active: false })
    .eq('id', id)

  if (error) {
    console.error('Error deleting job:', error)
    return { error: error.message }
  }

  window.dispatchEvent(new CustomEvent('jobPostingsUpdated'))
  return { ok: true }
}

/**
 * Schedule (or update) an interview for an application.
 *
 * When `preserveStatus` is true the application's status field is left alone.
 * That's what we use when editing an interview that has already happened
 * (status="interviewed" or "offer") so the recruiter can tweak date/notes
 * without rewinding the candidate's pipeline stage.
 */
export async function scheduleInterview(
  applicationId: string,
  interviewDate: string,
  notes?: string,
  options: { preserveStatus?: boolean } = {}
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    interview_date: interviewDate,
  }
  if (!options.preserveStatus) {
    updateData.status = 'interview-scheduled'
  }
  if (notes !== undefined) {
    updateData.notes = notes
  }

  const { error } = await supabase
    .from('job_applications')
    .update(updateData)
    .eq('id', applicationId)

  if (error) {
    console.error('Error scheduling interview:', error)
    return false
  }

  try {
    const { data: appRow } = await supabase
      .from('job_applications')
      .select(`
        id,
        anonymous_id,
        interview_date,
        job_postings ( title )
      `)
      .eq('id', applicationId)
      .maybeSingle()

    if (appRow) {
      const postings = appRow.job_postings as { title?: string } | null
      const { notifyHrInterviewScheduled } = await import('@/lib/notification-modules')
      void notifyHrInterviewScheduled({
        applicationId,
        anonymousId: appRow.anonymous_id as string | null,
        jobTitle: postings?.title,
        interviewDate: interviewDate,
        isUpdate: options.preserveStatus === true,
      })

      await dispatchCandidateApplicationNotifications({
        applicationId,
        status: 'interview-scheduled',
        interviewDate,
        isInterviewUpdate: options.preserveStatus === true,
      })
    }
  } catch (notifyErr) {
    console.warn('[recruitment-db] Interview notification skipped:', notifyErr)
  }

  window.dispatchEvent(new CustomEvent('applicationUpdated'))
  return true
}

/**
 * Cancel a scheduled interview: clears interview_date and rewinds status to
 * "reviewing" so the candidate stays in the pipeline. Notes are preserved
 * (recruiters often want context on why an interview was canceled).
 */
export async function cancelInterview(applicationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('job_applications')
    .update({
      interview_date: null,
      status: 'reviewing',
    })
    .eq('id', applicationId)

  if (error) {
    console.error('Error canceling interview:', error)
    return false
  }

  window.dispatchEvent(new CustomEvent('applicationUpdated'))
  return true
}

/**
 * Get job statistics
 */
export async function getJobStatistics() {
  const { data: jobsData } = await supabase
    .from('job_postings')
    .select('id')
    .eq('is_active', true)

  const { data: applicationsData } = await supabase
    .from('job_applications')
    .select('status')

  const totalJobs = jobsData?.length || 0
  const totalApplications = applicationsData?.length || 0
  const newApplications = applicationsData?.filter(app => app.status === 'new').length || 0
  const reviewing = applicationsData?.filter(app => app.status === 'reviewing').length || 0
  const interviewed = applicationsData?.filter(app => app.status === 'interviewed').length || 0

  return {
    totalJobs,
    totalApplications,
    newApplications,
    reviewing,
    interviewed,
  }
}

/**
 * Returns a Map of jobId -> applicationCount derived from job_applications.
 * Useful because there is no application_count column on job_postings.
 */
export async function getApplicationCountsByJob(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const { data, error } = await supabase
    .from('job_applications')
    .select('job_id')

  if (error || !data) {
    if (error) console.error('Error fetching application counts:', error)
    return counts
  }

  for (const row of data as Array<{ job_id: string | null }>) {
    if (!row.job_id) continue
    counts.set(row.job_id, (counts.get(row.job_id) ?? 0) + 1)
  }
  return counts
}

// -----------------------------------------------------------------------------
// Talent pool — interviewed candidates held for future roles
// -----------------------------------------------------------------------------

export type TalentPoolStatus = 'active' | 'archived' | 'contacted' | 'hired'

export interface TalentPoolEntry {
  id: string
  organizationId?: string | null
  sourceApplicationId?: string | null
  anonymousId?: string | null
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  linkedin?: string | null
  portfolio?: string | null
  resumeProfile?: AnonymousResumeProfile | null
  resumeUrl?: string | null
  resumeFileName?: string | null
  sourceJobId?: string | null
  sourceJobTitle?: string | null
  sourceDepartment?: string | null
  interviewedAt?: string | null
  interviewNotes?: string | null
  rating?: number | null
  poolStatus: TalentPoolStatus
  recruiterNotes?: string | null
  tags: string[]
  availabilityNotes?: string | null
  addedAt?: string
  addedBy?: string | null
  addedByName?: string | null
}

export type AddToTalentPoolResult =
  | { ok: true; entryId: string; alreadyExists?: boolean }
  | { ok: false; error: string }

function parseTagsJson(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean)
  return []
}

function mapTalentPoolRow(row: Record<string, unknown>): TalentPoolEntry {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string | null,
    sourceApplicationId: row.source_application_id as string | null,
    anonymousId: row.anonymous_id as string | null,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    email: row.email as string,
    phone: (row.phone as string) ?? '',
    location: (row.location as string) ?? '',
    linkedin: row.linkedin as string | null,
    portfolio: row.portfolio as string | null,
    resumeProfile: parseResumeProfile(row.resume_profile) ?? null,
    resumeUrl: row.resume_url as string | null,
    resumeFileName: row.resume_file_name as string | null,
    sourceJobId: row.source_job_id as string | null,
    sourceJobTitle: row.source_job_title as string | null,
    sourceDepartment: row.source_department as string | null,
    interviewedAt: row.interviewed_at as string | null,
    interviewNotes: row.interview_notes as string | null,
    rating: row.rating != null ? Number(row.rating) : null,
    poolStatus: (row.pool_status as TalentPoolStatus) ?? 'active',
    recruiterNotes: row.recruiter_notes as string | null,
    tags: parseTagsJson(row.tags),
    availabilityNotes: row.availability_notes as string | null,
    addedAt: (row.added_at as string | null) ?? undefined,
    addedBy: row.added_by as string | null,
    addedByName: row.added_by_name as string | null,
  }
}

/** Load one application with identity unsealed for internal HR use (talent pool snapshot). */
export async function getApplicationByIdUnsealed(applicationId: string): Promise<JobApplication | null> {
  const { data, error } = await supabase
    .from('job_applications')
    .select(`
      *,
      job_postings ( title, department )
    `)
    .eq('id', applicationId)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('Error fetching application:', error)
    return null
  }

  const mapped = mapApplicationRow(data as Record<string, unknown>)
  return applyBlindViewToApplication({ ...mapped, isRevealed: true })
}

export async function isApplicationInTalentPool(applicationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('recruitment_talent_pool')
    .select('id')
    .eq('source_application_id', applicationId)
    .maybeSingle()

  if (error?.message?.includes('recruitment_talent_pool') || error?.message?.includes('schema cache')) {
    return false
  }
  return Boolean(data?.id)
}

/**
 * Save an interviewed candidate to the org talent pool for future openings.
 * Requires identity to have been revealed or sealed on the application row.
 */
export async function addApplicationToTalentPool(
  applicationId: string,
  options?: {
    recruiterNotes?: string
    tags?: string[]
    availabilityNotes?: string
  },
): Promise<AddToTalentPoolResult> {
  const { data: existingRow } = await supabase
    .from('recruitment_talent_pool')
    .select('id')
    .eq('source_application_id', applicationId)
    .maybeSingle()

  if (existingRow?.id) {
    return { ok: true, entryId: existingRow.id as string, alreadyExists: true }
  }

  const app = await getApplicationByIdUnsealed(applicationId)
  if (!app?.id) {
    return { ok: false, error: 'Application not found' }
  }

  const interviewedStatuses = ['interviewed', 'interview-scheduled', 'offer', 'rejected']
  if (!app.status || !interviewedStatuses.includes(app.status)) {
    return {
      ok: false,
      error: 'Only candidates who reached interview stage can be added to the talent pool',
    }
  }

  const orgId = await getOrganizationId()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  let recruiterName: string | null = null
  if (userId) {
    const { data: emp } = await supabase
      .from('hr_employees')
      .select('name')
      .eq('user_id', userId)
      .maybeSingle()
    recruiterName = emp?.name ?? null
  }
  if (!recruiterName) {
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string }
    recruiterName = meta.full_name || meta.name || user?.email || null
  }

  const payload: Record<string, unknown> = {
    organization_id: orgId,
    source_application_id: app.id,
    anonymous_id: app.anonymousId ?? null,
    first_name: app.firstName,
    last_name: app.lastName,
    email: app.email,
    phone: app.phone,
    location: app.location,
    linkedin: app.linkedin ?? null,
    portfolio: app.portfolio ?? null,
    resume_profile: app.resumeProfile ? resumeProfileToJson(app.resumeProfile) : null,
    resume_url: app.resumeUrl ?? null,
    resume_file_name: app.resumeFileName ?? null,
    source_job_id: app.jobId,
    source_job_title: app.jobTitle ?? null,
    source_department: app.department ?? null,
    interviewed_at: app.interviewDate ?? app.appliedDate ?? new Date().toISOString(),
    interview_notes: app.notes ?? null,
    rating: app.rating ?? null,
    pool_status: 'active',
    recruiter_notes: options?.recruiterNotes?.trim() || null,
    tags: options?.tags ?? [],
    availability_notes: options?.availabilityNotes?.trim() || null,
    added_by: userId,
    added_by_name: recruiterName,
  }

  const { data, error } = await supabase
    .from('recruitment_talent_pool')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    if (error.message?.includes('recruitment_talent_pool') || error.message?.includes('schema cache')) {
      return {
        ok: false,
        error: 'Talent pool table missing — run supabase-hr-talent-pool-migration.sql in Supabase',
      }
    }
    console.error('Error adding to talent pool:', error)
    return { ok: false, error: error.message }
  }

  window.dispatchEvent(new CustomEvent('talentPoolUpdated'))
  return { ok: true, entryId: data.id as string }
}

/** Application IDs already linked to a talent pool row. */
export async function getTalentPoolApplicationIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('recruitment_talent_pool')
    .select('source_application_id')

  if (error) {
    if (error.message?.includes('recruitment_talent_pool')) return new Set()
    return new Set()
  }

  const ids = new Set<string>()
  for (const row of data ?? []) {
    const id = (row as { source_application_id?: string }).source_application_id
    if (id) ids.add(id)
  }
  return ids
}

export async function getTalentPoolEntries(
  status: TalentPoolStatus | 'all' = 'active',
): Promise<TalentPoolEntry[]> {
  let query = supabase
    .from('recruitment_talent_pool')
    .select('*')
    .order('added_at', { ascending: false })

  if (status !== 'all') {
    query = query.eq('pool_status', status)
  }

  const { data, error } = await query

  if (error) {
    if (error.message?.includes('recruitment_talent_pool') || error.message?.includes('schema cache')) {
      console.warn('[recruitment-db] Talent pool table missing — run supabase-hr-talent-pool-migration.sql')
      return []
    }
    console.error('Error fetching talent pool:', error)
    return []
  }

  return (data ?? []).map((row) => mapTalentPoolRow(row as Record<string, unknown>))
}

export async function updateTalentPoolEntry(
  entryId: string,
  patch: {
    poolStatus?: TalentPoolStatus
    recruiterNotes?: string
    tags?: string[]
    availabilityNotes?: string
  },
): Promise<boolean> {
  const updatePayload: Record<string, unknown> = {}
  if (patch.poolStatus !== undefined) updatePayload.pool_status = patch.poolStatus
  if (patch.recruiterNotes !== undefined) updatePayload.recruiter_notes = patch.recruiterNotes
  if (patch.tags !== undefined) updatePayload.tags = patch.tags
  if (patch.availabilityNotes !== undefined) updatePayload.availability_notes = patch.availabilityNotes

  if (Object.keys(updatePayload).length === 0) return true

  const { error } = await supabase
    .from('recruitment_talent_pool')
    .update(updatePayload)
    .eq('id', entryId)

  if (error) {
    console.error('Error updating talent pool entry:', error)
    return false
  }

  window.dispatchEvent(new CustomEvent('talentPoolUpdated'))
  return true
}

export async function removeTalentPoolEntry(entryId: string): Promise<boolean> {
  const { error } = await supabase.from('recruitment_talent_pool').delete().eq('id', entryId)

  if (error) {
    console.error('Error removing talent pool entry:', error)
    return false
  }

  window.dispatchEvent(new CustomEvent('talentPoolUpdated'))
  return true
}


