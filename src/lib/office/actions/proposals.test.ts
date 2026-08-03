import { describe, expect, it } from 'vitest'
import { actionLabel, extractActionProposals, proposalFields, type KatanaActionProposal } from './proposals'

function proposalOutput(overrides: Partial<KatanaActionProposal> = {}): string {
  return JSON.stringify({
    type: 'katana_action_proposal',
    requestId: 'act_abc123',
    action: 'pm.create_task',
    summary: 'Create task "Ship it" in project "Q3 Launch" — todo, medium priority, due 2026-07-25',
    args: { projectId: 'p-1', title: 'Ship it', deadline: '2026-07-25', status: 'todo', priority: 'medium', description: null },
    resolved: { project: { id: 'p-1', name: 'Q3 Launch', status: 'active' } },
    execution: { level: 0, executed: false, rpc: 'ai_act_pm_create_task' },
    note: 'PROPOSE-ONLY MODE',
    ...overrides,
  })
}

describe('extractActionProposals', () => {
  it('lifts a proposal out of a tool event output', () => {
    const proposals = extractActionProposals([
      { name: 'execute_sql', output: '[{"count": 3}]' },
      { name: 'pm_create_task', output: proposalOutput() },
    ])
    expect(proposals).toHaveLength(1)
    expect(proposals[0].action).toBe('pm.create_task')
    expect(proposals[0].requestId).toBe('act_abc123')
  })

  it('dedups by requestId (streaming + persisted duplicates)', () => {
    const proposals = extractActionProposals([
      { name: 'pm_create_task', output: proposalOutput() },
      { name: 'pm_create_task', output: proposalOutput() },
    ])
    expect(proposals).toHaveLength(1)
  })

  it('ignores action errors, non-JSON, and unrelated outputs', () => {
    const proposals = extractActionProposals([
      { name: 'pm_create_task', output: JSON.stringify({ type: 'katana_action_error', action: 'pm.create_task', error: 'project_not_found' }) },
      { name: 'pm_create_task', output: 'katana_action_proposal but not json {' },
      { name: 'web_search', output: 'plain text' },
      { name: 'no_output' },
    ])
    expect(proposals).toHaveLength(0)
  })

  it('handles empty and missing inputs', () => {
    expect(extractActionProposals([])).toHaveLength(0)
    expect(extractActionProposals(null)).toHaveLength(0)
    expect(extractActionProposals(undefined)).toHaveLength(0)
  })
})

describe('proposalFields', () => {
  it('builds create-task rows from args + resolved data', () => {
    const [p] = extractActionProposals([{ name: 'pm_create_task', output: proposalOutput() }])
    const fields = proposalFields(p)
    expect(fields).toEqual([
      { label: 'Project', value: 'Q3 Launch' },
      { label: 'Title', value: 'Ship it' },
      { label: 'Due', value: '2026-07-25' },
      { label: 'Status', value: 'todo' },
      { label: 'Priority', value: 'medium' },
    ])
  })

  it('shows a status change as before → after', () => {
    const [p] = extractActionProposals([{
      name: 'pm_set_task_status',
      output: proposalOutput({
        action: 'pm.set_task_status',
        args: { taskId: 't-1', status: 'done' },
        resolved: { task: { id: 't-1', title: 'Ship it', status: 'in-progress', project_name: 'Q3 Launch' } },
      }),
    }])
    expect(proposalFields(p)).toEqual([
      { label: 'Task', value: 'Ship it' },
      { label: 'Project', value: 'Q3 Launch' },
      { label: 'Change', value: 'in-progress → done' },
    ])
  })

  it('falls back to raw args for unknown actions', () => {
    const [p] = extractActionProposals([{
      name: 'future_tool',
      output: proposalOutput({ action: 'crm.add_note', args: { clientId: 'c-1', note: 'hello' }, resolved: {} }),
    }])
    expect(proposalFields(p)).toEqual([
      { label: 'clientId', value: 'c-1' },
      { label: 'note', value: 'hello' },
    ])
  })
})

describe('actionLabel', () => {
  it('maps known actions and passes through unknown ones', () => {
    expect(actionLabel('pm.create_task')).toBe('Create task')
    expect(actionLabel('pm.assign_task')).toBe('Assign task')
    expect(actionLabel('crm.add_note')).toBe('crm.add_note')
  })
})
