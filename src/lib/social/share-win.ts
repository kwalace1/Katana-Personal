import type { FeedCard } from '@/lib/social/feed'
import { computeLocalStreaks } from '@/lib/social/streaks'
import { healthApi } from '@/modules/health/api'
import { liftApi } from '@/modules/health/lift-api'
import type { WeightGoalMode } from '@/modules/health/types'

const NEVER_KEY = 'katana-personal:share-win-never'
const LAST_KEY = 'katana-personal:share-win-last'
const WEIGHT_MILESTONE_KEY = 'katana-personal:weight-progress-milestone'
const SUPPLEMENT_STREAK_KEY = 'katana-personal:supplement-full-stack-dates'
/** Avoid stacking prompts when someone logs several wins quickly. */
const COOLDOWN_MS = 40 * 60 * 1000
const STREAK_MILESTONES = new Set([3, 7, 14, 21, 30, 60, 90, 100, 365])
const WEIGHT_BANDS = [25, 50, 75, 100] as const

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

export function buildLiftPrShareCard(input: {
  exerciseName: string
  weight: number
  reps: number
  previousBest: number
  workoutTitle?: string
  extraPrCount?: number
}): ShareWinOffer {
  const delta = Math.round((input.weight - input.previousBest) * 10) / 10
  const extra =
    input.extraPrCount && input.extraPrCount > 0
      ? ` · +${input.extraPrCount} more PR${input.extraPrCount === 1 ? '' : 's'}`
      : ''
  return {
    headline: 'Share your PR?',
    defaultCaption: `New PR on ${input.exerciseName} — ${input.weight} lb.`,
    card: {
      kind: 'workout',
      badge: 'New PR',
      title: input.exerciseName,
      subtitle: input.workoutTitle || 'Personal record',
      stats: `${input.weight} lb × ${input.reps}${delta > 0 ? ` · +${delta} lb` : ''}${extra}`,
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

export function buildHealthStreakShareCard(input: {
  kind: 'water' | 'sleep' | 'nutrition' | 'cardio' | 'lift' | 'supplements'
  streak: number
  detail?: string
}): ShareWinOffer {
  const copy = {
    water: {
      headline: 'Share your hydration streak?',
      caption: `${input.streak} days hitting water goal.`,
      badge: 'Hydration streak',
      title: 'Water',
      subtitle: input.detail || 'Goal locked in today',
    },
    sleep: {
      headline: 'Share your sleep streak?',
      caption: `${input.streak} nights of solid rest.`,
      badge: 'Sleep streak',
      title: 'Rest locked in',
      subtitle: input.detail || '7h+ nights',
    },
    nutrition: {
      headline: 'Share your nutrition streak?',
      caption: `${input.streak} days logging meals.`,
      badge: 'Fuel streak',
      title: 'Nutrition logged',
      subtitle: input.detail || 'Meals tracked today',
    },
    cardio: {
      headline: 'Share your move streak?',
      caption: `${input.streak} days of cardio.`,
      badge: 'Move streak',
      title: 'Cardio',
      subtitle: input.detail || 'Logged today',
    },
    lift: {
      headline: 'Share your lift streak?',
      caption: `${input.streak} days lifting.`,
      badge: 'Lift streak',
      title: 'In the gym',
      subtitle: input.detail || 'Session logged today',
    },
    supplements: {
      headline: 'Share your stack streak?',
      caption: `${input.streak} days completing supplements.`,
      badge: 'Stack streak',
      title: 'Supplements',
      subtitle: input.detail || 'Full stack today',
    },
  }[input.kind]

  return {
    headline: copy.headline,
    defaultCaption: copy.caption,
    card: {
      kind: input.kind === 'cardio' || input.kind === 'lift' ? 'workout' : 'habit',
      badge: copy.badge,
      title: copy.title,
      subtitle: copy.subtitle,
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

export function buildCardioShareCard(input: {
  activity: string
  minutes: number
  dateLabel: string
  personalBest?: boolean
}): ShareWinOffer {
  const mins = Math.round(input.minutes)
  return {
    headline: input.personalBest ? 'Share a cardio PR?' : 'Share this session?',
    defaultCaption: input.personalBest
      ? `Longest ${input.activity} yet — ${mins} min.`
      : `${input.activity} · ${mins} min.`,
    card: {
      kind: 'workout',
      badge: input.personalBest ? 'Cardio PR' : 'Solid session',
      title: input.activity,
      subtitle: input.dateLabel,
      stats: `${mins} min`,
    },
  }
}

export function buildWeightProgressShareCard(input: {
  mode: WeightGoalMode
  current: number
  target: number
  percent: number
}): ShareWinOffer {
  const modeLabel = input.mode === 'bulk' ? 'Bulk' : input.mode === 'cut' ? 'Cut' : 'Maintain'
  const hit = input.percent >= 100
  return {
    headline: hit ? 'Share your weight goal?' : 'Share your progress?',
    defaultCaption: hit
      ? `Hit my ${modeLabel.toLowerCase()} target — ${input.current} lb.`
      : `${Math.round(input.percent)}% of the way on my ${modeLabel.toLowerCase()}.`,
    card: {
      kind: 'goal',
      badge: hit ? 'Weight goal' : 'On track',
      title: modeLabel,
      subtitle: `${input.current} lb → ${input.target} lb`,
      stats: hit ? '100% · locked in' : `${Math.round(input.percent)}% there`,
    },
  }
}

/** After logging a lift session, pick the best share: PR > streak > workout done. */
export function offerBestLiftShare(input: {
  userId: string
  sessionId: string
  title: string
  dateLabel: string
  setCount: number
  exerciseCount: number
}) {
  const prs = liftApi.findTopWeightPrsForSession(input.userId, input.sessionId)
  if (prs.length > 0) {
    const top = prs[0]!
    offerShareWin(
      buildLiftPrShareCard({
        exerciseName: top.exerciseName,
        weight: top.weight,
        reps: top.reps,
        previousBest: top.previousBest,
        workoutTitle: input.title,
        extraPrCount: prs.length - 1,
      }),
    )
    return
  }

  const { liftStreak } = computeLocalStreaks(input.userId)
  if (isStreakMilestone(liftStreak)) {
    offerShareWin(
      buildHealthStreakShareCard({
        kind: 'lift',
        streak: liftStreak,
        detail: input.title,
      }),
    )
    return
  }

  offerShareWin(
    buildLiftShareCard({
      title: input.title,
      dateLabel: input.dateLabel,
      setCount: input.setCount,
      exerciseCount: input.exerciseCount,
    }),
  )
}

/** Returns the highest weight-progress band newly crossed (25/50/75/100), or null. */
export function takeWeightProgressMilestone(userId: string, percent: number): number | null {
  const key = `${WEIGHT_MILESTONE_KEY}:${userId}`
  let last = 0
  try {
    last = Number(localStorage.getItem(key) || '0')
  } catch {
    last = 0
  }
  let crossed: number | null = null
  for (const band of WEIGHT_BANDS) {
    if (last < band && percent >= band) crossed = band
  }
  if (crossed != null) {
    try {
      localStorage.setItem(key, String(crossed))
    } catch {
      // ignore
    }
  }
  return crossed
}

export function resetWeightProgressMilestones(userId: string) {
  try {
    localStorage.removeItem(`${WEIGHT_MILESTONE_KEY}:${userId}`)
  } catch {
    // ignore
  }
}

/** True when this session beats prior same-activity cardio durations (requires history). */
export function isCardioPersonalBest(
  userId: string,
  activity: string,
  minutes: number,
  excludeId?: string,
) {
  const name = activity.trim().toLowerCase()
  if (!name || minutes <= 0) return false
  let best = 0
  for (const w of healthApi.listCardio(userId)) {
    if (excludeId && w.id === excludeId) continue
    if ((w.activity || '').trim().toLowerCase() !== name) continue
    best = Math.max(best, Number(w.duration_minutes) || 0)
  }
  return best > 0 && minutes > best
}

/** Record a full-stack supplement day; return consecutive streak ending on date. */
export function recordSupplementFullStackDay(userId: string, date: string): number {
  const key = `${SUPPLEMENT_STREAK_KEY}:${userId}`
  let dates: string[] = []
  try {
    const raw = localStorage.getItem(key)
    dates = raw ? (JSON.parse(raw) as string[]) : []
    if (!Array.isArray(dates)) dates = []
  } catch {
    dates = []
  }
  if (!dates.includes(date)) {
    dates.push(date)
    dates.sort()
    try {
      localStorage.setItem(key, JSON.stringify(dates.slice(-400)))
    } catch {
      // ignore
    }
  }
  const set = new Set(dates)
  let streak = 0
  const cursor = new Date(`${date}T12:00:00`)
  for (let i = 0; i < 365; i++) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    const keyDay = `${y}-${m}-${d}`
    if (!set.has(keyDay)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
