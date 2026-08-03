import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockFrom = vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({ single: mockSingle })),
    })),
  }))
  return { mockSingle, mockFrom }
})

vi.mock('./supabase', () => ({
  supabase: {
    from: mocks.mockFrom,
    auth: { getSession: vi.fn() },
  },
}))

vi.mock('./auth-helpers', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('user-uuid'),
  getOrganizationId: vi.fn().mockResolvedValue('org-uuid'),
}))

const validJobPayload = {
  title: 'Software Engineer',
  department: 'Engineering',
  location: 'Remote',
  type: 'full-time' as const,
  level: 'mid' as const,
  salary: '$100k',
  postedDate: '2026-05-12',
  description: '',
  responsibilities: [] as string[],
  qualifications: [] as string[],
  benefits: [] as string[],
}

import {
  ANONYMIZED_RESUME_LABEL,
  createJob,
  getResumeDisplayName,
  hasResumeAttachment,
} from './recruitment-db'

describe('createJob', () => {
  beforeEach(() => {
    mocks.mockSingle.mockReset()
    mocks.mockFrom.mockClear()
    mocks.mockSingle.mockResolvedValue({ data: { id: 'some-uuid' }, error: null })
  })

  it('returns id when Supabase insert succeeds with required fields', async () => {
    const result = await createJob(validJobPayload)

    expect(result).toEqual({ id: 'some-uuid' })
    expect(mocks.mockFrom).toHaveBeenCalledWith('job_postings')
  })

  it('returns validation error when title is empty', async () => {
    const result = await createJob({
      ...validJobPayload,
      title: '',
    })

    expect(result).toMatchObject({
      error: expect.stringMatching(/required/i),
    })
    expect(mocks.mockFrom).not.toHaveBeenCalled()
  })

  it('returns Supabase error message when insert fails', async () => {
    mocks.mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied for table job_postings' },
    })

    const result = await createJob(validJobPayload)

    expect(result).toEqual({
      error: 'permission denied for table job_postings',
    })
  })
})

describe('getResumeDisplayName', () => {
  it('returns generic label when identity is hidden', () => {
    expect(getResumeDisplayName('resume_connor_james.pdf', false)).toBe(ANONYMIZED_RESUME_LABEL)
  })

  it('returns original filename when identity is revealed', () => {
    expect(getResumeDisplayName('resume_connor_james.pdf', true)).toBe('resume_connor_james.pdf')
  })

  it('returns null when no resume filename', () => {
    expect(getResumeDisplayName(null, false)).toBeNull()
  })
})

describe('hasResumeAttachment', () => {
  it('is true when resume URL exists without filename', () => {
    expect(hasResumeAttachment({ resumeUrl: 'https://example.com/file.pdf' })).toBe(true)
  })
})
