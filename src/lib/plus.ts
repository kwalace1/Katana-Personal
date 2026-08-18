/** Katana Plus entitlements — local demo unlock until RevenueCat wires in. */

export type PlusFeature = 'llm' | 'challenge' | 'nutrition_ai' | 'programs' | 'diet_plans'

const PLUS_KEY = 'katana-personal:plus'
const LLM_USAGE_KEY = 'katana-personal:llm-asks-day'

/** Free tier open-ended Ask depth before Plus. */
export const FREE_LLM_ASKS_PER_DAY = 3

export function isPlusUnlocked(): boolean {
  try {
    return localStorage.getItem(PLUS_KEY) === '1'
  } catch {
    return false
  }
}

/** Shipaton / promo: unlock Plus without a store purchase yet. */
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
  return false
}

export function plusFeatureBlurb(feature: PlusFeature): { title: string; body: string } {
  if (feature === 'llm') {
    return {
      title: 'Accountability pack · deeper Ask',
      body: `Free keeps action chips forever. Plus unlocks unlimited coach depth after ${FREE_LLM_ASKS_PER_DAY} open-ended replies/day.`,
    }
  }
  if (feature === 'challenge') {
    return {
      title: 'Accountability pack · challenges',
      body: 'Circle boards stay free. Plus starts 7-day challenges that keep the group honest.',
    }
  }
  if (feature === 'programs') {
    return {
      title: 'Accountability pack · training programs',
      body: 'Starter and complete training templates are free. Plus still unlocks coach depth and meal AI.',
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
