/**
 * CSM call briefing — synthesizes account intel into pre-touchpoint guidance.
 * Grounded in system data only; designed to drive renewals, adoption, and qualified expansion.
 */

import type { CrmContact } from './customer-crm-api'
import { contactDisplayName } from './customer-crm-api'
import type { ClientIntelligenceResult } from './kyc-client-scoring'
import type { KycSignalPlay } from './kyc-signal-plays'

export interface KycCsmBriefing {
  headline: string
  who_to_engage: string[]
  talking_points: string[]
  risks_to_address: string[]
  expansion_angle: string | null
  do_not_do: string[]
}

function contactBriefLine(contact: CrmContact): string {
  const role =
    contact.contact_role && contact.contact_role !== 'contact'
      ? contact.contact_role.replace('_', ' ')
      : contact.is_decision_maker
        ? 'decision maker'
        : contact.is_primary
          ? 'primary contact'
          : 'contact'
  const sentiment = contact.sentiment ?? 'neutral'
  return `${contactDisplayName(contact)} — ${contact.job_title || role} (${sentiment})`
}

export function buildCsmBriefing(
  clientName: string,
  intel: ClientIntelligenceResult,
  contacts: CrmContact[],
  signalPlays: KycSignalPlay[],
): KycCsmBriefing {
  const talking_points: string[] = []
  const risks_to_address: string[] = [...intel.renewal_risk_reasons]
  const do_not_do: string[] = []

  if (intel.primary_action) {
    talking_points.push(`${intel.primary_action.label}: ${intel.primary_action.reason}`)
  }

  const negativePlays = signalPlays.filter((p) => p.sentiment === 'negative').slice(0, 2)
  for (const play of negativePlays) {
    talking_points.push(play.recommended_play)
  }

  const positivePlays = signalPlays.filter((p) => p.sentiment === 'positive').slice(0, 1)
  for (const play of positivePlays) {
    talking_points.push(play.recommended_play)
  }

  if (intel.expansion_likelihood === 'low') {
    do_not_do.push('Do not push an upsell — adoption and relationship signals do not support expansion yet.')
  }
  if (intel.renewal_risk === 'high') {
    do_not_do.push('Do not defer outreach — renewal protection is the priority this week.')
  }
  if (intel.signals.nps_detractor) {
    do_not_do.push('Do not open with expansion — address satisfaction and support issues first.')
  }

  const champions = contacts.filter(
    (c) => c.contact_role === 'champion' || (c.sentiment === 'positive' && c.is_primary),
  )
  const decisionMakers = contacts.filter(
    (c) => c.contact_role === 'decision_maker' || c.is_decision_maker,
  )
  const who_to_engage: string[] = []

  if (decisionMakers.length > 0) {
    who_to_engage.push(...decisionMakers.slice(0, 2).map(contactBriefLine))
  }
  if (champions.length > 0) {
    who_to_engage.push(...champions.slice(0, 2).map(contactBriefLine))
  }
  if (who_to_engage.length === 0 && contacts.length > 0) {
    who_to_engage.push(contactBriefLine(contacts[0]!))
  }
  if (who_to_engage.length === 0) {
    who_to_engage.push('No contacts mapped — add a primary contact and decision maker before your next call.')
  }

  let expansion_angle: string | null = null
  if (intel.expansion_likelihood === 'high') {
    expansion_angle =
      intel.expansion_reasons.find((r) => !/must improve|before upsell/i.test(r)) ??
      'Strong fit and adoption — explore adjacent modules that extend current workflows.'
  } else if (intel.expansion_likelihood === 'medium') {
    expansion_angle = 'Monitor adoption milestones first, then test interest in one additional capability.'
  }

  const headline =
    intel.renewal_risk === 'high'
      ? `${clientName} needs urgent CSM attention — renewal risk is high.`
      : intel.status === 'at-risk'
        ? `${clientName} is at-risk — focus the next touchpoint on adoption and relationship repair.`
        : intel.expansion_likelihood === 'high'
          ? `${clientName} shows expansion readiness — align success and commercial motion.`
          : `${clientName} — prepare a proactive check-in focused on value and renewal health.`

  return {
    headline,
    who_to_engage: [...new Set(who_to_engage)].slice(0, 4),
    talking_points: [...new Set(talking_points)].slice(0, 5),
    risks_to_address: risks_to_address.slice(0, 4),
    expansion_angle,
    do_not_do,
  }
}
