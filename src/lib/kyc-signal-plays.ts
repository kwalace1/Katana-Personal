/**
 * Signal → Meaning → Recommended Play engine (KYC doc §8).
 * Every play is grounded in an active signal — no invented opportunities.
 */

import { KYC_SIGNAL_LABELS, type KycClientSignals } from './kyc-client-scoring'
import { KYC_EXTERNAL_SIGNAL_LABELS, type KycExternalSignals } from './kyc-enrichment'

export interface KycSignalPlay {
  id: string
  signal_key: string
  signal_label: string
  meaning: string
  recommended_play: string
  category: 'internal' | 'external'
  sentiment: 'positive' | 'negative' | 'neutral'
}

const INTERNAL_PLAYS: Record<string, { meaning: string; play: string }> = {
  nps_promoter: {
    meaning: 'The customer is satisfied and may advocate internally.',
    play: 'Ask for a case study, referral, or executive testimonial while sentiment is strong.',
  },
  nps_detractor: {
    meaning: 'Satisfaction risk — unresolved frustration can accelerate churn.',
    play: 'Schedule a recovery call within 48 hours. Document issues and assign an owner before discussing expansion.',
  },
  low_portal_engagement: {
    meaning: 'Adoption is shallow — value may not be reaching daily users.',
    play: 'Send a product adoption guide and offer a guided walkthrough of high-impact features.',
  },
  high_feature_usage: {
    meaning: 'The account is extracting real value from the product.',
    play: 'Explore adjacent modules that extend workflows they already rely on — only if usage stays strong.',
  },
  open_support_tickets: {
    meaning: 'Active friction is on the support queue.',
    play: 'Review open tickets with the customer and confirm resolution timelines before renewal conversations.',
  },
  support_ticket_spike: {
    meaning: 'Support volume has spiked — often a leading churn indicator.',
    play: 'Escalate to a support review meeting and assign a CSM owner to track resolution through close.',
  },
  no_contact_30d: {
    meaning: 'The relationship has gone quiet — risk increases without executive touchpoints.',
    play: 'Schedule a check-in focused on outcomes, blockers, and renewal timeline.',
  },
  no_contact_60d: {
    meaning: 'Extended silence before renewal often means the account is disengaging.',
    play: 'Re-engage immediately — request a decision-maker meeting and confirm account priorities.',
  },
  renewal_within_90d: {
    meaning: 'Renewal is approaching — this is the window to protect and grow the account.',
    play: 'Create a renewal play: QBR, success plan review, and stakeholder alignment.',
  },
  renewal_within_30d: {
    meaning: 'Renewal is imminent — delay puts ARR at risk.',
    play: 'Run an urgent renewal call this week with economic buyer and champion present.',
  },
  missing_decision_maker: {
    meaning: 'No executive sponsor is mapped — renewals and expansion stall without one.',
    play: 'Ask your champion to introduce the economic buyer or budget owner.',
  },
  missing_primary_contact: {
    meaning: 'Account contact data is incomplete — outreach will be inconsistent.',
    play: 'Add a primary contact with email and role before the next customer touchpoint.',
  },
  invoice_overdue: {
    meaning: 'Billing friction can erode trust and block renewals.',
    play: 'Coordinate with finance on invoice resolution before any expansion discussion.',
  },
  open_deal: {
    meaning: 'There is active commercial momentum on this account.',
    play: 'Align CS and sales on deal stage, blockers, and success criteria for the expansion.',
  },
  icp_industry_match: {
    meaning: 'The account fits your ideal customer profile by industry.',
    play: 'Reference peer outcomes in their vertical when positioning additional capabilities.',
  },
  active_wfm_jobs: {
    meaning: 'Field operations are active — operational workflows are embedded.',
    play: 'Review whether scheduling, dispatch, or mobile workflows could deepen WFM adoption.',
  },
  overdue_cs_tasks: {
    meaning: 'Committed success work is overdue on this account.',
    play: 'Clear overdue CS tasks this week — unmet commitments damage trust.',
  },
  declining_portal_usage: {
    meaning: 'Portal logins are trending down — users may be disengaging.',
    play: 'Schedule an adoption review and identify blockers to daily portal use.',
  },
  low_feature_adoption: {
    meaning: 'Key product capabilities are underused.',
    play: 'Send a product adoption guide and offer a guided walkthrough of high-impact features.',
  },
  negative_contact_sentiment: {
    meaning: 'A mapped contact has negative sentiment toward the relationship.',
    play: 'Address concerns directly before renewal — document issues and assign an owner.',
  },
  blocker_contact_present: {
    meaning: 'A blocker is identified on the account.',
    play: 'Engage your champion to understand objections and align on measurable outcomes.',
  },
  no_executive_touchpoint: {
    meaning: 'No decision-maker has been contacted recently.',
    play: 'Request an executive check-in focused on renewal outcomes and strategic priorities.',
  },
  meeting_activity_low: {
    meaning: 'No recent meetings — relationship may be going quiet.',
    play: 'Schedule a customer check-in or QBR to re-establish cadence.',
  },
  email_engagement_low: {
    meaning: 'No recent email touchpoints logged.',
    play: 'Send a concise value recap email and propose a short sync call.',
  },
  user_growth: {
    meaning: 'Active user count is growing on the account.',
    play: 'Confirm whether additional seats or modules are needed to support growth.',
  },
}

const EXTERNAL_PLAYS: Record<string, { meaning: string; play: string }> = {
  expansion_news: {
    meaning: 'Public signals suggest the company may be growing.',
    play: 'Review whether scheduling, payroll, or operations automation would support their growth phase.',
  },
  funding_news: {
    meaning: 'New capital often precedes hiring and systems investment.',
    play: 'Position platform expansion as infrastructure for scale — confirm budget timing with leadership.',
  },
  leadership_news: {
    meaning: 'Leadership changes can reset vendor relationships and priorities.',
    play: 'Reach out to new stakeholders early with a concise value recap and success metrics.',
  },
  contraction_news: {
    meaning: 'External news suggests contraction, layoffs, or financial stress.',
    play: 'Lead with retention and ROI — avoid expansion until stability is confirmed.',
  },
  hiring_activity: {
    meaning: 'The company may be hiring — often a sign of operational growth.',
    play: 'Review whether scheduling, payroll, or operations automation would support their hiring phase.',
  },
  new_location: {
    meaning: 'Public signals suggest new locations or geographic expansion.',
    play: 'Explore whether multi-site workflows, inventory, or workforce tools fit their expansion.',
  },
  website_change: {
    meaning: 'Website or brand changes may signal a strategic shift.',
    play: 'Use the change as a conversation opener — confirm whether systems need to scale with them.',
  },
  registry_active: {
    meaning: 'The company appears active in public registries.',
    play: 'Use registry data to confirm legal entity and contract signatory accuracy.',
  },
}

export function buildSignalPlays(
  signals: KycClientSignals | null | undefined,
  options?: { limit?: number },
): KycSignalPlay[] {
  const s = signals ?? {}
  const plays: KycSignalPlay[] = []

  for (const [key, val] of Object.entries(s)) {
    if (val !== true) continue
    const internal = INTERNAL_PLAYS[key]
    if (internal && key in KYC_SIGNAL_LABELS) {
      const meta = KYC_SIGNAL_LABELS[key]!
      plays.push({
        id: `internal-${key}`,
        signal_key: key,
        signal_label: meta.label,
        meaning: internal.meaning,
        recommended_play: internal.play,
        category: 'internal',
        sentiment: meta.sentiment,
      })
      continue
    }
    const external = EXTERNAL_PLAYS[key]
    if (external && key in KYC_EXTERNAL_SIGNAL_LABELS) {
      const meta = KYC_EXTERNAL_SIGNAL_LABELS[key]!
      plays.push({
        id: `external-${key}`,
        signal_key: key,
        signal_label: meta.label,
        meaning: external.meaning,
        recommended_play: external.play,
        category: 'external',
        sentiment: meta.sentiment,
      })
    }
  }

  const order = { negative: 0, neutral: 1, positive: 2 }
  return plays
    .sort((a, b) => order[a.sentiment] - order[b.sentiment])
    .slice(0, options?.limit ?? 12)
}

export function mergeSignalsForPlays(
  internal: KycClientSignals,
  external?: KycExternalSignals | null,
): KycClientSignals {
  return { ...internal, ...(external ?? {}) }
}
