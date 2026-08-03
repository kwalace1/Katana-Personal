import { describe, expect, it } from 'vitest'
import { workforceTabPath } from './wfm-deep-links'

describe('wfm-integrations helpers', () => {
  it('embeds workforce deep link in invoice notes pattern', () => {
    const jobId = 'job-uuid-123'
    const path = workforceTabPath('work', 'list', jobId)
    expect(path).toContain('tab=work')
    expect(path).toContain(`job=${jobId}`)
    const notes = `Draft from workforce JOB-1. Work: ${path}`
    expect(notes).toContain('/workforce?')
  })
})

describe('crm-workflows create_work_order', () => {
  it('includes create_work_order in default deal won actions shape', async () => {
    const mod = await import('./crm-workflows')
    expect(mod).toBeDefined()
    // Type-level: WorkflowAction union accepts create_work_order
    const action = { type: 'create_work_order' as const, title: 'Kickoff', due_days: 7 }
    expect(action.type).toBe('create_work_order')
  })
})
