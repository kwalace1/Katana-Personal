import { describe, it, expect } from 'vitest'
import { buildAnonymousProfileFromParsed } from './anonymous-resume-profile'
import { scoreApplication, deriveMatchCriteriaFromJob } from './recruitment-matching'
import type { Job, JobApplication } from './recruitment-db'

const baseJob: Job = {
  id: 'job-1',
  title: 'Senior Developer',
  department: 'Engineering',
  location: 'Remote',
  type: 'full-time',
  level: 'senior',
  salary: '$120k',
  postedDate: '2026-01-01',
  description: '',
  responsibilities: [],
  qualifications: ['javascript', 'react', 'typescript', 'node'],
  benefits: [],
}

describe('recruitment-matching', () => {
  it('scores higher when required skills align', () => {
    const app: JobApplication = {
      jobId: 'job-1',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      phone: '',
      location: '',
      coverLetter: '',
      resumeProfile: buildAnonymousProfileFromParsed({
        rawText: 'Experienced developer',
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        location: null,
        linkedin: null,
        skills: ['javascript', 'react', 'typescript', 'node', 'aws'],
        experience: '5-10',
        education: "Bachelor's Degree",
      }),
    }

    const job = { ...baseJob, matchCriteria: deriveMatchCriteriaFromJob(baseJob) }
    const score = scoreApplication(app, job)
    expect(score).not.toBeNull()
    expect(score!).toBeGreaterThan(50)
  })

  it('returns null when no profile data', () => {
    const app: JobApplication = {
      jobId: 'job-1',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      phone: '',
      location: '',
      coverLetter: 'Hello only',
    }
    expect(scoreApplication(app, baseJob)).toBeNull()
  })
})
