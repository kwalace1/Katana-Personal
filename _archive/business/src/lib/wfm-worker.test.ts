import { describe, expect, it } from 'vitest'
import {
  isWorkItemDueToday,
  isWorkItemOverdue,
  myWorkDeepLink,
  mapJobToMyWorkItem,
} from './wfm-worker'
import type { Job } from './wfm-api'

const baseJob = {
  id: 'job-1',
  job_number: 'JOB-100',
  title: 'Install HVAC',
  description: null,
  client_id: null,
  customer_name: 'Acme',
  customer_phone: null,
  customer_email: null,
  location: null,
  location_address: '123 Main',
  status: 'assigned' as const,
  priority: 'medium' as const,
  technician_id: 'tech-1',
  start_date: '2026-06-22',
  end_date: '2026-06-25',
  start_time: null,
  end_time: null,
  estimated_hours: null,
  actual_hours: null,
  notes: null,
  completion_notes: null,
  is_active: true,
  project_id: null,
  task_id: null,
  invoice_id: null,
  created_at: '',
  updated_at: '',
}

describe('wfm-worker', () => {
  it('builds employee my work deep links', () => {
    expect(myWorkDeepLink()).toBe('/employee/work')
    expect(myWorkDeepLink('abc')).toBe('/employee/work?job=abc')
  })

  it('maps jobs to my work items', () => {
    const item = mapJobToMyWorkItem(baseJob as Job)
    expect(item.jobNumber).toBe('JOB-100')
    expect(item.customerName).toBe('Acme')
  })

  it('detects overdue and due today', () => {
    const item = mapJobToMyWorkItem(baseJob as Job)
    expect(isWorkItemDueToday(item, '2026-06-22')).toBe(true)
    expect(isWorkItemOverdue(item, '2026-06-26')).toBe(true)
    expect(isWorkItemOverdue({ ...item, status: 'completed' }, '2026-06-26')).toBe(false)
  })
})
