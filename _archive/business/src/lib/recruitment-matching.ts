/**
 * Blind recruitment matching — score candidates from anonymous resume profiles
 * against per-job criteria without exposing PII.
 */

import {
  calculateKatanaMatchScore,
  defaultJobRequirements,
  getKatanaScoreBreakdown,
  type Candidate,
  type JobRequirements,
} from './katana-matching'
import {
  mergeResumeProfile,
  type AnonymousResumeProfile,
} from './anonymous-resume-profile'
import type { Job, JobApplication, JobMatchCriteria, TalentPoolEntry } from './recruitment-db'

export type { JobRequirements, Candidate }
export { getKatanaScoreBreakdown }

export function jobLevelToMinExperience(level: Job['level']): JobRequirements['minExperience'] {
  switch (level) {
    case 'entry':
      return '0-2'
    case 'mid':
      return '2-5'
    case 'senior':
      return '5-10'
    case 'lead':
      return '10+'
    default:
      return '2-5'
  }
}

/** Derive default criteria from posting title, level, and qualifications. */
export function deriveMatchCriteriaFromJob(job: Job): JobMatchCriteria {
  const title = job.title?.trim() ?? ''
  const preset = Object.entries(defaultJobRequirements).find(([key]) =>
    title.toLowerCase().includes(key.toLowerCase().split(' ')[0] ?? ''),
  )
  const base = preset?.[1]

  const qualTokens = (job.qualifications ?? [])
    .flatMap((q) => q.split(/[,;|·•]+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 50)
    .slice(0, 8)

  const requiredSkills = base?.requiredSkills?.length
    ? base.requiredSkills
    : qualTokens.slice(0, 4)
  const preferredSkills = base?.preferredSkills?.length
    ? base.preferredSkills
    : qualTokens.slice(4, 8)

  return {
    position: title,
    requiredSkills,
    preferredSkills,
    minExperience: jobLevelToMinExperience(job.level) as JobMatchCriteria['minExperience'],
    preferredEducation: base?.preferredEducation ?? ["Bachelor's Degree", 'Associate Degree', 'Coding Bootcamp'],
    certifications: base?.certifications,
  }
}

export function resolveJobRequirements(job: Job | null | undefined): JobRequirements | null {
  if (!job) return null
  const criteria = job.matchCriteria ?? deriveMatchCriteriaFromJob(job)
  return {
    position: criteria.position || job.title,
    requiredSkills: criteria.requiredSkills ?? [],
    preferredSkills: criteria.preferredSkills ?? [],
    minExperience: (criteria.minExperience ??
      jobLevelToMinExperience(job.level)) as JobRequirements['minExperience'],
    preferredEducation: criteria.preferredEducation ?? ["Bachelor's Degree"],
    certifications: criteria.certifications,
  }
}

export function talentPoolEntryToCandidate(entry: TalentPoolEntry): Candidate | null {
  const profile = entry.resumeProfile
  if (!profile?.skills && !profile?.experience && !profile?.education) return null

  return {
    candidateId: entry.anonymousId ?? entry.id,
    position: profile.position ?? entry.sourceJobTitle ?? '',
    skills: profile.skills ?? '',
    experience: profile.experience ?? '',
    education: profile.education ?? '',
    certifications: profile.certifications,
  }
}

export function scoreTalentPoolEntry(entry: TalentPoolEntry, job: Job | null | undefined): number | null {
  const requirements = resolveJobRequirements(job)
  const candidate = talentPoolEntryToCandidate(entry)
  if (!requirements || !candidate) return null
  if (!candidate.skills && !candidate.experience && !candidate.education) return null
  return calculateKatanaMatchScore(candidate, requirements)
}

export function applicationToCandidate(
  app: JobApplication,
  job: Job | null | undefined,
): Candidate | null {
  const profile = mergeResumeProfile(app.resumeProfile, app.coverLetter)
  if (!profile) return null

  return {
    candidateId: app.anonymousId ?? app.id ?? '',
    position: profile.position ?? job?.title ?? '',
    skills: profile.skills ?? '',
    experience: profile.experience ?? '',
    education: profile.education ?? '',
    certifications: profile.certifications,
  }
}

export function scoreApplication(
  app: JobApplication,
  job: Job | null | undefined,
): number | null {
  const requirements = resolveJobRequirements(job)
  const candidate = applicationToCandidate(app, job)
  if (!requirements || !candidate) return null
  if (!candidate.skills && !candidate.experience && !candidate.education) return null
  return calculateKatanaMatchScore(candidate, requirements)
}

export function sortApplicationsByMatch(
  apps: JobApplication[],
  jobsById: Map<string, Job>,
): JobApplication[] {
  return [...apps].sort((a, b) => {
    const jobA = jobsById.get(a.jobId)
    const jobB = jobsById.get(b.jobId)
    const scoreA = scoreApplication(a, jobA) ?? -1
    const scoreB = scoreApplication(b, jobB) ?? -1
    return scoreB - scoreA
  })
}

export function getMatchedSkillsPreview(
  app: JobApplication,
  job: Job | null | undefined,
  limit = 5,
): string[] {
  const requirements = resolveJobRequirements(job)
  const profile = mergeResumeProfile(app.resumeProfile, app.coverLetter)
  if (!requirements || !profile?.skills) return []

  const candidateSkills = profile.skills
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const wanted = [
    ...requirements.requiredSkills,
    ...requirements.preferredSkills,
  ].map((s) => s.toLowerCase())

  const matched: string[] = []
  for (const req of wanted) {
    if (
      candidateSkills.some(
        (c) => c.includes(req) || req.includes(c) || c.split(/\s+/).some((w) => req.includes(w)),
      )
    ) {
      matched.push(req)
      if (matched.length >= limit) break
    }
  }
  return matched
}

export function criteriaFromRequirements(req: JobRequirements): JobMatchCriteria {
  return {
    position: req.position,
    requiredSkills: req.requiredSkills,
    preferredSkills: req.preferredSkills,
    minExperience: req.minExperience as JobMatchCriteria['minExperience'],
    preferredEducation: req.preferredEducation,
    certifications: req.certifications,
  }
}

export function emptyMatchCriteria(job?: Job): JobMatchCriteria {
  if (job) return deriveMatchCriteriaFromJob(job)
  return {
    position: '',
    requiredSkills: [],
    preferredSkills: [],
    minExperience: '2-5' as JobMatchCriteria['minExperience'],
    preferredEducation: ["Bachelor's Degree"],
  }
}

export type { AnonymousResumeProfile }
