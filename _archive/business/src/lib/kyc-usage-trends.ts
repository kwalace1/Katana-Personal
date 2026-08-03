/**
 * Usage trend signals — compare current metrics to prior snapshots (KYC doc §3, §8).
 */

export interface UsageSnapshot {
  portal_logins: number
  engagement_score: number
  feature_usage: string
  support_tickets: number
  active_users: number
  meetings_30d: number
  emails_30d: number
  health_score: number | null
  recorded_at: string
}

export interface UsageTrendFlags {
  declining_portal_usage: boolean
  improving_engagement: boolean
  user_growth: boolean
  meeting_activity_low: boolean
  email_engagement_low: boolean
}

const DECLINE_THRESHOLD = 0.2
const GROWTH_THRESHOLD = 0.15

export function computeUsageTrendFlags(
  current: Pick<
    UsageSnapshot,
    'portal_logins' | 'engagement_score' | 'active_users' | 'meetings_30d' | 'emails_30d'
  >,
  previous: UsageSnapshot | null | undefined,
): UsageTrendFlags {
  const flags: UsageTrendFlags = {
    declining_portal_usage: false,
    improving_engagement: false,
    user_growth: false,
    meeting_activity_low: current.meetings_30d === 0,
    email_engagement_low: current.emails_30d === 0,
  }

  if (!previous) return flags

  const prevLogins = Math.max(1, previous.portal_logins)
  const loginDelta = (current.portal_logins - previous.portal_logins) / prevLogins
  if (loginDelta <= -DECLINE_THRESHOLD && previous.portal_logins >= 3) {
    flags.declining_portal_usage = true
  }

  if (current.engagement_score - previous.engagement_score >= 10) {
    flags.improving_engagement = true
  }

  const prevUsers = Math.max(1, previous.active_users)
  const userDelta = (current.active_users - previous.active_users) / prevUsers
  if (userDelta >= GROWTH_THRESHOLD && current.active_users > previous.active_users) {
    flags.user_growth = true
  }

  return flags
}

export function usageTrendReasons(flags: UsageTrendFlags): string[] {
  const reasons: string[] = []
  if (flags.declining_portal_usage) reasons.push('Portal usage has declined vs prior period')
  if (flags.improving_engagement) reasons.push('Engagement score is improving')
  if (flags.user_growth) reasons.push('Active user count is growing')
  if (flags.meeting_activity_low) reasons.push('No meetings logged in the last 30 days')
  if (flags.email_engagement_low) reasons.push('No email touchpoints in the last 30 days')
  return reasons
}
