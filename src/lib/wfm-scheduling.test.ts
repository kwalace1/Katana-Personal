import { describe, it, expect } from 'vitest'
import {
  calculateDurationHours,
  formatDuration,
  detectTimeConflicts,
  type Job,
} from './wfm-api'

describe('calculateDurationHours', () => {
  it('returns correct duration for a normal range', () => {
    expect(calculateDurationHours('08:00', '17:00')).toBe(9)
  })

  it('returns fractional hours', () => {
    expect(calculateDurationHours('09:00', '10:30')).toBe(1.5)
  })

  it('returns correct duration for 15-minute interval', () => {
    expect(calculateDurationHours('14:00', '14:15')).toBe(0.25)
  })

  it('returns null when start equals end', () => {
    expect(calculateDurationHours('09:00', '09:00')).toBeNull()
  })

  it('returns null when end is before start', () => {
    expect(calculateDurationHours('17:00', '08:00')).toBeNull()
  })

  it('returns null for null start', () => {
    expect(calculateDurationHours(null, '17:00')).toBeNull()
  })

  it('returns null for null end', () => {
    expect(calculateDurationHours('08:00', null)).toBeNull()
  })

  it('returns null for both null', () => {
    expect(calculateDurationHours(null, null)).toBeNull()
  })

  it('returns null for invalid time strings', () => {
    expect(calculateDurationHours('abc', '17:00')).toBeNull()
    expect(calculateDurationHours('08:00', 'xyz')).toBeNull()
  })

  it('handles midnight-adjacent times', () => {
    expect(calculateDurationHours('00:00', '01:00')).toBe(1)
  })

  it('handles full day range', () => {
    expect(calculateDurationHours('00:00', '23:59')).toBeCloseTo(23.98, 1)
  })
})

describe('formatDuration', () => {
  it('formats whole hours', () => {
    expect(formatDuration(2)).toBe('2h')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(1.5)).toBe('1h 30m')
  })

  it('formats sub-hour durations', () => {
    expect(formatDuration(0.25)).toBe('15m')
  })

  it('returns dash for null', () => {
    expect(formatDuration(null)).toBe('—')
  })

  it('returns dash for zero', () => {
    expect(formatDuration(0)).toBe('—')
  })

  it('returns dash for negative', () => {
    expect(formatDuration(-1)).toBe('—')
  })

  it('formats 8-hour workday', () => {
    expect(formatDuration(8)).toBe('8h')
  })

  it('formats 2h 15m', () => {
    expect(formatDuration(2.25)).toBe('2h 15m')
  })
})

describe('detectTimeConflicts', () => {
  const makeJob = (overrides: Partial<Job>): Job => ({
    id: 'job-1',
    job_number: 'JOB-001',
    title: 'Existing Job',
    description: null,
    customer_name: null,
    customer_phone: null,
    customer_email: null,
    location: null,
    location_address: null,
    status: 'assigned',
    priority: 'medium',
    technician_id: 'tech-1',
    start_date: '2025-06-15',
    end_date: '2025-06-15',
    start_time: '09:00',
    end_time: '12:00',
    estimated_hours: 3,
    actual_hours: null,
    notes: null,
    completion_notes: null,
    is_active: true,
    created_at: '',
    updated_at: '',
    technician: { id: 'tech-1', name: 'Alice', email: null, phone: null, role: 'technician', status: 'active', skills: null, hourly_rate: null, avatar_url: null, notes: null, is_active: true, created_at: '', updated_at: '' },
    ...overrides,
  })

  it('detects overlap with existing job for same technician', () => {
    const jobs = [makeJob({})]
    const assignments: Record<string, string[]> = {}
    const conflicts = detectTimeConflicts(
      ['tech-1'], '2025-06-15', '10:00', '14:00',
      jobs, assignments,
    )
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].jobTitle).toBe('Existing Job')
    expect(conflicts[0].technicianId).toBe('tech-1')
  })

  it('no conflict when times do not overlap', () => {
    const jobs = [makeJob({})]
    const assignments: Record<string, string[]> = {}
    const conflicts = detectTimeConflicts(
      ['tech-1'], '2025-06-15', '13:00', '15:00',
      jobs, assignments,
    )
    expect(conflicts).toHaveLength(0)
  })

  it('no conflict on a different date', () => {
    const jobs = [makeJob({})]
    const assignments: Record<string, string[]> = {}
    const conflicts = detectTimeConflicts(
      ['tech-1'], '2025-06-16', '09:00', '12:00',
      jobs, assignments,
    )
    expect(conflicts).toHaveLength(0)
  })

  it('no conflict for a different technician', () => {
    const jobs = [makeJob({})]
    const assignments: Record<string, string[]> = {}
    const conflicts = detectTimeConflicts(
      ['tech-2'], '2025-06-15', '09:00', '12:00',
      jobs, assignments,
    )
    expect(conflicts).toHaveLength(0)
  })

  it('detects conflict via junction table assignments', () => {
    const jobs = [makeJob({ technician_id: null })]
    const assignments: Record<string, string[]> = { 'job-1': ['tech-3'] }
    const conflicts = detectTimeConflicts(
      ['tech-3'], '2025-06-15', '10:00', '11:00',
      jobs, assignments,
    )
    expect(conflicts).toHaveLength(1)
  })

  it('excludes the specified job id', () => {
    const jobs = [makeJob({})]
    const assignments: Record<string, string[]> = {}
    const conflicts = detectTimeConflicts(
      ['tech-1'], '2025-06-15', '09:00', '12:00',
      jobs, assignments, 'job-1',
    )
    expect(conflicts).toHaveLength(0)
  })

  it('ignores inactive jobs', () => {
    const jobs = [makeJob({ is_active: false })]
    const assignments: Record<string, string[]> = {}
    const conflicts = detectTimeConflicts(
      ['tech-1'], '2025-06-15', '09:00', '12:00',
      jobs, assignments,
    )
    expect(conflicts).toHaveLength(0)
  })

  it('ignores jobs without time fields', () => {
    const jobs = [makeJob({ start_time: null, end_time: null })]
    const assignments: Record<string, string[]> = {}
    const conflicts = detectTimeConflicts(
      ['tech-1'], '2025-06-15', '09:00', '12:00',
      jobs, assignments,
    )
    expect(conflicts).toHaveLength(0)
  })

  it('returns empty for empty technician list', () => {
    const jobs = [makeJob({})]
    const conflicts = detectTimeConflicts([], '2025-06-15', '09:00', '12:00', jobs, {})
    expect(conflicts).toHaveLength(0)
  })

  it('returns empty for missing times in new job', () => {
    const jobs = [makeJob({})]
    expect(detectTimeConflicts(['tech-1'], '2025-06-15', '', '12:00', jobs, {})).toHaveLength(0)
    expect(detectTimeConflicts(['tech-1'], '2025-06-15', '09:00', '', jobs, {})).toHaveLength(0)
    expect(detectTimeConflicts(['tech-1'], '', '09:00', '12:00', jobs, {})).toHaveLength(0)
  })

  it('detects adjacent but non-overlapping times as no conflict', () => {
    const jobs = [makeJob({ start_time: '09:00', end_time: '12:00' })]
    const conflicts = detectTimeConflicts(
      ['tech-1'], '2025-06-15', '12:00', '15:00',
      jobs, {},
    )
    expect(conflicts).toHaveLength(0)
  })

  it('detects conflict for multi-day job when checking within date range', () => {
    const jobs = [makeJob({ start_date: '2025-06-14', end_date: '2025-06-16', start_time: '08:00', end_time: '17:00' })]
    const conflicts = detectTimeConflicts(
      ['tech-1'], '2025-06-15', '10:00', '14:00',
      jobs, {},
    )
    expect(conflicts).toHaveLength(1)
  })

  it('detects conflicts for multiple technicians', () => {
    const jobs = [
      makeJob({ id: 'job-1', technician_id: 'tech-1' }),
      makeJob({ id: 'job-2', technician_id: 'tech-2', title: 'Job 2' }),
    ]
    const conflicts = detectTimeConflicts(
      ['tech-1', 'tech-2'], '2025-06-15', '10:00', '11:00',
      jobs, {},
    )
    expect(conflicts).toHaveLength(2)
  })
})
