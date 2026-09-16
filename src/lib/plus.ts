/** Katana Plus entitlements — local unlock or Stripe web checkout. */

export type PlusFeature =
  | 'llm'
  | 'challenge'
  | 'nutrition_ai'
  | 'programs'
  | 'diet_plans'
  | 'integrations'
  | 'orchestration_push'

const PLUS_KEY = 'katana-personal:plus'
const LLM_USAGE_KEY = 'katana-personal:llm-asks-day'

/** Free tier open-ended Ask depth before Plus. */
export const FREE_LLM_ASKS_PER_DAY = 3

export type PlusTierRow = {
  feature: PlusFeature
  label: string
  free: string
  plus: string
}

export const PLUS_FEATURE_MATRIX: PlusTierRow[] = [
  {
    feature: 'llm',
    label: 'Ask coach depth',
    free: `${FREE_LLM_ASKS_PER_DAY} open-ended LLM replies/day`,
    plus: 'Unlimited streaming Ask with memory & tools',
  },
  {
    feature: 'challenge',
    label: 'Circle challenges',
    free: 'Boards & streaks',
    plus: '7-day group challenges',
  },
  {
    feature: 'nutrition_ai',
    label: 'Meal & label AI',
    free: 'Manual logging + food search',
    plus: 'Photo/label estimates for honest fuel',
  },
  {
    feature: 'integrations',
    label: 'Connections',
    free: '.ics · weather · Health/Fitbit file import · Google/Outlook/Tasks/Todoist when configured',
    plus: 'Same connections — Plus is for Ask depth, challenges, meal AI, push',
  },
  {
    feature: 'orchestration_push',
    label: 'Proactive nudges',
    free: 'Gentle habit pings while app is open',
    plus: 'Orchestration push — workout windows & focus',
  },
  {
    feature: 'programs',
    label: 'Training programs',
    free: 'Beginner Full Body · Classic 5×5',
    plus: 'Push/Pull/Legs · Upper/Lower',
  },
  {
    feature: 'diet_plans',
    label: 'Diet templates',
    free: 'Starter plans',
    plus: 'Complete macro templates',
  },
]

/** Local demo unlock is for development only — never show it in production. */
export function demoPlusAllowed(): boolean {
  return import.meta.env.DEV
}

export function isPlusUnlocked(): boolean {
  try {
    return localStorage.getItem(PLUS_KEY) === '1'
  } catch {
    return false
  }
}

/** Unlock Plus without a store purchase yet. */
export function setPlusUnlocked(on: boolean) {
  try {
    if (on) localStorage.setItem(PLUS_KEY, '1')
    else localStorage.removeItem(PLUS_KEY)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('katana-plus-change'))
}

function todayKeyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readLlmUsage(): { day: string; count: number } {
  try {
    const raw = localStorage.getItem(LLM_USAGE_KEY)
    if (!raw) return { day: todayKeyLocal(), count: 0 }
    const parsed = JSON.parse(raw) as { day?: string; count?: number }
    if (parsed.day !== todayKeyLocal()) return { day: todayKeyLocal(), count: 0 }
    return { day: parsed.day, count: Number(parsed.count) || 0 }
  } catch {
    return { day: todayKeyLocal(), count: 0 }
  }
}

function writeLlmUsage(count: number) {
  try {
    localStorage.setItem(LLM_USAGE_KEY, JSON.stringify({ day: todayKeyLocal(), count }))
  } catch {
    // ignore
  }
}

export function freeLlmAsksRemaining(): number {
  if (isPlusUnlocked()) return Number.POSITIVE_INFINITY
  return Math.max(0, FREE_LLM_ASKS_PER_DAY - readLlmUsage().count)
}

export function canUseLlmAsk(): boolean {
  if (isPlusUnlocked()) return true
  return freeLlmAsksRemaining() > 0
}

/** Call after a successful LLM reply. */
export function consumeLlmAsk() {
  if (isPlusUnlocked()) return
  const { count } = readLlmUsage()
  writeLlmUsage(count + 1)
}

export function canUsePlusFeature(feature: PlusFeature): boolean {
  if (isPlusUnlocked()) return true
  if (feature === 'llm') return canUseLlmAsk()
  // Connections (.ics, weather, OAuth when configured) are free product surface.
  if (feature === 'integrations') return true
  return false
}

export function plusFeatureBlurb(feature: PlusFeature): { title: string; body: string } {
  if (feature === 'llm') {
    return {
      title: 'Accountability pack · deeper Ask',
      body: `Free keeps action chips forever. Plus unlocks unlimited Ask depth (streaming, memory, tools) after ${FREE_LLM_ASKS_PER_DAY} open-ended replies/day.`,
    }
  }
  if (feature === 'challenge') {
    return {
      title: 'Accountability pack · challenges',
      body: 'Circle boards stay free. Plus starts 7-day challenges that keep the group honest.',
    }
  }
  if (feature === 'integrations') {
    return {
      title: 'Connections',
      body: 'Calendars, tasks, weather, and health file import live under Settings → Connections. .ics and weather are free; OAuth apps connect once credentials are set.',
    }
  }
  if (feature === 'orchestration_push') {
    return {
      title: 'Accountability pack · proactive nudges',
      body: 'Free gentle reminders work while Katana is open. Plus sends orchestration nudges — workout windows, focus — even when the app is closed (Home Screen PWA + permission).',
    }
  }
  if (feature === 'programs') {
    return {
      title: 'Accountability pack · training programs',
      body: 'Beginner Full Body and Classic 5×5 stay free. Plus unlocks Push/Pull/Legs and Upper/Lower templates you can copy and edit.',
    }
  }
  if (feature === 'diet_plans') {
    return {
      title: 'Accountability pack · diet templates',
      body: 'Free includes starter diet plans. Plus unlocks complete macro templates you can copy and edit.',
    }
  }
  return {
    title: 'Accountability pack · fuel AI',
    body: 'Manual logging stays free. Plus estimates meals and Nutrition Facts so streaks stay honest.',
  }
}
