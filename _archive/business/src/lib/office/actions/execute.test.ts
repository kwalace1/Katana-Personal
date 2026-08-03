import { describe, expect, it } from 'vitest'
import { buildRpcParams, isExecutableAction } from './execute'
import type { KatanaActionProposal } from './proposals'

function proposal(overrides: Partial<KatanaActionProposal> = {}): KatanaActionProposal {
  return {
    type: 'katana_action_proposal',
    requestId: 'act_req1',
    action: 'pm.create_task',
    summary: 'Create task',
    args: { projectId: 'p-1', title: 'Ship it', deadline: '2026-07-25', status: 'todo', priority: 'high', assigneeEmployeeId: 'e-9' },
    resolved: {},
    execution: { level: 1, executed: false, rpc: 'ai_act_pm_create_task' },
    approvalId: 'apr_1',
    ...overrides,
  }
}

const CTX = { agentId: 'agent-1', agentName: 'PM', sessionId: 'sess-1' }

describe('buildRpcParams', () => {
  it('maps create_task args + audit context to p_* params', () => {
    const mapped = buildRpcParams(proposal(), CTX)
    expect(mapped).toEqual({
      rpc: 'ai_act_pm_create_task',
      params: {
        p_project_id: 'p-1',
        p_title: 'Ship it',
        p_deadline: '2026-07-25',
        p_description: null,
        p_status: 'todo',
        p_priority: 'high',
        p_assignee_employee_id: 'e-9',
        p_agent_id: 'agent-1',
        p_agent_name: 'PM',
        p_session_id: 'sess-1',
        p_request_id: 'act_req1',
        p_approval_id: 'apr_1',
        p_autonomy_level: 1,
      },
    })
  })

  it('defaults create_task status/priority and null assignee/description', () => {
    const mapped = buildRpcParams(proposal({ args: { projectId: 'p-2', title: 'X', deadline: '2026-08-01' } }), {})
    expect(mapped?.params).toMatchObject({
      p_project_id: 'p-2',
      p_status: 'todo',
      p_priority: 'medium',
      p_description: null,
      p_assignee_employee_id: null,
      p_agent_id: null,
      p_session_id: null,
      p_autonomy_level: 1,
    })
  })

  it('maps set_task_status', () => {
    const mapped = buildRpcParams(proposal({ action: 'pm.set_task_status', execution: { level: 1, executed: false, rpc: 'ai_act_pm_set_task_status' }, args: { taskId: 't-1', status: 'done' } }), CTX)
    expect(mapped?.rpc).toBe('ai_act_pm_set_task_status')
    expect(mapped?.params).toMatchObject({ p_task_id: 't-1', p_status: 'done', p_approval_id: 'apr_1' })
  })

  it('maps assign_task', () => {
    const mapped = buildRpcParams(proposal({ action: 'pm.assign_task', args: { taskId: 't-1', employeeId: 'e-2' } }), CTX)
    expect(mapped?.rpc).toBe('ai_act_pm_assign_task')
    expect(mapped?.params).toMatchObject({ p_task_id: 't-1', p_employee_id: 'e-2' })
  })

  it('maps add_subtask', () => {
    const mapped = buildRpcParams(proposal({ action: 'pm.add_subtask', args: { taskId: 't-1', title: 'Sub' } }), CTX)
    expect(mapped?.rpc).toBe('ai_act_pm_add_subtask')
    expect(mapped?.params).toMatchObject({ p_task_id: 't-1', p_title: 'Sub' })
  })

  it('returns null for an unknown action', () => {
    expect(buildRpcParams(proposal({ action: 'crm.add_note' }), CTX)).toBeNull()
  })
})

describe('isExecutableAction', () => {
  it('is true for a Level-1 known action with an approvalId', () => {
    expect(isExecutableAction(proposal())).toBe(true)
  })

  it('is false at Level 0 (propose-only)', () => {
    expect(isExecutableAction(proposal({ execution: { level: 0, executed: false, rpc: 'ai_act_pm_create_task' } }))).toBe(false)
  })

  it('is false without an approvalId', () => {
    expect(isExecutableAction(proposal({ approvalId: undefined }))).toBe(false)
  })

  it('is false for an action the client will not execute', () => {
    expect(isExecutableAction(proposal({ action: 'crm.add_note' }))).toBe(false)
  })
})
