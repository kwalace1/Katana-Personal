/**
 * Links KYC recommended actions to CS tasks — completed work clears signals and lifts scores.
 */

import type { KycClientSignals } from './kyc-client-scoring'
import type { KycSuggestedAction } from './kyc-client-scoring'

export type KycActionTaskStatus = 'open' | 'completed'

export interface KycActionTaskRef {
  id: string
  status: string
  title?: string | null
  kyc_action_id?: string | null
}

/** Known intelligence actions — labels used for legacy title matching. */
export const KYC_KNOWN_ACTIONS: readonly { id: string; label: string }[] = [
  { id: 'renewal-urgent', label: 'Renewal call' },
  { id: 'renewal-prep', label: 'Prepare QBR' },
  { id: 're-engage', label: 'Re-engage account' },
  { id: 'check-in', label: 'Schedule check-in' },
  { id: 'support-review', label: 'Support escalation review' },
  { id: 'support-followup', label: 'Review open tickets' },
  { id: 'nps-recovery', label: 'NPS recovery' },
  { id: 'find-sponsor', label: 'Identify decision maker' },
  { id: 'add-contact', label: 'Add primary contact' },
  { id: 'invoice-followup', label: 'Invoice follow-up' },
  { id: 'contract-renew', label: 'Contract renewal' },
  { id: 'advance-deal', label: 'Advance open deal' },
  { id: 'adoption-push', label: 'Adoption outreach' },
  { id: 'executive-meeting', label: 'Ask for decision-maker meeting' },
  { id: 'sentiment-recovery', label: 'Escalate to CSM' },
  { id: 'contraction-risk', label: 'Churn prevention call' },
  { id: 'expansion-opportunity', label: 'Expansion conversation' },
  { id: 'leadership-outreach', label: 'New stakeholder outreach' },
] as const

const LABEL_TO_ACTION_ID = new Map(
  KYC_KNOWN_ACTIONS.flatMap((a) => [
    [a.label.toLowerCase(), a.id] as const,
    [a.label.toLowerCase().replace(/-/g, ' '), a.id] as const,
  ]).concat([
    ['send product adoption guide', 'adoption-push'] as const,
    ['add contact details', 'add-contact'] as const,
  ]),
)

/** Signals cleared once the linked action is marked completed. */
const ACTION_CLEARED_SIGNALS: Record<string, (keyof KycClientSignals)[]> = {
  'renewal-urgent': ['renewal_within_30d', 'renewal_within_90d'],
  'renewal-prep': ['renewal_within_90d'],
  'executive-meeting': ['no_executive_touchpoint'],
  're-engage': ['no_contact_60d', 'no_contact_30d'],
  'check-in': ['no_contact_30d'],
  'find-sponsor': ['missing_decision_maker'],
  'support-review': ['support_ticket_spike'],
  'support-followup': ['open_support_tickets'],
  'nps-recovery': ['nps_detractor'],
  'adoption-push': ['low_portal_engagement', 'low_feature_adoption', 'declining_portal_usage'],
  'invoice-followup': ['invoice_overdue'],
  'contract-renew': ['contract_expiring'],
  'sentiment-recovery': ['negative_contact_sentiment', 'blocker_contact_present'],
  'contraction-risk': ['contraction_news'],
  'add-contact': ['missing_primary_contact'],
  'advance-deal': ['open_deal'],
  'expansion-opportunity': ['funding_news', 'expansion_news'],
  'leadership-outreach': ['leadership_news'],
}

/** Actions that count as a customer touchpoint when completed. */
const TOUCHPOINT_ACTION_IDS = new Set([
  'renewal-urgent',
  'renewal-prep',
  're-engage',
  'check-in',
  'executive-meeting',
  'nps-recovery',
  'leadership-outreach',
  'expansion-opportunity',
  'contraction-risk',
])

export function resolveKycActionIdFromTask(task: KycActionTaskRef): string | null {
  const stored = task.kyc_action_id?.trim()
  if (stored) return stored
  const title = (task.title ?? '').trim().toLowerCase()
  if (!title) return null
  return LABEL_TO_ACTION_ID.get(title) ?? null
}

export function partitionKycActionTasks(tasks: KycActionTaskRef[]): {
  completed_kyc_action_ids: string[]
  open_kyc_action_ids: string[]
  kyc_action_task_status: Record<string, KycActionTaskStatus>
} {
  const completed = new Set<string>()
  const open = new Set<string>()
  const statusMap: Record<string, KycActionTaskStatus> = {}

  for (const task of tasks) {
    const actionId = resolveKycActionIdFromTask(task)
    if (!actionId) continue
    const isCompleted = task.status === 'completed'
    if (isCompleted) {
      completed.add(actionId)
      statusMap[actionId] = 'completed'
    } else {
      open.add(actionId)
      if (statusMap[actionId] !== 'completed') {
        statusMap[actionId] = 'open'
      }
    }
  }

  return {
    completed_kyc_action_ids: [...completed],
    open_kyc_action_ids: [...open],
    kyc_action_task_status: statusMap,
  }
}

export function applyKycActionMitigations(
  signals: KycClientSignals,
  completedActionIds: string[] | null | undefined,
): KycClientSignals {
  const ids = completedActionIds ?? []
  if (ids.length === 0) return signals

  const next = { ...signals }
  for (const actionId of ids) {
    for (const key of ACTION_CLEARED_SIGNALS[actionId] ?? []) {
      delete next[key]
    }
  }
  return next
}

export function filterSuggestedActionsForKycTasks(
  actions: KycSuggestedAction[],
  options?: {
    completedActionIds?: string[]
    openActionIds?: string[]
  },
): KycSuggestedAction[] {
  const completed = new Set(options?.completedActionIds ?? [])
  const open = new Set(options?.openActionIds ?? [])
  return actions.filter((a) => !completed.has(a.id) && !open.has(a.id))
}

export function isKycTouchpointAction(actionId: string | null | undefined): boolean {
  return Boolean(actionId && TOUCHPOINT_ACTION_IDS.has(actionId))
}

export function interactionTypeForKycAction(actionId: string): 'meeting' | 'call' | 'email' {
  if (actionId === 'invoice-followup') return 'email'
  if (actionId === 'support-review' || actionId === 'support-followup') return 'call'
  return 'meeting'
}

export function interactionSubjectForAction(action: { id: string; label: string }): string {
  return `Completed: ${action.label}`
}

export function findKnownAction(actionId: string): { id: string; label: string } | undefined {
  return KYC_KNOWN_ACTIONS.find((a) => a.id === actionId)
}
