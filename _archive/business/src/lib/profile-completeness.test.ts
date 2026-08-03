import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  computeProfileCompleteness,
  getOnboardingPrompts,
  dismissPrompt,
  getDismissedPrompts,
  getSmartDefault,
  recordSmartDefault,
  getDefaultJobDates,
  getDefaultRenewalDate,
} from './profile-completeness'
import type { UserProfile } from '@/contexts/AuthContext'

const mockProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: '1',
  organization_id: 'org-1',
  email: 'test@example.com',
  full_name: null,
  avatar_url: null,
  role: 'member',
  department: null,
  job_title: null,
  is_active: true,
  last_login_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('computeProfileCompleteness', () => {
  it('returns 0% for null profile', () => {
    const result = computeProfileCompleteness(null)
    expect(result.score).toBe(0)
  })

  it('returns low score for empty profile without org settings', () => {
    const result = computeProfileCompleteness(mockProfile())
    expect(result.score).toBeLessThan(30)
    expect(result.missingFields.length).toBeGreaterThan(3)
  })

  it('returns 100% for fully completed profile', () => {
    const profile = mockProfile({
      full_name: 'John Doe',
      avatar_url: 'https://example.com/photo.jpg',
      department: 'Engineering',
      job_title: 'Developer',
    })
    const orgSettings = { industry: 'Tech', company_size: '11-50' }
    const result = computeProfileCompleteness(profile, orgSettings)
    expect(result.score).toBe(100)
    expect(result.missingFields).toHaveLength(0)
    expect(result.nextAction).toBeNull()
  })

  it('returns partial score for partially filled profile', () => {
    const profile = mockProfile({ full_name: 'Jane', department: 'Sales' })
    const result = computeProfileCompleteness(profile, { industry: 'Retail' })
    expect(result.score).toBeGreaterThan(30)
    expect(result.score).toBeLessThan(100)
  })

  it('provides next action hint from highest-weight missing field', () => {
    const result = computeProfileCompleteness(mockProfile())
    expect(result.nextAction).toBeTruthy()
    expect(result.nextAction!.hint).toBeTruthy()
    expect(result.nextAction!.route).toBeTruthy()
  })
})

describe('getOnboardingPrompts', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns prompts for missing profile fields', () => {
    const prompts = getOnboardingPrompts(mockProfile())
    expect(prompts.length).toBeGreaterThan(0)
    const ids = prompts.map((p) => p.id)
    expect(ids).toContain('profile-name')
  })

  it('returns no profile-name prompt when name is set', () => {
    const prompts = getOnboardingPrompts(mockProfile({ full_name: 'Jane' }))
    const ids = prompts.map((p) => p.id)
    expect(ids).not.toContain('profile-name')
  })

  it('returns org-setup prompt when onboarding not completed', () => {
    const prompts = getOnboardingPrompts(mockProfile(), null)
    const ids = prompts.map((p) => p.id)
    expect(ids).toContain('org-setup')
  })

  it('filters out dismissed prompts', () => {
    dismissPrompt('prompt_profile_name')
    const prompts = getOnboardingPrompts(mockProfile())
    const ids = prompts.map((p) => p.id)
    expect(ids).not.toContain('profile-name')
  })
})

describe('dismissPrompt / getDismissedPrompts', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    expect(getDismissedPrompts().size).toBe(0)
  })

  it('tracks dismissed keys', () => {
    dismissPrompt('key1')
    dismissPrompt('key2')
    const set = getDismissedPrompts()
    expect(set.has('key1')).toBe(true)
    expect(set.has('key2')).toBe(true)
  })
})

describe('smart defaults', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns undefined for unset keys', () => {
    expect(getSmartDefault('lastDepartment')).toBeUndefined()
  })

  it('records and retrieves scalar values', () => {
    recordSmartDefault('lastDepartment', 'Engineering')
    expect(getSmartDefault('lastDepartment')).toBe('Engineering')
  })

  it('records recent list values (capped at 5)', () => {
    for (let i = 0; i < 7; i++) {
      recordSmartDefault('recentLocations', `loc-${i}`)
    }
    const locs = getSmartDefault('recentLocations')
    expect(locs).toHaveLength(5)
    expect(locs![0]).toBe('loc-6')
  })

  it('deduplicates list entries', () => {
    recordSmartDefault('recentTechnicians', 'Alice')
    recordSmartDefault('recentTechnicians', 'Bob')
    recordSmartDefault('recentTechnicians', 'Alice')
    const techs = getSmartDefault('recentTechnicians')
    expect(techs).toHaveLength(2)
    expect(techs![0]).toBe('Alice')
  })
})

describe('getDefaultJobDates', () => {
  it('returns today as start and +7 days as end', () => {
    const { startDate, endDate } = getDefaultJobDates()
    const today = new Date().toISOString().slice(0, 10)
    expect(startDate).toBe(today)
    const end = new Date(endDate)
    const start = new Date(startDate)
    const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000)
    expect(diffDays).toBe(7)
  })
})

describe('getDefaultRenewalDate', () => {
  it('returns date 1 year from now', () => {
    const result = getDefaultRenewalDate()
    const d = new Date(result)
    const now = new Date()
    expect(d.getFullYear()).toBe(now.getFullYear() + 1)
  })
})
