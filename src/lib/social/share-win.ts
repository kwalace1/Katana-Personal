import type { FeedCard, FeedCardLift } from '@/lib/social/feed'
import { summarizeFeedCardLifts } from '@/lib/social/feed'
import { isFirstMinuteActive } from '@/lib/ritual-path'
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

export type LiftShareChoice = 'workout' | 'pr' | 'exercises'

export type LiftSharePr = {
  exerciseName: string
  weight: number
  reps: number
  previousBest: number
  extraPrCount?: number
}

export type ShareWinOffer = {
  card: FeedCard
  defaultCaption: string
  /** Sheet title — e.g. “Share this lift?” */
  headline: string
  /** When set, the share sheet can post the full workout, PRs, or chosen exercises. */
  liftShare?: {
    title: string
    dateLabel: string
    exercises: FeedCardLift[]
    pr?: LiftSharePr
  }
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

const PARK_KEY = 'katana-personal:share-win-parked'

/** Close the sheet but keep the win so Connect → return can resume it. */
export function parkShareWinForConnect() {
  if (!pending) return
  try {
    sessionStorage.setItem(PARK_KEY, JSON.stringify(pending))
  } catch {
    // ignore
  }
  dismissShareWin()
}

export function resumeParkedShareWin(): ShareWinOffer | null {
  try {
    const raw = sessionStorage.getItem(PARK_KEY)
    if (!raw) return null
    sessionStorage.removeItem(PARK_KEY)
    const parsed = JSON.parse(raw) as ShareWinOffer
    if (!parsed?.card || !parsed.headline) return null
    emit(parsed)
    return parsed
  } catch {
    return null
  }
}

/**
 * Offer an optional Feed share after a meaningful win.
 * No-ops if the user chose “Don’t ask”, or another prompt was shown recently
 * (unless `force` — used for the evening day-card signature moment).
 * Use `ignoreCooldown` for intentional accomplishments so rapid wins stay shareable.
 */
export function offerShareWin(
  offer: ShareWinOffer,
  delayMs = 550,
  opts?: { force?: boolean; ignoreCooldown?: boolean },
) {
  // Signature day card uses force — never permanently block that clip.
  if (isShareWinNever() && !opts?.force) return
  // First Minute must stay on Capture → Do this next. Creating a task is not a win yet.
  if (isFirstMinuteActive() && !opts?.force) return
  if (!opts?.force && !opts?.ignoreCooldown) {
    try {
      const last = Number(localStorage.getItem(LAST_KEY) || '0')
      if (Number.isFinite(last) && Date.now() - last < COOLDOWN_MS) return
    } catch {
      // ignore
    }
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

export function buildDayCloseShareCard(input: {
  dateLabel: string
  parked: number
  habitsDone: number
  habitsDue: number
  waterGlasses: number
  noteSnippet?: string
}): ShareWinOffer {
  const habitPart =
    input.habitsDue > 0
      ? `${input.habitsDone}/${input.habitsDue} habits`
      : input.habitsDone > 0
        ? `${input.habitsDone} habit${input.habitsDone === 1 ? '' : 's'}`
        : null
  const bits = [
    habitPart,
    input.waterGlasses > 0 ? `${input.waterGlasses} glasses` : null,
    input.parked > 0 ? `${input.parked} parked for tomorrow` : 'Inbox clear',
  ].filter(Boolean)
  const note = input.noteSnippet?.trim()
  return {
    headline: 'Share your day?',
    defaultCaption: note ? note.slice(0, 180) : 'Closed the day on Katana.',
    card: {
      kind: 'day',
      badge: 'Day closed',
      title: input.dateLabel,
      subtitle: 'One next step. Then rest.',
      stats: bits.join(' · '),
      quote: note ? note.slice(0, 140) : undefined,
    },
  }
}

export function liftsFromSession(userId: string, sessionId: string): FeedCardLift[] {
  return liftApi.sessionExerciseGroups(userId, sessionId).map((group) => ({
    name: group.name,
    sets: group.sets.map((set) => ({ weight: set.weight, reps: set.reps })),
  }))
}

export function buildLiftShareCard(input: {
  title: string
  dateLabel: string
  setCount: number
  exerciseCount: number
  lifts?: FeedCardLift[]
}): ShareWinOffer {
  const lifts = input.lifts?.filter((lift) => lift.name.trim()) || []
  const sets = input.setCount || lifts.reduce((n, lift) => n + (lift.sets?.length || 0), 0)
  const exercises = input.exerciseCount || lifts.length
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
      lifts,
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
  lifts?: FeedCardLift[]
}): ShareWinOffer {
  const delta = Math.round((input.weight - input.previousBest) * 10) / 10
  const extra =
    input.extraPrCount && input.extraPrCount > 0
      ? ` · +${input.extraPrCount} more PR${input.extraPrCount === 1 ? '' : 's'}`
      : ''
  const lifts =
    input.lifts && input.lifts.length > 0
      ? input.lifts
      : [{ name: input.exerciseName, sets: [{ weight: input.weight, reps: input.reps }] }]
  return {
    headline: 'Share your PR?',
    defaultCaption: `New PR on ${input.exerciseName} — ${input.weight} lb.`,
    card: {
      kind: 'workout',
      badge: 'New PR',
      title: input.exerciseName,
      subtitle: input.workoutTitle || 'Personal record',
      stats: `${input.weight} lb × ${input.reps}${delta > 0 ? ` · +${delta} lb` : ''}${extra}`,
      lifts,
    },
  }
}

export function buildLiftExercisesShareCard(input: {
  title: string
  dateLabel: string
  exercises: FeedCardLift[]
}): ShareWinOffer {
  const lifts = input.exercises.filter((lift) => lift.name.trim())
  const stats = summarizeFeedCardLifts(lifts) || 'Selected lifts'
  const names = lifts.map((lift) => lift.name).join(', ')
  return {
    headline: 'Share these lifts?',
    defaultCaption: lifts.length === 1 ? `Logged ${names}.` : `Logged ${lifts.length} lifts from ${input.title}.`,
    card: {
      kind: 'workout',
      badge: lifts.length === 1 ? 'Lift' : 'Lifts',
      title: lifts.length === 1 ? lifts[0]!.name : input.title,
      subtitle: input.dateLabel,
      stats,
      lifts,
    },
  }
}

export function resolveLiftShareOffer(
  liftShare: NonNullable<ShareWinOffer['liftShare']>,
  choice: LiftShareChoice,
  selectedNames: string[],
): ShareWinOffer {
  if (choice === 'pr' && liftShare.pr) {
    const prLifts = liftShare.exercises.filter(
      (lift) => lift.name.toLowerCase() === liftShare.pr!.exerciseName.toLowerCase(),
    )
    return buildLiftPrShareCard({
      ...liftShare.pr,
      workoutTitle: liftShare.title,
      lifts: prLifts.length > 0 ? prLifts : undefined,
    })
  }
  if (choice === 'exercises') {
    const selected = new Set(selectedNames.map((name) => name.toLowerCase()))
    const exercises = liftShare.exercises.filter((lift) => selected.has(lift.name.toLowerCase()))
    return buildLiftExercisesShareCard({
      title: liftShare.title,
      dateLabel: liftShare.dateLabel,
      exercises: exercises.length > 0 ? exercises : liftShare.exercises,
    })
  }
  return buildLiftShareCard({
    title: liftShare.title,
    dateLabel: liftShare.dateLabel,
    setCount: liftShare.exercises.reduce((n, lift) => n + (lift.sets?.length || 0), 0),
    exerciseCount: liftShare.exercises.length,
    lifts: liftShare.exercises,
  })
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

export function buildTaskCompleteShareCard(input: { title: string }): ShareWinOffer {
  return {
    headline: 'Share this win?',
    defaultCaption: `Done: ${input.title}`,
    card: {
      kind: 'task',
      badge: 'Task done',
      title: input.title,
      subtitle: 'Checked off',
      stats: 'One less thing on the list',
    },
  }
}

export function buildTaskCreatedShareCard(input: { title: string }): ShareWinOffer {
  return {
    headline: 'Share this plan?',
    defaultCaption: `Added to my list: ${input.title}`,
    card: {
      kind: 'task',
      badge: 'New task',
      title: input.title,
      subtitle: 'On the list',
      stats: 'Committed',
    },
  }
}

export function buildEventCreatedShareCard(input: {
  title: string
  whenLabel: string
}): ShareWinOffer {
  return {
    headline: 'Share this event?',
    defaultCaption: `On my calendar: ${input.title}`,
    card: {
      kind: 'event',
      badge: 'On the calendar',
      title: input.title,
      subtitle: input.whenLabel,
      stats: 'Locked in',
    },
  }
}

export function buildHabitCheckInShareCard(input: {
  title: string
  streak?: number
}): ShareWinOffer {
  const streak = input.streak && input.streak > 0 ? input.streak : null
  return {
    headline: 'Share this check-in?',
    defaultCaption: `Checked in on ${input.title}.`,
    card: {
      kind: 'habit',
      badge: 'Checked in',
      title: input.title,
      subtitle: 'Done for today',
      stats: streak ? `${streak} day streak` : 'Showing up',
    },
  }
}

export function buildJournalShareCard(input: {
  dateLabel: string
  moodLabel?: string
  snippet?: string
}): ShareWinOffer {
  const snippet = input.snippet?.trim()
  return {
    headline: 'Share today’s journal?',
    defaultCaption: snippet
      ? snippet.slice(0, 180)
      : input.moodLabel
        ? `Journaled — feeling ${input.moodLabel.toLowerCase()}.`
        : 'Took a minute to journal.',
    card: {
      kind: 'journal',
      badge: 'Journal',
      title: input.dateLabel,
      subtitle: input.moodLabel ? `Mood · ${input.moodLabel}` : 'Reflection locked in',
      stats: 'Wrote it down',
      quote: snippet ? snippet.slice(0, 140) : undefined,
    },
  }
}

/** Soft check-in: how you’re feeling today (still a win card, not freeform). */
export function buildFeelingShareCard(input: {
  dateLabel: string
  moodLabel: string
  note?: string
}): ShareWinOffer {
  const note = input.note?.trim()
  return {
    headline: 'Share how you’re feeling?',
    defaultCaption: note
      ? note.slice(0, 180)
      : `Feeling ${input.moodLabel.toLowerCase()} today.`,
    card: {
      kind: 'journal',
      badge: 'Feeling',
      title: input.moodLabel,
      subtitle: input.dateLabel,
      stats: 'Check-in',
      quote: note ? note.slice(0, 140) : undefined,
    },
  }
}

export function buildGoalProgressShareCard(input: {
  title: string
  progress: number
  target: number
  percent: number
}): ShareWinOffer {
  const hit = input.percent >= 100
  return {
    headline: hit ? 'Share this win?' : 'Share your progress?',
    defaultCaption: hit
      ? `Crushed my goal: ${input.title}.`
      : `${Math.round(input.percent)}% on ${input.title}.`,
    card: {
      kind: 'goal',
      badge: hit ? 'Goal crushed' : 'On track',
      title: input.title,
      subtitle: `${input.progress}/${input.target}`,
      stats: hit ? 'Done — progress locked in' : `${Math.round(input.percent)}% there`,
    },
  }
}

const ACCOMPLISHMENT_SHARE = { ignoreCooldown: true } as const

/** Task finished — always offer (respects “don’t ask”). */
export function offerTaskCompleteShare(title: string) {
  offerShareWin(buildTaskCompleteShareCard({ title }), 450, ACCOMPLISHMENT_SHARE)
}

export function offerTaskCreatedShare(title: string) {
  offerShareWin(buildTaskCreatedShareCard({ title }), 450, ACCOMPLISHMENT_SHARE)
}

export function offerEventCreatedShare(title: string, whenLabel: string) {
  offerShareWin(buildEventCreatedShareCard({ title, whenLabel }), 450, ACCOMPLISHMENT_SHARE)
}

export function offerHabitCheckedInShare(title: string, streak: number) {
  if (isStreakMilestone(streak)) {
    offerShareWin(buildHabitStreakShareCard({ title, streak }), 450, ACCOMPLISHMENT_SHARE)
  } else {
    offerShareWin(buildHabitCheckInShareCard({ title, streak }), 450, ACCOMPLISHMENT_SHARE)
  }
}

export function offerJournalShare(input: {
  dateLabel: string
  moodLabel?: string
  snippet?: string
}) {
  offerShareWin(buildJournalShareCard(input), 450, ACCOMPLISHMENT_SHARE)
}

export function offerFeelingShare(input: {
  dateLabel: string
  moodLabel: string
  note?: string
}) {
  offerShareWin(buildFeelingShareCard(input), 200, ACCOMPLISHMENT_SHARE)
}

export function offerGoalProgressShare(input: {
  goalId: string
  title: string
  progress: number
  target: number
}) {
  const percent = input.target > 0 ? (input.progress / input.target) * 100 : 0
  if (percent >= 100) {
    offerShareWin(
      buildGoalCompleteShareCard({ title: input.title, target: input.target }),
      450,
      ACCOMPLISHMENT_SHARE,
    )
    return
  }
  const band = takeGoalProgressBand(input.goalId, percent)
  if (band == null) return
  offerShareWin(
    buildGoalProgressShareCard({
      title: input.title,
      progress: input.progress,
      target: input.target,
      percent: band,
    }),
    450,
    ACCOMPLISHMENT_SHARE,
  )
}

const GOAL_PROGRESS_KEY = 'katana-personal:goal-progress-band'
const GOAL_BANDS = [25, 50, 75] as const

function takeGoalProgressBand(goalId: string, percent: number): number | null {
  try {
    const raw = localStorage.getItem(GOAL_PROGRESS_KEY)
    const seen = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    const last = typeof seen[goalId] === 'number' ? seen[goalId]! : 0
    let next: number | null = null
    for (const band of GOAL_BANDS) {
      if (percent >= band && last < band) next = band
    }
    if (next == null) return null
    seen[goalId] = next
    localStorage.setItem(GOAL_PROGRESS_KEY, JSON.stringify(seen))
    return next
  } catch {
    return percent >= 25 ? Math.min(75, Math.floor(percent / 25) * 25) : null
  }
}

/** After logging a lift session, offer the workout — PRs are optional, not the only choice. */
export function offerBestLiftShare(input: {
  userId: string
  sessionId: string
  title: string
  dateLabel: string
  setCount: number
  exerciseCount: number
}) {
  const exercises = liftsFromSession(input.userId, input.sessionId)
  const prs = liftApi.findTopWeightPrsForSession(input.userId, input.sessionId)
  const pr = prs[0]
    ? {
        exerciseName: prs[0].exerciseName,
        weight: prs[0].weight,
        reps: prs[0].reps,
        previousBest: prs[0].previousBest,
        extraPrCount: prs.length - 1,
      }
    : undefined
  const liftShare = {
    title: input.title,
    dateLabel: input.dateLabel,
    exercises,
    pr,
  }
  const base = pr
    ? buildLiftPrShareCard({ ...pr, workoutTitle: input.title, lifts: exercises })
    : buildLiftShareCard({
        title: input.title,
        dateLabel: input.dateLabel,
        setCount: input.setCount,
        exerciseCount: input.exerciseCount,
        lifts: exercises,
      })

  const { liftStreak } = computeLocalStreaks(input.userId)
  if (!pr && isStreakMilestone(liftStreak)) {
    offerShareWin(
      {
        ...buildHealthStreakShareCard({
          kind: 'lift',
          streak: liftStreak,
          detail: input.title,
        }),
        liftShare,
      },
      550,
      ACCOMPLISHMENT_SHARE,
    )
    return
  }

  offerShareWin(
    {
      ...base,
      headline: 'Share this lift?',
      liftShare,
    },
    550,
    ACCOMPLISHMENT_SHARE,
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
