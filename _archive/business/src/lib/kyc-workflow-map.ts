/**
 * Map CRM workflow task titles to KYC action ids for intelligence deduplication.
 */

import { KYC_KNOWN_ACTIONS } from './kyc-action-resolution'

const WORKFLOW_TITLE_TO_ACTION: Record<string, string> = {
  'send welcome / kickoff email': 'check-in',
  'schedule onboarding call': 'check-in',
  'onboarding complete': 'renewal-prep',
  'schedule onboarding call (auto)': 'check-in',
}

export function resolveKycActionIdFromWorkflowTitle(title: string): string | null {
  const normalized = title.trim().toLowerCase()
  if (WORKFLOW_TITLE_TO_ACTION[normalized]) {
    return WORKFLOW_TITLE_TO_ACTION[normalized]
  }
  const known = KYC_KNOWN_ACTIONS.find((a) => a.label.toLowerCase() === normalized)
  return known?.id ?? null
}
