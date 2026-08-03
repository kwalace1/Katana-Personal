import { describe, it, expect } from 'vitest'
import {
  applyKycActionMitigations,
  filterSuggestedActionsForKycTasks,
  partitionKycActionTasks,
  resolveKycActionIdFromTask,
} from './kyc-action-resolution'
import { buildSuggestedActions, buildClientIntelligence } from './kyc-client-scoring'

describe('kyc-action-resolution', () => {
  it('resolves action id from stored kyc_action_id or task title', () => {
    expect(
      resolveKycActionIdFromTask({
        id: '1',
        status: 'active',
        kyc_action_id: 'renewal-urgent',
      }),
    ).toBe('renewal-urgent')

    expect(
      resolveKycActionIdFromTask({
        id: '2',
        status: 'active',
        title: 'Renewal call',
      }),
    ).toBe('renewal-urgent')
  })

  it('partitions open and completed action tasks', () => {
    const result = partitionKycActionTasks([
      { id: '1', status: 'active', kyc_action_id: 'executive-meeting' },
      { id: '2', status: 'completed', title: 'Renewal call' },
    ])

    expect(result.open_kyc_action_ids).toEqual(['executive-meeting'])
    expect(result.completed_kyc_action_ids).toEqual(['renewal-urgent'])
    expect(result.kyc_action_task_status).toEqual({
      'executive-meeting': 'open',
      'renewal-urgent': 'completed',
    })
  })

  it('clears mitigated signals after completion', () => {
    const mitigated = applyKycActionMitigations(
      {
        renewal_within_30d: true,
        no_executive_touchpoint: true,
        no_contact_30d: true,
      },
      ['renewal-urgent', 'executive-meeting'],
    )

    expect(mitigated.renewal_within_30d).toBeUndefined()
    expect(mitigated.no_executive_touchpoint).toBeUndefined()
    expect(mitigated.no_contact_30d).toBe(true)
  })

  it('hides completed but keeps in-progress actions in recommendations', () => {
    const actions = buildSuggestedActions({
      renewal_within_30d: true,
      no_executive_touchpoint: true,
    })

    const completedOnly = filterSuggestedActionsForKycTasks(actions, {
      completedActionIds: ['renewal-urgent'],
    })
    expect(completedOnly.map((a) => a.id)).toEqual(['executive-meeting'])

    const withOpenHidden = filterSuggestedActionsForKycTasks(actions, {
      completedActionIds: [],
      openActionIds: ['executive-meeting'],
    })
    expect(withOpenHidden.map((a) => a.id)).toEqual(['renewal-urgent'])
  })
})

describe('buildClientIntelligence with KYC task completion', () => {
  it('drops completed renewal action and improves attention score', () => {
    const withoutCompletion = buildClientIntelligence({
      nps_score: 8,
      engagement_score: 70,
      support_tickets: 0,
      last_contact_date: '2025-12-01',
      renewal_date: '2026-06-20',
      feature_usage: 'medium',
      portal_logins: 5,
      account_type: 'business',
      no_executive_touchpoint: true,
    })

    const withCompletion = buildClientIntelligence({
      nps_score: 8,
      engagement_score: 70,
      support_tickets: 0,
      last_contact_date: '2025-12-01',
      renewal_date: '2026-06-20',
      feature_usage: 'medium',
      portal_logins: 5,
      account_type: 'business',
      no_executive_touchpoint: true,
      completed_kyc_action_ids: ['renewal-urgent', 'executive-meeting'],
    })

    expect(withoutCompletion.primary_action?.id).toBe('renewal-urgent')
    expect(withCompletion.primary_action).toBeNull()
    expect(withCompletion.attention_score).toBeLessThan(withoutCompletion.attention_score)
    expect(withCompletion.health_score).toBeGreaterThanOrEqual(withoutCompletion.health_score)
  })
})
