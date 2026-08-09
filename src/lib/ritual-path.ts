export type DayCloseSummary = {
  parked: number
  habitsDone: number
  habitsDue: number
  waterGlasses: number
  noteSnippet?: string
  dateLabel: string
}

const KEY = 'katana-personal:day-close-moment'

/** Park a day-card moment so Ask → close day can open the signature UI on Today. */
export function parkDayCloseMoment(summary: DayCloseSummary) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(summary))
  } catch {
    // ignore
  }
}

export function takeDayCloseMoment(): DayCloseSummary | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const parsed = JSON.parse(raw) as DayCloseSummary
    if (!parsed?.dateLabel) return null
    return parsed
  } catch {
    return null
  }
}

/** Ritual step while first-minute onboarding is incomplete. */
export function readRitualStep(): string | null {
  try {
    return localStorage.getItem('katana-personal:ritual-step')
  } catch {
    return null
  }
}

/**
 * Cold-path lock: until onboarding finishes, only Today (+ allowed Ask/Social steps) and Settings.
 */
export function ritualAllowsPath(pathname: string, onboardingDone: boolean): boolean {
  if (onboardingDone) return true
  if (pathname === '/dashboard' || pathname.startsWith('/settings')) return true
  const step = readRitualStep()
  if (pathname.startsWith('/ask') && (step === 'ask' || step === 'invite')) return true
  if (
    (pathname.startsWith('/social') || pathname.startsWith('/friends')) &&
    step === 'invite'
  ) {
    return true
  }
  return false
}
