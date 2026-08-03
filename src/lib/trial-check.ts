/**
 * Trial / demo window helpers for organizations.
 */

import { supabase } from '@/lib/supabase'

export interface TrialBannerState {
  show: boolean
  variant: 'warning' | 'destructive'
  message: string
  daysLeft: number | null
}

export type OrgTrialFields = {
  subscription_status?: string
  trial_end_at?: string | null
  trial_start_at?: string | null
  trial_duration_days?: number | null
}

export function computeTrialBanner(org: OrgTrialFields | null): TrialBannerState {
  if (!org?.trial_end_at || org.subscription_status !== 'trial') {
    return { show: false, variant: 'warning', message: '', daysLeft: null }
  }
  const end = new Date(org.trial_end_at).getTime()
  const now = Date.now()
  const ms = end - now
  const daysLeft = Math.ceil(ms / (24 * 60 * 60 * 1000))
  if (daysLeft > 7) {
    return { show: false, variant: 'warning', message: '', daysLeft: daysLeft }
  }
  if (daysLeft <= 0) {
    return {
      show: true,
      variant: 'destructive',
      message: 'Your organization trial has ended. Access may be limited until you upgrade.',
      daysLeft: 0,
    }
  }
  return {
    show: true,
    variant: 'warning',
    message: `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
    daysLeft,
  }
}

/** If trial has expired, downgrade subscription_status to suspended (best-effort). */
export async function applyTrialExpiryIfNeeded(organizationId: string): Promise<void> {
  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .select('subscription_status, trial_end_at')
      .eq('id', organizationId)
      .maybeSingle()
    if (error || !org) return
    const status = org.subscription_status as string
    const end = org.trial_end_at ? new Date(org.trial_end_at as string).getTime() : null
    if (status === 'trial' && end != null && end < Date.now()) {
      await supabase
        .from('organizations')
        .update({ subscription_status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', organizationId)
    }
  } catch {
    /* ignore */
  }
}
