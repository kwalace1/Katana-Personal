import type { FeedCard } from '@/lib/social/feed'

const NEVER_KEY = 'katana-personal:share-win-never'
const LAST_KEY = 'katana-personal:share-win-last'
/** Avoid stacking prompts when someone logs several wins quickly. */
const COOLDOWN_MS = 40 * 60 * 1000
const STREAK_MILESTONES = new Set([3, 7, 14, 21, 30, 60, 90, 100, 365])

export type ShareWinOffer = {
  card: FeedCard
  defaultCaption: string
  /** Sheet title — e.g. “Share this lift?” */
  headline: string
}

type Listener = (offer: ShareWinOffer | null) => void

const listeners = new Set<Listener>()
let pending: ShareWinOffer | null = null
let delayTimer: ReturnType<typeof setTimeout> | null = null

export function isShareWinNever() {
  try {
    return localStorage.getItem(NEVER_KEY) === '1'
  } catch {
    return false
  }
}

export function setShareWinNever(never: boolean) {
  try {
    if (never) localStorage.setItem(NEVER_KEY, '1')
    else localStorage.removeItem(NEVER_KEY)
  } catch {
    // ignore
  }
}

export function isStreakMilestone(streak: number) {
  return STREAK_MILESTONES.has(streak)
}

export function getPendingShareWin() {
  return pending
}

export function subscribeShareWin(fn: Listener) {
  listeners.add(fn)
  fn(pending)
  return () => {
    listeners.delete(fn)
  }
}

function emit(offer: ShareWinOffer | null) {
  pending = offer
  for (const fn of listeners) fn(offer)
}

export function dismissShareWin() {
  if (delayTimer) {
    clearTimeout(delayTimer)
    delayTimer = null
  }
  emit(null)
}

/**
 * Offer an optional Feed share after a meaningful win.
 * No-ops if the user chose “Don’t ask”, or another prompt was shown recently.
 */
export function offerShareWin(offer: ShareWinOffer, delayMs = 550) {
  if (isShareWinNever()) return
  try {
    const last = Number(localStorage.getItem(LAST_KEY) || '0')
    if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return
  } catch {
    // ignore
  }

  if (delayTimer) clearTimeout(delayTimer)
  delayTimer = setTimeout(() => {
    delayTimer = null
    try {
      localStorage.setItem(LAST_KEY, String(Date.now()))
    } catch {
      // ignore
    }
    emit(offer)
  }, delayMs)
}

export function buildLiftShareCard(input: {
  title: string
  dateLabel: string
  setCount: number
  exerciseCount: number
}): ShareWinOffer {
  const sets = input.setCount
  const exercises = input.exerciseCount
  return {
    headline: 'Share this lift?',
    defaultCaption: `Just finished ${input.title}.`,
    card: {
      kind: 'workout',
      badge: 'Workout done',
      title: input.title,
      subtitle: input.dateLabel,
      stats:
        exercises > 0
          ? `${exercises} exercise${exercises === 1 ? '' : 's'} · ${sets} set${sets === 1 ? '' : 's'}`
          : `${sets} set${sets === 1 ? '' : 's'}`,
    },
  }
}

export function buildHabitStreakShareCard(input: {
  title: string
  streak: number
}): ShareWinOffer {
  return {
    headline: 'Share your streak?',
    defaultCaption: `${input.streak} days on ${input.title}.`,
    card: {
      kind: 'habit',
      badge: 'Streak',
      title: input.title,
      subtitle: 'Checked in today',
      stats: `${input.streak} day streak`,
    },
  }
}

export function buildGoalCompleteShareCard(input: {
  title: string
  target: number
}): ShareWinOffer {
  return {
    headline: 'Share this win?',
    defaultCaption: `Crushed my goal: ${input.title}.`,
    card: {
      kind: 'goal',
      badge: 'Goal crushed',
      title: input.title,
      subtitle: `${input.target}/${input.target}`,
      stats: 'Done — progress locked in',
    },
  }
}

export function buildHydrationShareCard(glasses: number): ShareWinOffer {
  return {
    headline: 'Share your hydration?',
    defaultCaption: 'Hydration goal crushed for today.',
    card: {
      kind: 'habit',
      badge: 'Hydrated',
      title: 'Water goal',
      subtitle: 'Cheers — streak locked for today',
      stats: `${glasses} glasses`,
    },
  }
}
