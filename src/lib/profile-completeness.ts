/**
 * Profile completeness calculation and smart defaults for onboarding UX.
 */

import type { UserProfile } from '@/contexts/AuthContext'

// ============================================
// PROFILE COMPLETENESS
// ============================================

export interface CompletenessField {
  key: string
  label: string
  filled: boolean
  weight: number
  hint: string
  route: string
}

export interface CompletenessResult {
  score: number
  fields: CompletenessField[]
  missingFields: CompletenessField[]
  nextAction: { hint: string; route: string } | null
}

export function computeProfileCompleteness(
  profile: UserProfile | null,
  orgSettings?: Record<string, unknown> | null,
): CompletenessResult {
  if (!profile) {
    return { score: 0, fields: [], missingFields: [], nextAction: { hint: 'Sign in to get started', route: '/' } }
  }

  const fields: CompletenessField[] = [
    {
      key: 'full_name',
      label: 'Full Name',
      filled: !!profile.full_name?.trim(),
      weight: 20,
      hint: 'Add your name so teammates know who you are',
      route: '/settings/organization',
    },
    {
      key: 'avatar_url',
      label: 'Profile Photo',
      filled: !!profile.avatar_url?.trim(),
      weight: 10,
      hint: 'Upload a photo to personalize your profile',
      route: '/settings/organization',
    },
    {
      key: 'department',
      label: 'Department',
      filled: !!profile.department?.trim(),
      weight: 15,
      hint: 'Set your department for better team organization',
      route: '/settings/organization',
    },
    {
      key: 'job_title',
      label: 'Job Title',
      filled: !!profile.job_title?.trim(),
      weight: 15,
      hint: 'Add your role so others understand your responsibilities',
      route: '/settings/organization',
    },
    {
      key: 'org_name',
      label: 'Organization Name',
      filled: !!orgSettings,
      weight: 20,
      hint: 'Complete organization setup in Settings',
      route: '/onboarding',
    },
    {
      key: 'org_industry',
      label: 'Industry',
      filled: !!(orgSettings as Record<string, unknown> | null)?.industry,
      weight: 10,
      hint: 'Set your industry to unlock tailored features',
      route: '/onboarding',
    },
    {
      key: 'org_size',
      label: 'Company Size',
      filled: !!(orgSettings as Record<string, unknown> | null)?.company_size,
      weight: 10,
      hint: 'Help us optimize for your team size',
      route: '/onboarding',
    },
  ]

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0)
  const filledWeight = fields.filter((f) => f.filled).reduce((sum, f) => sum + f.weight, 0)
  const score = totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 0
  const missingFields = fields.filter((f) => !f.filled)
  const nextAction = missingFields.length > 0
    ? { hint: missingFields[0].hint, route: missingFields[0].route }
    : null

  return { score, fields, missingFields, nextAction }
}

// ============================================
// ONBOARDING FIELD PROMPTS
// ============================================

export interface SkippedFieldPrompt {
  id: string
  module: string
  field: string
  message: string
  action: string
  route: string
  priority: 'high' | 'medium' | 'low'
  dismissKey: string
}

const DISMISSED_PROMPTS_KEY = 'katana_dismissed_prompts'

export function getDismissedPrompts(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_PROMPTS_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export function dismissPrompt(key: string): void {
  const dismissed = getDismissedPrompts()
  dismissed.add(key)
  localStorage.setItem(DISMISSED_PROMPTS_KEY, JSON.stringify([...dismissed]))
}

export function getOnboardingPrompts(
  profile: UserProfile | null,
  orgSettings?: Record<string, unknown> | null,
): SkippedFieldPrompt[] {
  const dismissed = getDismissedPrompts()
  const prompts: SkippedFieldPrompt[] = []

  if (profile && !profile.full_name?.trim()) {
    prompts.push({
      id: 'profile-name',
      module: 'Profile',
      field: 'Full Name',
      message: 'Add your name to help teammates identify you',
      action: 'Complete Profile',
      route: '/settings/organization',
      priority: 'high',
      dismissKey: 'prompt_profile_name',
    })
  }

  if (profile && !profile.department?.trim()) {
    prompts.push({
      id: 'profile-dept',
      module: 'Profile',
      field: 'Department',
      message: 'Set your department for better team organization',
      action: 'Add Department',
      route: '/settings/organization',
      priority: 'medium',
      dismissKey: 'prompt_profile_dept',
    })
  }

  if (profile && !profile.job_title?.trim()) {
    prompts.push({
      id: 'profile-title',
      module: 'Profile',
      field: 'Job Title',
      message: 'Add your job title so others understand your role',
      action: 'Add Title',
      route: '/settings/organization',
      priority: 'medium',
      dismissKey: 'prompt_profile_title',
    })
  }

  if (!orgSettings || !(orgSettings as Record<string, unknown>)?.onboarding_completed) {
    prompts.push({
      id: 'org-setup',
      module: 'Organization',
      field: 'Setup',
      message: 'Complete organization setup to unlock all features',
      action: 'Finish Setup',
      route: '/onboarding',
      priority: 'high',
      dismissKey: 'prompt_org_setup',
    })
  }

  if (orgSettings && !(orgSettings as Record<string, unknown>)?.industry) {
    prompts.push({
      id: 'org-industry',
      module: 'Organization',
      field: 'Industry',
      message: 'Set your industry for tailored recommendations',
      action: 'Set Industry',
      route: '/onboarding',
      priority: 'low',
      dismissKey: 'prompt_org_industry',
    })
  }

  return prompts.filter((p) => !dismissed.has(p.dismissKey))
}

// ============================================
// SMART DEFAULTS
// ============================================

const SMART_DEFAULTS_KEY = 'katana_smart_defaults'

interface SmartDefaultsCache {
  lastDepartment?: string
  lastPriority?: string
  lastJobStatus?: string
  lastTechRole?: string
  lastClientStatus?: string
  recentTechnicians?: string[]
  recentLocations?: string[]
}

function getCache(): SmartDefaultsCache {
  try {
    const raw = localStorage.getItem(SMART_DEFAULTS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setCache(data: Partial<SmartDefaultsCache>): void {
  const existing = getCache()
  localStorage.setItem(SMART_DEFAULTS_KEY, JSON.stringify({ ...existing, ...data }))
}

export function recordSmartDefault(key: keyof SmartDefaultsCache, value: unknown): void {
  if (key === 'recentTechnicians' || key === 'recentLocations') {
    const cache = getCache()
    const existing = (cache[key] as string[]) || []
    const strVal = String(value)
    const updated = [strVal, ...existing.filter((v) => v !== strVal)].slice(0, 5)
    setCache({ [key]: updated })
  } else {
    setCache({ [key]: value })
  }
}

export function getSmartDefault<K extends keyof SmartDefaultsCache>(
  key: K,
): SmartDefaultsCache[K] | undefined {
  return getCache()[key]
}

export function getDefaultJobDates(): { startDate: string; endDate: string } {
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  return {
    startDate: today.toISOString().slice(0, 10),
    endDate: nextWeek.toISOString().slice(0, 10),
  }
}

export function getDefaultRenewalDate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}
