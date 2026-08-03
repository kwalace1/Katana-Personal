import { describe, expect, it } from 'vitest'
import { parseWorkforceSearchParams, workforceTabPath } from './wfm-deep-links'
import { kanbanColumnForJob, statusToApi } from './wfm-job-utils'

describe('wfm-deep-links', () => {
  it('builds tab paths', () => {
    expect(workforceTabPath('today')).toBe('/workforce?tab=today')
    expect(workforceTabPath('work', 'board')).toBe('/workforce?tab=work&work=board')
  })

  it('parses search params', () => {
    expect(parseWorkforceSearchParams('?tab=work&work=schedule&job=abc')).toEqual({
      tab: 'work',
      workSubTab: 'schedule',
      jobId: 'abc',
    })
  })
})

describe('wfm-job-utils kanban', () => {
  it('maps display status to api status', () => {
    expect(statusToApi('In Progress')).toBe('in-progress')
    expect(statusToApi('Unassigned')).toBe('assigned')
  })

  it('places overdue jobs in assigned column', () => {
    expect(
      kanbanColumnForJob({
        id: '1',
        title: 'T',
        technician: 'Sam',
        startDate: '',
        endDate: '',
        status: 'Overdue',
      }),
    ).toBe('Assigned')
  })
})
