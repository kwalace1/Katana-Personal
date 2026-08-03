/**
 * Auto-sync client outreach_status from interactions, tasks, and lifecycle events.
 */

import { supabase } from './supabase'
import type { ClientInteraction } from './customer-success-api'
import type { KycOutreachStatus } from './kyc-api'

export function outreachStatusFromInteraction(
  type: ClientInteraction['type'],
): KycOutreachStatus | null {
  if (type === 'meeting' || type === 'call') return 'meeting'
  if (type === 'email') return 'contacted'
  return null
}

export function outreachStatusFromKycActionCompletion(actionId: string): KycOutreachStatus | null {
  if (actionId === 'executive-meeting' || actionId === 'renewal-urgent' || actionId === 'renewal-prep') {
    return 'meeting'
  }
  if (
    actionId === 're-engage' ||
    actionId === 'check-in' ||
    actionId === 'nps-recovery' ||
    actionId === 'leadership-outreach' ||
    actionId === 'expansion-opportunity' ||
    actionId === 'contraction-risk'
  ) {
    return 'contacted'
  }
  if (actionId === 'add-contact' || actionId === 'find-sponsor') {
    return 'planned'
  }
  return null
}

export function outreachStatusFromLifecycle(stage: string | null | undefined): KycOutreachStatus | null {
  if (stage === 'customer') return 'completed'
  if (stage === 'prospect') return 'planned'
  return null
}

/** Advance outreach only forward in the funnel (never downgrade completed → contacted). */
const OUTREACH_RANK: Record<KycOutreachStatus, number> = {
  none: 0,
  planned: 1,
  contacted: 2,
  meeting: 3,
  completed: 4,
  at_risk: 5,
}

export function shouldAdvanceOutreach(
  current: KycOutreachStatus | string | null | undefined,
  next: KycOutreachStatus,
): boolean {
  const cur = (current ?? 'none') as KycOutreachStatus
  if (cur === 'at_risk') return next === 'at_risk' || next === 'completed'
  return OUTREACH_RANK[next] > OUTREACH_RANK[cur]
}

export async function syncClientOutreachStatus(
  clientId: string,
  next: KycOutreachStatus,
  options?: { forceAtRisk?: boolean },
): Promise<void> {
  if (options?.forceAtRisk) {
    await supabase
      .from('cs_clients')
      .update({ outreach_status: 'at_risk', updated_at: new Date().toISOString() })
      .eq('id', clientId)
    return
  }

  const { data } = await supabase
    .from('cs_clients')
    .select('outreach_status, status')
    .eq('id', clientId)
    .maybeSingle()

  const current = (data?.outreach_status as KycOutreachStatus | null) ?? 'none'

  if (data?.status === 'at-risk' && next !== 'completed') {
    if (current !== 'at_risk') {
      await supabase
        .from('cs_clients')
        .update({ outreach_status: 'at_risk', updated_at: new Date().toISOString() })
        .eq('id', clientId)
    }
    return
  }

  if (!shouldAdvanceOutreach(current, next)) return

  const { error } = await supabase
    .from('cs_clients')
    .update({ outreach_status: next, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  if (error && error.code !== '42703') {
    console.error('syncClientOutreachStatus:', error)
  }
}
