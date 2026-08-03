import { describe, it, expect } from 'vitest'
import {
  redactPII,
  redactDemographicMarkers,
  redactAgeProxies,
  redactResumeForBlindReview,
  parseCoverLetterProfile,
  mergeResumeProfile,
  applyBlindViewToApplication,
  buildSealedIdentity,
  sealResumeProfileForStorage,
  BLIND_EMAIL,
} from './anonymous-resume-profile'

describe('anonymous-resume-profile', () => {
  it('redacts email and phone from text', () => {
    const out = redactPII('Contact jane@example.com or 555-123-4567')
    expect(out).not.toContain('jane@example.com')
    expect(out).toContain('[EMAIL REDACTED]')
    expect(out).toContain('[PHONE REDACTED]')
  })

  it('parses HR cover letter skill blocks', () => {
    const profile = parseCoverLetterProfile(
      'Skills: react, node\nExperience: 5-10\nEducation: Bachelor\'s Degree',
    )
    expect(profile.skills).toContain('react')
    expect(profile.experience).toBe('5-10')
  })

  it('redacts gender and age markers', () => {
    const out = redactDemographicMarkers('Gender: Female\nAge: 34\nHe/him')
    expect(out).not.toContain('Female')
    expect(out).not.toContain('34')
    expect(out).toContain('[REDACTED]')
  })

  it('full pipeline redacts names when tokens provided', () => {
    const out = redactResumeForBlindReview('Jane Doe built APIs. jane@x.com', {
      piiTokens: ['Jane', 'Doe', 'Jane Doe'],
    })
    expect(out).not.toContain('jane@x.com')
    expect(out).not.toContain('Jane Doe')
  })

  it('redacts resume header contact block like Jenn Bee sample', () => {
    const header =
      'Jenn Bee  Camden, NJ • (555) 123-4567 • jenn.bee.dev@email.com • LinkedIn • GitHub'
    const out = redactResumeForBlindReview(header, {
      piiTokens: ['Jenn', 'Bee', 'Jenn Bee', 'Camden, NJ', 'jenn.bee.dev@email.com'],
    })
    expect(out).not.toContain('Jenn')
    expect(out).not.toContain('jenn.bee')
    expect(out).not.toContain('Camden')
    expect(out).not.toMatch(/\bLinkedIn\b/i)
    expect(out).not.toMatch(/\bGitHub\b/i)
  })

  it('redacts graduation year age proxy but keeps job dates', () => {
    const edu = 'Temple University — Graduated 2021'
    const job = 'June 2023 – Present'
    expect(redactAgeProxies(edu)).not.toContain('2021')
    expect(redactAgeProxies(job)).toContain('2023')
  })

  it('falls back to cover letter when stored profile empty', () => {
    const merged = mergeResumeProfile(null, 'Skills: python\nExperience: 2-5\nEducation: Master\'s Degree')
    expect(merged?.skills).toBe('python')
    expect(merged?.experience).toBe('2-5')
  })

  it('masks application fields before reveal', () => {
    const sealed = buildSealedIdentity({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '555-1234',
      location: 'Boston, MA',
      coverLetter: 'Dear hiring manager, I am Jane Doe.',
      resumeProfile: {
        skills: 'react',
        experience: '5 years',
        education: 'BS',
        piiTokens: ['Jane', 'Doe', 'Jane Doe'],
        redactedFullText: 'Professional summary without names.',
      },
    })
    const profile = sealResumeProfileForStorage(
      {
        skills: 'react',
        experience: '5 years',
        education: 'BS',
        piiTokens: ['Jane', 'Doe'],
        redactedFullText: 'Professional summary without names.',
      },
      sealed,
    )

    const blind = applyBlindViewToApplication({
      isRevealed: false,
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '555-1234',
      location: 'Boston, MA',
      coverLetter: 'Dear hiring manager, I am Jane Doe.',
      resumeProfile: profile,
    })

    expect(blind.firstName).toBe('Anonymous')
    expect(blind.email).toBe(BLIND_EMAIL)
    expect(blind.coverLetter).not.toContain('Jane Doe')
    expect(blind.resumeProfile?.sealedIdentity).toBeUndefined()
    expect(blind.resumeProfile?.piiTokens).toBeUndefined()
  })

  it('restores sealed identity after reveal', () => {
    const sealed = buildSealedIdentity({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '555-1234',
      location: 'Boston, MA',
      coverLetter: 'Original cover letter',
    })
    const profile = sealResumeProfileForStorage(
      { skills: 'a', experience: 'b', education: 'c', piiTokens: ['Jane'] },
      sealed,
    )

    const revealed = applyBlindViewToApplication({
      isRevealed: true,
      firstName: 'Anonymous',
      lastName: 'Candidate',
      email: BLIND_EMAIL,
      phone: '[REDACTED]',
      location: '[REDACTED]',
      coverLetter: 'redacted',
      resumeProfile: profile,
    })

    expect(revealed.firstName).toBe('Jane')
    expect(revealed.lastName).toBe('Doe')
    expect(revealed.email).toBe('jane@example.com')
    expect(revealed.coverLetter).toBe('Original cover letter')
  })
})
