/**
 * Contact-level intelligence rollup for account signals (KYC doc §3, §7).
 */

import type { CrmContact } from './customer-crm-api'

export interface ContactIntelSummary {
  avg_relationship_strength: number
  has_negative_sentiment: boolean
  has_blocker: boolean
  no_executive_touchpoint_60d: boolean
  negative_note_flags: string[]
  contact_count: number
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return null
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
}

export function summarizeContactIntel(contacts: CrmContact[]): ContactIntelSummary {
  if (contacts.length === 0) {
    return {
      avg_relationship_strength: 0,
      has_negative_sentiment: false,
      has_blocker: false,
      no_executive_touchpoint_60d: true,
      negative_note_flags: [],
      contact_count: 0,
    }
  }

  const strengths = contacts.map((c) => c.relationship_strength ?? 3)
  const avg = strengths.reduce((a, b) => a + b, 0) / strengths.length

  const has_negative_sentiment = contacts.some((c) => (c.sentiment ?? 'neutral') === 'negative')
  const has_blocker = contacts.some(
    (c) => c.contact_role === 'blocker' || (c.sentiment === 'negative' && c.contact_role === 'influencer'),
  )

  const executives = contacts.filter(
    (c) => c.contact_role === 'decision_maker' || c.is_decision_maker,
  )
  const no_executive_touchpoint_60d =
    executives.length === 0 ||
    executives.every((c) => {
      const days = daysSince(c.last_contact_date)
      return days == null || days >= 60
    })

  const negative_note_flags: string[] = []
  for (const c of contacts) {
    if ((c.sentiment ?? 'neutral') === 'negative') {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Contact'
      negative_note_flags.push(`${name} has negative sentiment`)
    }
    if (c.contact_role === 'blocker') {
      const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Contact'
      negative_note_flags.push(`${name} is flagged as a blocker`)
    }
  }

  return {
    avg_relationship_strength: Math.round(avg * 10) / 10,
    has_negative_sentiment,
    has_blocker,
    no_executive_touchpoint_60d,
    negative_note_flags: [...new Set(negative_note_flags)].slice(0, 4),
    contact_count: contacts.length,
  }
}

export function relationshipStrengthScore(summary: ContactIntelSummary): number {
  if (summary.contact_count === 0) return 30
  const base = (summary.avg_relationship_strength / 5) * 100
  let score = base
  if (summary.has_blocker) score -= 25
  if (summary.has_negative_sentiment) score -= 15
  if (summary.no_executive_touchpoint_60d) score -= 20
  return Math.max(0, Math.min(100, Math.round(score)))
}
