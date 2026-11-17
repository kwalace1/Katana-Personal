import { tasksApi } from '@/modules/tasks/api'
import { calendarApi } from '@/modules/calendar/api'
import { habitsApi } from '@/modules/habits/api'
import { goalsApi } from '@/modules/goals/api'
import { journalApi } from '@/modules/journal/api'
import { healthApi } from '@/modules/health/api'
import { formatWater, mlFromAmount, readWaterGoal, readWaterUnit, waterGoalMl, waterMl, waterUnitMeta } from '@/modules/health/water'
import { liftApi } from '@/modules/health/lift-api'
import { notesApi } from '@/modules/notes/api'
import { parseCapture } from '@/lib/capture'
import { addDays, format, formatShortDate, formatTime, todayKey } from '@/lib/dates'
import { createId } from '@/lib/id'
import { parkDayCloseMoment } from '@/lib/ritual-path'
import { buildWeekStats, type WeekStats } from '@/lib/week-review'
import type { Task } from '@/modules/tasks/types'
import type { CalendarEvent } from '@/modules/calendar/types'
import type { Habit } from '@/modules/habits/types'
import type { Goal } from '@/modules/goals/types'
import type { AskAction } from './ask-api'
import { tryOrchestrationIntent } from './engine-orchestration'
import { goalsBehindPace, goalPaceStatus } from '@/lib/orchestration/goal-pace'
import { pickWorkoutSlot } from '@/lib/orchestration/schedule-workout'
import { resolveWorkoutPlan } from '@/lib/orchestration/workout-plan'
import { coachGreeting, flavorBriefingText, type AskPersonality } from './personality'
import { enrichReplyWithShareMore, shouldSkipShareMoreNudge } from './share-more'
import { pickNextStepForUser } from '@/lib/orchestration/build-input'
import type { NextStep } from '@/lib/orchestration/next-step'
import {
  bindCommitmentToTask,
  clearCommitment,
  clearCommitmentForTask,
  getActiveCommitment,
  getActiveCommitmentSnapshot,
  makeCommitment,
  markCommitmentCheckedIn,
  needsCommitmentCheckIn,
  snoozeCommitment,
  type CommitmentCheckInOptions,
  type CommitmentSnapshot,
} from './commitments'
import {
  formatMemoriesForCoach,
  formatMemoryDisplayTag,
  listMemories,
  tryParseMemoryCommand,
} from './memory'
import { asAuthoritative } from './ask-reply-policy'
import type { AskMessage } from './ask-api'

export interface LifeSnapshot {
  name: string
  todayLabel: string
  openTasks: Task[]
  todayTasks: Task[]
  priorityTasks: Task[]
  upcomingEvents: CalendarEvent[]
  todayEvents: CalendarEvent[]
  habitsDue: Habit[]
  habitsDoneIds: string[]
  activeGoals: Goal[]
  behindGoals: Goal[]
  journalToday: boolean
  journalMood: string | null
  /** Recent journal excerpts for deeper Ask context */
  recentJournal: { date: string; mood: string | null; excerpt: string }[]
  waterGlasses: number
  /** Milliliters logged today. Falls back to waterGlasses for older snapshots. */
  waterMl?: number
  recentWorkouts: number
  recentLifts: number
  sleepHoursLast: number
  caloriesToday: number
  recentNotes: number
  week: WeekStats
  /** Active Ask accountability commitment, when one exists. */
  activeCommitment: CommitmentSnapshot | null
}

function loggedWaterMl(snap: { waterMl?: number; waterGlasses: number }) {
  return snap.waterMl ?? snap.waterGlasses
}

function waterProgressLabel(snap: { waterMl?: number; waterGlasses: number }) {
  const goal = readWaterGoal()
  return `${formatWater(loggedWaterMl(snap), goal.unit)} of ${formatWater(waterGoalMl(goal), goal.unit)}`
}

export interface AskReply {
  text: string
  actions: AskAction[]
  /** When true, Ask UI should try Gemini for a richer open-ended reply. */
  useLlm?: boolean
  /**
   * When true, this reply confirms a durable local mutation (memory, commitment, etc.).
   * Ask must not overwrite it with an LLM continuation.
   */
  authoritative?: boolean
}

export function buildSnapshot(userId: string, displayName = 'there'): LifeSnapshot {
  const today = new Date()
  const openTasks = tasksApi.listTasks(userId).filter((t) => t.status !== 'done')
  const habitsDue = habitsApi.dueToday(userId)
  const activeGoals = goalsApi.active(userId, 20)
  const behindGoals = goalsBehindPace(activeGoals, today)
  const journal = journalApi.forDate(userId, todayKey())
  const weekStart = todayKey(addDays(today, -7))
  const recentJournal = journalApi
    .list(userId)
    .slice(0, 5)
    .map((e) => ({
      date: e.date,
      mood: e.mood ?? null,
      excerpt: (e.body || '').replace(/\s+/g, ' ').trim().slice(0, 180),
    }))
    .filter((e) => e.excerpt.length > 0)

  return {
    name: displayName,
    todayLabel: format(today, 'EEEE, MMMM d'),
    openTasks,
    todayTasks: tasksApi.todayTasks(userId),
    priorityTasks: tasksApi.priorityTasks(userId, 5),
    upcomingEvents: calendarApi.upcoming(userId, 8),
    todayEvents: calendarApi.forDay(userId, today),
    habitsDue,
    habitsDoneIds: habitsDue.filter((h) => habitsApi.isDoneToday(userId, h.id)).map((h) => h.id),
    activeGoals,
    behindGoals,
    journalToday: Boolean(journal),
    journalMood: journal?.mood ?? null,
    recentJournal,
    waterGlasses: Math.round(waterMl(healthApi.getWater(userId))),
    waterMl: waterMl(healthApi.getWater(userId)),
    recentWorkouts: healthApi
      .listWorkouts(userId)
      .filter((w) => w.date >= weekStart && !w.lift_session_id).length,
    recentLifts: liftApi.listSessions(userId).filter((s) => s.date >= weekStart).length,
    sleepHoursLast: healthApi.listSleep(userId)[0]?.hours ?? 0,
    caloriesToday: healthApi
      .listNutrition(userId)
      .filter((n) => n.date === todayKey())
      .reduce((s, n) => s + (n.calories || 0), 0),
    recentNotes: notesApi.listNotes(userId).length,
    week: buildWeekStats(userId, today),
    activeCommitment: getActiveCommitmentSnapshot(userId),
  }
}

function listTitles(items: { title: string }[], limit = 4): string {
  if (items.length === 0) return 'none'
  return items
    .slice(0, limit)
    .map((i) => i.title)
    .join(', ')
}

/** Keep Ask replies scannable — a few short sentences. */
function keepShort(sentences: string[], max = 3): string {
  return sentences.filter(Boolean).slice(0, max).join(' ')
}

export function buildDailyBriefing(snap: LifeSnapshot): string {
  const parts: string[] = []
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  parts.push(`${hello}, ${snap.name}.`)

  if (snap.todayEvents.length > 0) {
    const first = snap.todayEvents[0]
    const when = first.all_day ? 'all day' : formatTime(first.starts_at)
    parts.push(
      snap.todayEvents.length === 1
        ? `You have one thing on the calendar today: ${first.title} (${when}).`
        : `You have ${snap.todayEvents.length} things on the calendar today, starting with ${first.title} (${when}).`,
    )
  } else if (snap.upcomingEvents.length > 0) {
    const next = snap.upcomingEvents[0]
    parts.push(`Your calendar is clear today. Next up is ${next.title} on ${formatShortDate(next.starts_at)}.`)
  } else {
    parts.push('Your calendar is open today — a good day to protect some quiet focus.')
  }

  if (snap.priorityTasks.length > 0) {
    const top = snap.priorityTasks[0]
    parts.push(
      snap.priorityTasks.length === 1
        ? `Top of the list: ${top.title}.`
        : `I’d start with ${top.title}. You also have ${snap.openTasks.length} open task${snap.openTasks.length === 1 ? '' : 's'} waiting.`,
    )
  } else {
    parts.push('No open tasks — enjoy the calm, or capture something small if it’s on your mind.')
  }

  if (snap.habitsDue.length > 0) {
    const left = snap.habitsDue.length - snap.habitsDoneIds.length
    if (left === 0) {
      parts.push('All of today’s habits are checked in. Nice.')
    } else {
      const pending = snap.habitsDue.filter((h) => !snap.habitsDoneIds.includes(h.id))
      parts.push(
        left === 1
          ? `One habit still open: ${pending[0].title}.`
          : `${left} habits still open — ${listTitles(pending, 3)}.`,
      )
    }
  }

  if (snap.behindGoals.length > 0) {
    parts.push(
      snap.behindGoals.length === 1
        ? `${snap.behindGoals[0].title} could use a little attention.`
        : `${snap.behindGoals.length} goals are moving slowly — ${listTitles(snap.behindGoals, 2)} stand out.`,
    )
  }

  if (!snap.journalToday) {
    parts.push('You haven’t written in your journal yet today.')
  }

  return parts.join(' ')
}

export function buildBriefingActions(snap: LifeSnapshot): AskAction[] {
  const actions: AskAction[] = []
  const top = snap.priorityTasks[0]
  if (top) {
    actions.push({
      id: createId(),
      label: `Mark “${top.title}” done`,
      kind: 'complete_task',
      taskId: top.id,
    })
  }
  const pendingHabit = snap.habitsDue.find((h) => !snap.habitsDoneIds.includes(h.id))
  if (pendingHabit) {
    actions.push({
      id: createId(),
      label: `Check in “${pendingHabit.title}”`,
      kind: 'toggle_habit',
      habitId: pendingHabit.id,
    })
  }
  if (loggedWaterMl(snap) < waterGoalMl()) {
    actions.push({ id: createId(), label: 'Log water', kind: 'log_water' })
  }
  if (!snap.journalToday) {
    actions.push({
      id: createId(),
      label: 'Open journal',
      kind: 'open_route',
      route: '/journal',
    })
  }
  return actions
}

/** @deprecated use buildBriefingActions */
function briefingActions(snap: LifeSnapshot): AskAction[] {
  return buildBriefingActions(snap)
}

/** Build the standard commitment check-in reply and mark it shown for today. */
export function buildCommitmentCheckInReply(
  userId: string,
  displayName?: string,
  personality: AskPersonality = 'supportive',
): AskReply | null {
  const commitment = getActiveCommitment(userId)
  if (!commitment) return null
  const task = tasksApi.getTask(userId, commitment.taskId)
  if (!task || task.status === 'done') return null

  markCommitmentCheckedIn(userId, commitment.id)
  const greeting = coachGreeting(personality, displayName || 'there')
  return {
    text: `${greeting}\n\nCheck-in: you asked me to hold you to “${commitment.title}.” It’s still open — do it now, snooze the check-in, or drop the commitment.`,
    actions: [
      {
        id: createId(),
        label: `Mark “${commitment.title}” done`,
        kind: 'complete_task',
        taskId: commitment.taskId,
      },
      {
        id: createId(),
        label: 'Snooze check-in',
        kind: 'snooze_commitment',
      },
      {
        id: createId(),
        label: 'Drop commitment',
        kind: 'drop_commitment',
      },
    ],
  }
}

/**
 * Mid-conversation / revisit check-in: once per day, skipped if recent chat already covers it.
 */
export function maybeAppendCommitmentCheckIn(
  userId: string,
  messages: Pick<AskMessage, 'role' | 'actions'>[],
  displayName?: string,
  personality: AskPersonality = 'supportive',
  checkInOpts?: CommitmentCheckInOptions,
): AskReply | null {
  if (!needsCommitmentCheckIn(userId, messages, new Date(), checkInOpts)) return null
  return buildCommitmentCheckInReply(userId, displayName, personality)
}

export type CoachOpeningParts = {
  /** Prebuilt life snapshot from PersonalContext.life */
  snap: LifeSnapshot
  /** Precomputed next step from PersonalContext.focus (null = nothing urgent) */
  next: NextStep | null
  /** Optional workload signals for gentler check-ins */
  checkInOpts?: CommitmentCheckInOptions
}

/**
 * Coach-first Ask open: check back on commitments first (once/day), else one next move.
 * Pass `parts` from buildPersonalContext when available so Ask shares one situation model.
 */
export function buildCoachOpening(
  userId: string,
  displayName?: string,
  personality: AskPersonality = 'supportive',
  preferences?: Record<string, unknown>,
  priorMessages: Pick<AskMessage, 'role' | 'actions'>[] = [],
  parts?: CoachOpeningParts,
): AskReply {
  const snap = parts?.snap ?? buildSnapshot(userId, displayName)
  const greeting = coachGreeting(personality, snap.name)

  if (needsCommitmentCheckIn(userId, priorMessages, new Date(), parts?.checkInOpts)) {
    const checkIn = buildCommitmentCheckInReply(userId, displayName, personality)
    if (checkIn) return checkIn
  }

  const next =
    parts && 'next' in parts ? parts.next : pickNextStepForUser(userId, snap, { preferences })

  if (!next) {
    return {
      text: `${greeting} Nothing urgent on the plate. Capture one thing, or ask me to hold you to a commitment.`,
      actions: buildBriefingActions(snap).slice(0, 3),
    }
  }

  const actions = (next.actions.length > 0 ? next.actions : buildBriefingActions(snap)).slice(0, 4)
  return {
    text: `${greeting}\n\nNext move: ${next.title}.\n${next.reason}`,
    actions,
  }
}

/** Create a commitment task and return a coach reply (rules path + shared helper). */
export function commitToTitle(
  userId: string,
  title: string,
  personality: AskPersonality = 'supportive',
): AskReply {
  const { taskId, title: clean } = makeCommitment(userId, title)
  const greeting =
    personality === 'tough'
      ? `Locked. “${clean}” is your commitment — no soft outs.`
      : personality === 'dry'
        ? `Noted. I’m holding you to “${clean}.” How novel.`
        : `Got it — I’m holding you to “${clean}.” I’ll check back next time you open Ask.`
  return asAuthoritative({
    text: greeting,
    actions: [
      {
        id: createId(),
        label: `Mark “${clean}” done`,
        kind: 'complete_task',
        taskId,
      },
      { id: createId(), label: 'Open Tasks', kind: 'open_route', route: '/tasks' },
    ],
  })
}

function answerFocus(snap: LifeSnapshot): AskReply {
  /** One chip that acts — demo path: Ask → tap → done. */
  if (snap.priorityTasks.length > 0) {
    const top = snap.priorityTasks[0]!
    return {
      text: `Start with “${top.title}.” One next step — then reassess.`,
      actions: [
        {
          id: createId(),
          label: `Mark “${top.title}” done`,
          kind: 'complete_task',
          taskId: top.id,
        },
      ],
    }
  }
  const openHabit = snap.habitsDue.find((h) => !snap.habitsDoneIds.includes(h.id))
  if (openHabit) {
    return {
      text: `No open tasks — check in on “${openHabit.title}.” That’s enough for now.`,
      actions: [
        {
          id: createId(),
          label: `Check in “${openHabit.title}”`,
          kind: 'toggle_habit',
          habitId: openHabit.id,
        },
      ],
    }
  }
  if (snap.todayEvents.length > 0) {
    const first = snap.todayEvents[0]!
    return {
      text: `Plans first — “${first.title}” is on today. Protect time around it.`,
      actions: [
        {
          id: createId(),
          label: 'Open calendar',
          kind: 'open_route',
          route: `/calendar?date=${first.starts_at.slice(0, 10)}&id=${first.id}`,
        },
      ],
    }
  }
  return {
    text: 'Nothing urgent is waiting. That’s rare — rest, or capture one small thing for tomorrow.',
    actions: [
      {
        id: createId(),
        label: 'Capture something',
        kind: 'open_route',
        route: '/dashboard',
      },
    ],
  }
}

function answerWeek(snap: LifeSnapshot): AskReply {
  const w = snap.week
  const bits: string[] = []
  bits.push(`Week of ${w.label}.`)
  bits.push(
    w.tasksCompleted > 0
      ? `You finished ${w.tasksCompleted} task${w.tasksCompleted === 1 ? '' : 's'} this week.`
      : 'No tasks marked done this week yet.',
  )
  bits.push(
    w.habitCheckInDays > 0
      ? `Habits checked in on ${w.habitCheckInDays} day${w.habitCheckInDays === 1 ? '' : 's'}.`
      : 'No habit check-ins logged this week.',
  )
  const movement = w.workouts + w.lifts
  bits.push(
    movement > 0
      ? `Movement: ${w.workouts} workout${w.workouts === 1 ? '' : 's'}, ${w.lifts} lift session${w.lifts === 1 ? '' : 's'}.`
      : 'No workouts or lifts logged this week yet.',
  )
  if (w.journalDays > 0) {
    bits.push(`Journal on ${w.journalDays} day${w.journalDays === 1 ? '' : 's'}.`)
  }
  bits.push(
    snap.upcomingEvents.length > 0
      ? `Coming up: ${listTitles(snap.upcomingEvents, 4)}.`
      : 'The calendar ahead looks light.',
  )
  if (snap.behindGoals.length > 0) {
    bits.push(`Goals needing love: ${listTitles(snap.behindGoals, 3)}.`)
  }
  if (w.lookAhead) bits.push(w.lookAhead)

  const actions: AskAction[] = []
  const top = snap.priorityTasks[0]
  if (top) {
    actions.push({
      id: createId(),
      label: `Finish “${top.title}”`,
      kind: 'complete_task',
      taskId: top.id,
    })
  }
  if (snap.todayTasks.length > 0) {
    actions.push({
      id: createId(),
      label: 'Park today’s unfinished',
      kind: 'park_tasks',
    })
  }
  if (snap.behindGoals[0]) {
    actions.push({
      id: createId(),
      label: `Open “${snap.behindGoals[0].title}”`,
      kind: 'open_route',
      route: `/goals?id=${snap.behindGoals[0].id}`,
    })
  }
  actions.push({ id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' })

  return { text: bits.join(' '), actions }
}

function answerCloseDay(snap: LifeSnapshot): AskReply {
  const unfinished = snap.todayTasks.length
  const habitsLeft = snap.habitsDue.length - snap.habitsDoneIds.length
  const parts = [
    'Let’s close the day gently.',
    unfinished > 0
      ? `${unfinished} unfinished task${unfinished === 1 ? '' : 's'} can move to tomorrow.`
      : 'No unfinished tasks due today.',
    habitsLeft > 0
      ? `${habitsLeft} habit${habitsLeft === 1 ? '' : 's'} still open — check in if you can.`
      : 'Habits look settled.',
  ]

  const actions: AskAction[] = []
  const pendingHabit = snap.habitsDue.find((h) => !snap.habitsDoneIds.includes(h.id))
  if (pendingHabit) {
    actions.push({
      id: createId(),
      label: `Check in “${pendingHabit.title}”`,
      kind: 'toggle_habit',
      habitId: pendingHabit.id,
    })
  }
  if (unfinished > 0) {
    actions.push({ id: createId(), label: 'Park unfinished for tomorrow', kind: 'park_tasks' })
  }
  actions.push({
    id: createId(),
    label: 'Close day',
    kind: 'close_day',
    body: '',
  })
  if (!snap.journalToday) {
    actions.push({ id: createId(), label: 'Write in journal', kind: 'open_route', route: '/journal' })
  }

  return { text: parts.join(' '), actions }
}

function answerTomorrow(snap: LifeSnapshot): AskReply {
  const tomorrowEvents = snap.upcomingEvents.filter((e) => {
    const d = new Date(e.starts_at)
    const tmr = addDays(new Date(), 1)
    return (
      d.getFullYear() === tmr.getFullYear() &&
      d.getMonth() === tmr.getMonth() &&
      d.getDate() === tmr.getDate()
    )
  })
  const bits = [
    'Prep for tomorrow:',
    tomorrowEvents.length > 0
      ? `On the calendar: ${listTitles(tomorrowEvents, 4)}.`
      : 'Nothing on the calendar yet — keep it light or add one anchor.',
    snap.priorityTasks[0]
      ? `Carry forward: ${snap.priorityTasks[0].title}.`
      : 'No priority task waiting — nice.',
  ]
  return {
    text: bits.join(' '),
    actions: [
      ...(snap.todayTasks.length > 0
        ? [{ id: createId(), label: 'Park today’s unfinished', kind: 'park_tasks' as const }]
        : []),
      { id: createId(), label: 'Add for tomorrow', kind: 'open_route', route: '/tasks' },
      { id: createId(), label: 'Open calendar', kind: 'open_route', route: '/calendar' },
    ],
  }
}

function answerClearMorning(snap: LifeSnapshot): AskReply {
  const morningEvents = snap.todayEvents.filter((e) => {
    if (e.all_day) return true
    return new Date(e.starts_at).getHours() < 12
  })
  const morningTasks = snap.priorityTasks.slice(0, 2)
  if (morningEvents.length === 0 && morningTasks.length === 0) {
    return {
      text: 'Your morning looks open. Protect an hour of quiet focus, or start with one habit check-in.',
      actions: buildBriefingActions(snap),
    }
  }
  const lines: string[] = ['Clear the morning:']
  if (morningEvents.length > 0) lines.push(`Calendar: ${listTitles(morningEvents, 3)}.`)
  if (morningTasks.length > 0) lines.push(`Then: ${listTitles(morningTasks, 2)}.`)
  const actions: AskAction[] = []
  if (morningTasks[0]) {
    actions.push({
      id: createId(),
      label: `Mark “${morningTasks[0].title}” done`,
      kind: 'complete_task',
      taskId: morningTasks[0].id,
    })
  }
  actions.push(...buildBriefingActions(snap).filter((a) => a.kind === 'toggle_habit' || a.kind === 'log_water'))
  return { text: lines.join(' '), actions }
}

function answerJournal(snap: LifeSnapshot): AskReply {
  if (snap.journalToday) {
    return {
      text: 'You’ve already written today. You can open the journal to add more, or save the page for evening close.',
      actions: [{ id: createId(), label: 'Open journal', kind: 'open_route', route: '/journal' }],
    }
  }
  return {
    text: 'A single honest line is enough. Tap below to jot “One thing I’m carrying” into today’s journal, or open the full page.',
    actions: [
      {
        id: createId(),
        label: 'Save a one-line journal',
        kind: 'upsert_journal',
        body: 'One thing I’m carrying from today.',
      },
      { id: createId(), label: 'Open journal', kind: 'open_route', route: '/journal' },
    ],
  }
}

function answerGoals(snap: LifeSnapshot): AskReply {
  if (snap.activeGoals.length === 0) {
    return {
      text: 'You don’t have any goals set yet. When you’re ready, add one that would make this season feel meaningful.',
      actions: [{ id: createId(), label: 'Add a goal', kind: 'open_route', route: '/goals' }],
    }
  }
  if (snap.behindGoals.length === 0) {
    return {
      text: `You’re keeping pace. Active goals: ${listTitles(snap.activeGoals, 5)}.`,
      actions: [{ id: createId(), label: 'Open goals', kind: 'open_route', route: '/goals' }],
    }
  }
  const lines = snap.behindGoals.slice(0, 5).map((g) => {
    const pct = Math.round((g.progress / Math.max(g.target, 1)) * 100)
    return `• ${g.title} (${pct}% there)`
  })
  const first = snap.behindGoals[0]
  return {
    text: `These could use a nudge:\n\n${lines.join('\n')}\n\nPick one and take a tiny step today.`,
    actions: [
      {
        id: createId(),
        label: `Open “${first.title}”`,
        kind: 'open_route',
        route: `/goals?id=${first.id}`,
      },
    ],
  }
}

function answerHabits(snap: LifeSnapshot): AskReply {
  if (snap.habitsDue.length === 0) {
    return {
      text: 'No habits for today. Add one if there’s a rhythm you want to keep.',
      actions: [{ id: createId(), label: 'Add a habit', kind: 'open_route', route: '/habits' }],
    }
  }
  const pending = snap.habitsDue.filter((h) => !snap.habitsDoneIds.includes(h.id))
  if (pending.length === 0) {
    return {
      text: 'You’ve checked in on every habit today. Beautiful.',
      actions: [{ id: createId(), label: 'Open habits', kind: 'open_route', route: '/habits' }],
    }
  }
  const first = pending[0]
  return {
    text: `Still open today: ${listTitles(pending, 6)}. One check-in is enough to keep the streak alive.`,
    actions: [
      {
        id: createId(),
        label: `Check in “${first.title}”`,
        kind: 'toggle_habit',
        habitId: first.id,
      },
    ],
  }
}

function answerHealth(snap: LifeSnapshot): AskReply {
  const bits = [
    `Water today: ${waterProgressLabel(snap)}.`,
    `Workouts this week: ${snap.recentWorkouts}. Lifts: ${snap.recentLifts}.`,
  ]
  if (snap.sleepHoursLast > 0) bits.push(`Last sleep logged: ${snap.sleepHoursLast}h.`)
  if (snap.caloriesToday > 0) bits.push(`Meals today: ${snap.caloriesToday} cal.`)
  bits.push(
    loggedWaterMl(snap) < waterGoalMl() ? 'Logging a bit more water would be a kind next step.' : 'Hydration looks solid.',
  )
  return {
    text: bits.join(' '),
    actions: [
      { id: createId(), label: 'Log water', kind: 'log_water' },
      { id: createId(), label: 'Open health', kind: 'open_route', route: '/health' },
    ],
  }
}

function answerAboutMe(snap: LifeSnapshot, userId: string): AskReply {
  const parts: string[] = [
    `Here’s a snapshot of you in Katana, ${snap.name}.`,
    `Today is ${snap.todayLabel}.`,
  ]
  const remembered = formatMemoriesForCoach(userId)
  if (remembered) {
    parts.push(`What you’ve asked me to remember: ${remembered}.`)
  } else {
    parts.push('No personal memories saved yet — say “remember that…” anytime.')
  }
  parts.push(
    snap.openTasks.length > 0
      ? `You have ${snap.openTasks.length} open task${snap.openTasks.length === 1 ? '' : 's'}${
          snap.priorityTasks[0] ? `, led by “${snap.priorityTasks[0].title}”` : ''
        }.`
      : 'Your task list is clear.',
  )
  parts.push(
    snap.habitsDue.length > 0
      ? `Habits today: ${snap.habitsDoneIds.length} of ${snap.habitsDue.length} done${
          snap.habitsDue[0] ? ` (${listTitles(snap.habitsDue, 3)})` : ''
        }.`
      : 'No habits set yet — you can add them anytime.',
  )
  if (snap.activeGoals.length > 0) {
    parts.push(
      snap.behindGoals.length > 0
        ? `Active goals: ${listTitles(snap.activeGoals, 3)}. Needs attention: ${listTitles(snap.behindGoals, 2)}.`
        : `Active goals: ${listTitles(snap.activeGoals, 3)} — looking steady.`,
    )
  } else {
    parts.push('No active goals yet.')
  }
  parts.push(
    `Health: ${waterProgressLabel(snap)} today, ${snap.recentWorkouts} workout${snap.recentWorkouts === 1 ? '' : 's'} and ${snap.recentLifts} lift session${snap.recentLifts === 1 ? '' : 's'} this week${
      snap.caloriesToday > 0 ? `, ${snap.caloriesToday} cal logged today` : ''
    }.`,
  )
  if (snap.journalToday) {
    parts.push(
      snap.journalMood
        ? `You’ve journaled today (mood: ${snap.journalMood}).`
        : 'You’ve journaled today.',
    )
  } else {
    parts.push('No journal entry for today yet.')
  }
  if (snap.todayEvents.length > 0) {
    parts.push(`On the calendar: ${listTitles(snap.todayEvents, 3)}.`)
  }

  return {
    text: parts.join(' '),
    actions: [
      { id: createId(), label: 'Manage memories', kind: 'open_route', route: '/settings/memory' },
      { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
      { id: createId(), label: 'Open goals', kind: 'open_route', route: '/goals' },
    ],
  }
}

function answerCapabilities(_snap: LifeSnapshot): AskReply {
  return {
    text: keepShort([
      'I’m your day guide inside Katana — a calm daily OS, not another list app.',
      'I brief the day, focus you, and draft small actions — add a task or event, check a habit, log water, park work, or close the evening.',
      'Say “remember that…” to save a personal fact or preference; manage them anytime in Settings → Personal memory.',
      'Say what you need, like “add Call Mom Friday 3pm,” and tap to confirm. Together is optional.',
    ]),
    actions: [
      { id: createId(), label: 'What should I work on?', kind: 'open_route', route: '/ask?q=What%20should%20I%20work%20on%20today' },
      { id: createId(), label: 'Personal memory', kind: 'open_route', route: '/settings/memory' },
      { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
    ],
  }
}

function answerListMemories(userId: string): AskReply {
  const items = listMemories(userId)
  if (items.length === 0) {
    return {
      text: 'I don’t have any personal memories saved yet. Say “remember that…” and I’ll keep it — you can edit or delete anything in Settings.',
      actions: [
        { id: createId(), label: 'Open personal memory', kind: 'open_route', route: '/settings/memory' },
      ],
    }
  }
  const lines = items
    .slice(0, 12)
    .map((m) => `· ${formatMemoryDisplayTag(m)}: ${m.text}`)
    .join('\n')
  return {
    text: `Here’s what you’ve asked me to remember:\n${lines}${
      items.length > 12 ? `\n…and ${items.length - 12} more in Settings.` : ''
    }`,
    actions: [
      { id: createId(), label: 'Manage memories', kind: 'open_route', route: '/settings/memory' },
    ],
  }
}

function replyForMemoryCommand(
  userId: string,
  result: NonNullable<ReturnType<typeof tryParseMemoryCommand>>,
): AskReply {
  if (result.kind === 'remember' && result.memory) {
    const kindLabel =
      result.memory.kind === 'preference'
        ? 'preference'
        : result.memory.kind === 'fact'
          ? 'fact'
          : 'note'
    return asAuthoritative({
      text: `Got it — I’ll remember that ${kindLabel}: “${result.memory.text}.” You can edit or delete it anytime in Settings → Personal memory.`,
      actions: [
        { id: createId(), label: 'Manage memories', kind: 'open_route', route: '/settings/memory' },
      ],
    })
  }
  const removed = result.removed ?? 0
  if (result.text === 'all') {
    return asAuthoritative({
      text:
        removed > 0
          ? `Cleared ${removed} personal memor${removed === 1 ? 'y' : 'ies'}.`
          : 'No personal memories to clear.',
      actions: [
        { id: createId(), label: 'Open personal memory', kind: 'open_route', route: '/settings/memory' },
      ],
    })
  }
  return asAuthoritative({
    text:
      removed > 0
        ? `Forgot ${removed} memor${removed === 1 ? 'y' : 'ies'} matching “${result.text}.”`
        : `I couldn’t find a memory matching “${result.text}.” Check Settings → Personal memory to edit or delete.`,
    actions: [
      { id: createId(), label: 'Manage memories', kind: 'open_route', route: '/settings/memory' },
    ],
  })
}

function answerTogether(q: string): AskReply {
  if (
    q.includes('invite') ||
    q.includes('friend') ||
    q.includes('add me') ||
    q.includes('accountable') ||
    q.includes('accountability')
  ) {
    return {
      text: keepShort([
        'Together starts with friends.',
        'Connect cloud if needed, then share your Add-me link from Today or Friends.',
      ]),
      actions: [
        { id: createId(), label: 'Invite a friend', kind: 'open_route', route: '/social?tab=friends' },
        { id: createId(), label: 'Open Plans', kind: 'open_route', route: '/shared' },
      ],
    }
  }
  if (q.includes('shared') || q.includes('share')) {
    return {
      text: keepShort([
        'Plans is an inbox you copy into your tasks.',
        'Circle Schedule is what shows on Calendar.',
      ]),
      actions: [
        { id: createId(), label: 'Open Plans', kind: 'open_route', route: '/shared' },
        { id: createId(), label: 'Share from Tasks', kind: 'open_route', route: '/tasks' },
      ],
    }
  }
  return {
    text: keepShort([
      'Circles are streak boards and optional 7-day challenges.',
      'Check in on habits and water — they sync when cloud is on.',
    ]),
    actions: [
      { id: createId(), label: 'Open Circles', kind: 'open_route', route: '/circles' },
      { id: createId(), label: 'Open Friends', kind: 'open_route', route: '/social?tab=friends' },
    ],
  }
}

function answerAttention(snap: LifeSnapshot): AskReply {
  const items: string[] = []
  const actions: AskAction[] = []

  const pendingHabits = snap.habitsDue.filter((h) => !snap.habitsDoneIds.includes(h.id))
  if (pendingHabits.length > 0) {
    items.push(
      `${pendingHabits.length} habit${pendingHabits.length === 1 ? '' : 's'} still open: ${listTitles(pendingHabits, 4)}.`,
    )
    actions.push({
      id: createId(),
      label: `Check in “${pendingHabits[0].title}”`,
      kind: 'toggle_habit',
      habitId: pendingHabits[0].id,
    })
  }

  if (snap.behindGoals.length > 0) {
    items.push(`Goals needing attention: ${listTitles(snap.behindGoals, 3)}.`)
    actions.push({
      id: createId(),
      label: `Open “${snap.behindGoals[0].title}”`,
      kind: 'open_route',
      route: `/goals?id=${snap.behindGoals[0].id}`,
    })
  }

  if (snap.priorityTasks.length > 0) {
    items.push(
      `Priority task${snap.priorityTasks.length === 1 ? '' : 's'}: ${listTitles(snap.priorityTasks, 3)}.`,
    )
    actions.push({
      id: createId(),
      label: `Mark “${snap.priorityTasks[0].title}” done`,
      kind: 'complete_task',
      taskId: snap.priorityTasks[0].id,
    })
  } else if (snap.todayTasks.length > 0) {
    items.push(`Due today: ${listTitles(snap.todayTasks, 3)}.`)
  } else if (snap.openTasks.length > 0) {
    items.push(`${snap.openTasks.length} open task${snap.openTasks.length === 1 ? '' : 's'} waiting.`)
    actions.push({ id: createId(), label: 'Open tasks', kind: 'open_route', route: '/tasks' })
  }

  if (loggedWaterMl(snap) < waterGoalMl()) {
    items.push(`Water is at ${waterProgressLabel(snap)} for your Circles streak.`)
    actions.push({ id: createId(), label: 'Log water', kind: 'log_water' })
  }

  if (!snap.journalToday) {
    items.push('No journal entry for today yet.')
    actions.push({ id: createId(), label: 'Open journal', kind: 'open_route', route: '/journal' })
  }

  if (snap.todayEvents.length > 0) {
    items.push(`On the calendar today: ${listTitles(snap.todayEvents, 3)}.`)
  }

  if (items.length === 0) {
    return {
      text: keepShort([
        'Nothing major needing attention — habits, tasks, and goals look settled.',
        'Enjoy the calm, or capture something small.',
      ]),
      actions: [
        { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
        { id: createId(), label: 'Add a task', kind: 'open_route', route: '/tasks' },
      ],
    }
  }

  return {
    text: keepShort(
      [`Here’s what needs attention:`, ...items.map((line, i) => `${i + 1}. ${line}`)],
      5,
    ),
    actions: actions.slice(0, 4),
  }
}

function answerGreeting(snap: LifeSnapshot): AskReply {
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Hi' : 'Good evening'
  const attn = answerAttention(snap)
  const calm = attn.text.startsWith('Nothing major')
    ? keepShort([`${hello}, ${snap.name}.`, 'You’re in good shape today — nothing urgent jumping out.'])
    : keepShort([`${hello}, ${snap.name}.`, attn.text.split('\n')[0] || attn.text])
  return {
    text: calm,
    actions: attn.actions.slice(0, 3),
  }
}

function answerThanks(_snap: LifeSnapshot): AskReply {
  return {
    text: keepShort(['You’re welcome.', 'Ask for a briefing, a focus list, or help closing the day anytime.']),
    actions: [
      { id: createId(), label: 'What’s needing attention?', kind: 'open_route', route: '/ask?q=what%20needs%20attention' },
      { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
    ],
  }
}

function answerDefault(snap: LifeSnapshot): AskReply {
  const attn = answerAttention(snap)
  return {
    text: keepShort([attn.text.split('\n')[0] || attn.text, 'Or ask for a briefing, focus list, or “what can you do.”']),
    actions: attn.actions.slice(0, 4),
  }
}

export function answerQuestion(userId: string, question: string, displayName?: string): string {
  return answerQuestionWithActions(userId, question, displayName).text
}

type Intent = {
  test: (q: string) => boolean
  answer: (snap: LifeSnapshot, q: string, userId: string) => AskReply
}

function isGreeting(q: string): boolean {
  const cleaned = q.replace(/[!?.,]+$/g, '').trim()
  return /^(hi|hey|hello|yo|sup|hiya|howdy|good morning|good afternoon|good evening|morning|evening)(\s+there)?$/.test(
    cleaned,
  )
}

const INTENTS: Intent[] = [
  {
    test: (q) => isGreeting(q),
    answer: answerGreeting,
  },
  {
    test: (q) =>
      q.includes('thank') || q === 'ty' || q === 'thx' || q.includes('appreciate'),
    answer: answerThanks,
  },
  {
    test: (q) =>
      q.includes('what can you') ||
      q.includes('what do you do') ||
      q.includes('what are you') ||
      q.includes('your capabilities') ||
      q.includes('how do you work') ||
      q === 'help' ||
      q === 'commands' ||
      (q.includes('help') && (q.includes('what') || q.includes('how') || q.endsWith(' help'))),
    answer: answerCapabilities,
  },
  {
    test: (q) =>
      q.includes('about myself') ||
      q.includes('about me') ||
      q.includes('who am i') ||
      q.includes('my profile') ||
      q.includes('know about me') ||
      q.includes('tell me about my life'),
    answer: (snap, _q, userId) => answerAboutMe(snap, userId),
  },
  {
    test: (q) =>
      q.includes('what do you remember') ||
      q.includes('what you remember') ||
      q.includes('my memories') ||
      q.includes('personal memory') ||
      q.includes('what have you remembered') ||
      (q.includes('remember') &&
        (q.includes('what') || q.includes('show') || q.includes('list') || q.includes('tell'))),
    answer: (_snap, _q, userId) => answerListMemories(userId),
  },
  {
    test: (q) =>
      q.includes('friend') ||
      q.includes('invite') ||
      q.includes('circle') ||
      q.includes('shared') ||
      q.includes('together') ||
      q.includes('accountable') ||
      q.includes('accountability') ||
      q.includes('leaderboard') ||
      q.includes('challenge') ||
      (q.includes('share') && (q.includes('what') || q.includes('with') || q.includes('plan'))),
    answer: (_snap, q) => answerTogether(q),
  },
  {
    test: (q) =>
      q.includes('attention') ||
      q.includes('need attention') ||
      q.includes('needing attention') ||
      q.includes('catch me up') ||
      q.includes('catch up') ||
      q.includes('what did i miss') ||
      q.includes('what am i missing') ||
      q.includes('outstanding') ||
      q.includes('left to do') ||
      q.includes('still open') ||
      q.includes('loose end') ||
      q.includes('am i behind') ||
      q.includes('falling behind') ||
      q.includes('what needs') ||
      q.includes('anything need') ||
      q.includes('anything i need') ||
      q.includes('anything i should') ||
      q.includes('what should i know') ||
      q.includes('what’s left') ||
      q.includes("what's left") ||
      q.includes('whats left') ||
      q.includes('pending') ||
      (q.includes('open') && (q.includes('item') || q.includes('task') || q.includes('what'))),
    answer: answerAttention,
  },
  {
    test: (q) =>
      q.includes('close') ||
      q.includes('wrap up') ||
      q.includes('end my day') ||
      q.includes('end the day') ||
      (q.includes('evening') && (q.includes('close') || q.includes('wrap') || q.includes('end'))),
    answer: answerCloseDay,
  },
  {
    test: (q) =>
      q.includes('tomorrow') ||
      q.includes('prep') ||
      q.includes('prepare') ||
      (q.includes('ahead') && !q.includes('behind')),
    answer: answerTomorrow,
  },
  {
    test: (q) =>
      q.includes('clear my morning') ||
      q.includes('clear the morning') ||
      (q.includes('morning') && (q.includes('clear') || q.includes('plan') || q.includes('start'))),
    answer: answerClearMorning,
  },
  {
    test: (q) =>
      q.includes('journal') ||
      q.includes('reflect') ||
      q.includes('write in') ||
      q.includes('diary'),
    answer: answerJournal,
  },
  {
    test: (q) => q.includes('week') || q.includes('summar') || q.includes('review'),
    answer: answerWeek,
  },
  {
    test: (q) => q.includes('goal') || q.includes('behind') || q.includes('falling'),
    answer: answerGoals,
  },
  {
    test: (q) => q.includes('habit'),
    answer: answerHabits,
  },
  {
    test: (q) =>
      q.includes('health') ||
      q.includes('water') ||
      q.includes('sleep') ||
      q.includes('nutrition') ||
      q.includes('lift') ||
      q.includes('meal') ||
      q.includes('hydrat'),
    answer: answerHealth,
  },
  {
    test: (q) =>
      q.includes('task') ||
      q.includes('to-do') ||
      q.includes('checklist'),
    answer: answerFocus,
  },
  {
    test: (q) =>
      q.includes('calendar') ||
      q.includes('schedule') ||
      q.includes('event') ||
      q.includes('meeting') ||
      q.includes('what’s on') ||
      q.includes("what's on") ||
      q.includes('whats on'),
    answer: (snap) => {
      if (snap.todayEvents.length === 0 && snap.upcomingEvents.length === 0) {
        return {
          text: 'Your calendar is clear — nothing scheduled soon.',
          actions: [{ id: createId(), label: 'Open calendar', kind: 'open_route', route: '/calendar' }],
        }
      }
      if (snap.todayEvents.length > 0) {
        return {
          text: `Today: ${listTitles(snap.todayEvents, 5)}.${
            snap.upcomingEvents.length > snap.todayEvents.length
              ? ` Coming up next: ${listTitles(
                  snap.upcomingEvents.filter((e) => !snap.todayEvents.some((t) => t.id === e.id)),
                  3,
                )}.`
              : ''
          }`,
          actions: [{ id: createId(), label: 'Open calendar', kind: 'open_route', route: '/calendar' }],
        }
      }
      return {
        text: `Nothing today. Next up: ${listTitles(snap.upcomingEvents, 4)}.`,
        actions: [{ id: createId(), label: 'Open calendar', kind: 'open_route', route: '/calendar' }],
      }
    },
  },
  {
    test: (q) =>
      q.includes('brief') ||
      q.includes('overview') ||
      q.includes('how am i') ||
      q.includes('status') ||
      q.includes('how’s my day') ||
      q.includes("how's my day") ||
      q.includes('how is my day') ||
      q.includes('update me') ||
      q.includes('fill me in'),
    answer: (snap) => ({ text: buildDailyBriefing(snap), actions: briefingActions(snap) }),
  },
]

export function answerQuestionWithActions(
  userId: string,
  question: string,
  displayName?: string,
  personality: AskPersonality = 'supportive',
  preferences?: Record<string, unknown>,
): AskReply {
  const snap = buildSnapshot(userId, displayName)
  const q = question.trim().toLowerCase()

  if (!q || q === 'briefing') {
    const reply = {
      text: flavorBriefingText(personality, buildDailyBriefing(snap), snap.name),
      actions: briefingActions(snap),
    }
    return enrichReplyWithShareMore(userId, reply, snap, personality)
  }

  const commitment = tryParseCommitment(userId, question.trim(), personality, preferences)
  if (commitment) return commitment

  const memoryCmd = tryParseMemoryCommand(userId, question.trim())
  if (memoryCmd) return replyForMemoryCommand(userId, memoryCmd)

  const created = tryParseCreate(question.trim())
  if (created) return created

  const orchestrated = tryOrchestrationIntent(userId, snap, q, displayName, preferences)
  if (orchestrated) {
    if (shouldSkipShareMoreNudge(q)) return orchestrated
    return enrichReplyWithShareMore(userId, orchestrated, snap, personality)
  }

  for (const intent of INTENTS) {
    if (intent.test(q)) {
      const reply = intent.answer(snap, q, userId)
      if (shouldSkipShareMoreNudge(q)) return reply
      return enrichReplyWithShareMore(userId, reply, snap, personality)
    }
  }

  const fallback = answerDefault(snap)
  const reply = {
    ...fallback,
    text: flavorBriefingText(personality, fallback.text, snap.name),
    useLlm: true,
  }
  if (shouldSkipShareMoreNudge(q)) return reply
  return enrichReplyWithShareMore(userId, reply, snap, personality)
}

export function runAskAction(userId: string, action: AskAction): string {
  if (action.kind === 'drop_commitment') {
    const active = getActiveCommitment(userId)
    if (!active) return 'No active commitment to drop.'
    clearCommitment(userId, active.id)
    return `Dropped the commitment on “${active.title}.” The task stays on your list.`
  }
  if (action.kind === 'snooze_commitment') {
    const hours = action.body ? Number(action.body) : undefined
    const snoozed = snoozeCommitment(userId, {
      hours: Number.isFinite(hours) && (hours as number) > 0 ? (hours as number) : undefined,
      until: action.dueAt ?? undefined,
    })
    if (!snoozed) return 'No active commitment to snooze.'
    const when = snoozed.snoozeUntil
      ? new Date(snoozed.snoozeUntil).toLocaleString(undefined, {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'later'
    return `Snoozed “${snoozed.title}” until ${when}. I’ll check back then.`
  }
  if (action.kind === 'complete_task' && action.taskId) {
    tasksApi.completeTask(userId, action.taskId)
    clearCommitmentForTask(userId, action.taskId)
    return 'Marked done.'
  }
  if (action.kind === 'toggle_habit' && action.habitId) {
    habitsApi.toggleToday(userId, action.habitId)
    return 'Habit updated.'
  }
  if (action.kind === 'log_water') {
    const unit = readWaterUnit()
    const amount = waterUnitMeta(unit).defaultAmount
    healthApi.addVolume(userId, amount, unit)
    return `Logged ${formatWater(mlFromAmount(amount, unit), readWaterGoal().unit)}.`
  }
  if (action.kind === 'create_task' && action.title) {
    const lists = tasksApi.listLists(userId)
    const task = tasksApi.createTask(userId, {
      title: action.title,
      list_id: lists[0]?.id ?? null,
      due_at: action.dueAt ?? null,
    })
    return `Added “${task.title}”.`
  }
  if (action.kind === 'create_goal' && action.title) {
    const goal = goalsApi.create(userId, {
      title: action.title,
      target: 100,
      progress: 0,
      horizon: 'quarterly',
      target_date: action.dueAt ?? null,
    })
    return `Added goal “${goal.title}”.`
  }
  if (action.kind === 'create_habit' && action.title) {
    const habit = habitsApi.create(userId, {
      title: action.title,
      schedule: 'daily',
      reminder_time: '18:00',
    })
    return `Added habit “${habit.title}”.`
  }
  if (action.kind === 'create_event' && action.title && action.startsAt && action.endsAt) {
    calendarApi.create(userId, {
      title: action.title,
      notes: '',
      starts_at: action.startsAt,
      ends_at: action.endsAt,
      all_day: false,
      location: '',
      recurrence: 'none',
      reminder_minutes: 30,
    })
    return `Scheduled “${action.title}”.`
  }
  if (action.kind === 'schedule_workout') {
    const habits = habitsApi.list(userId)
    const snap = buildSnapshot(userId)
    const plan = resolveWorkoutPlan(snap, habits)
    const label = action.title || plan.label || 'Workout'
    const moveTomorrow =
      action.body === 'tomorrow' ||
      (typeof action.dueAt === 'string' && action.dueAt.includes('tomorrow'))
    const slot = pickWorkoutSlot(snap.todayEvents, label, new Date(), {
      preferTomorrowMorning: moveTomorrow,
    })
    calendarApi.create(userId, {
      title: slot.label,
      notes: 'Scheduled from Ask — movement block',
      starts_at: action.startsAt || slot.startsAt,
      ends_at: action.endsAt || slot.endsAt,
      all_day: false,
      location: '',
      recurrence: 'none',
      reminder_minutes: 15,
    })
    return moveTomorrow
      ? `Moved workout to tomorrow morning — blocked on your calendar.`
      : `Scheduled “${slot.label}” on your calendar.`
  }
  if (action.kind === 'adjust_goal' && action.goalId) {
    const goal = goalsApi.get(userId, action.goalId)
    if (!goal) return 'Goal not found.'
    const pace = goalPaceStatus(goal)
    const bump = Math.max(5, Math.round(goal.target * 0.05))
    const next = Math.min(goal.target, goal.progress + bump)
    goalsApi.update(userId, goal.id, { progress: next })
    return pace.behind
      ? `Caught up on “${goal.title}” (+${bump} progress). Keep one small step each week.`
      : `Updated “${goal.title}” progress.`
  }
  if (action.kind === 'park_tasks') {
    const tomorrow = addDays(new Date(), 1)
    tomorrow.setHours(17, 0, 0, 0)
    const unfinished = tasksApi.todayTasks(userId)
    for (const task of unfinished) {
      tasksApi.updateTask(userId, task.id, { due_at: tomorrow.toISOString() })
    }
    return unfinished.length
      ? `Parked ${unfinished.length} task${unfinished.length === 1 ? '' : 's'} for tomorrow.`
      : 'Nothing to park.'
  }
  if (action.kind === 'upsert_journal') {
    journalApi.create(userId, {
      mood: 'okay',
      body: action.body?.trim() || 'Noted from Ask.',
      reflection: 'Ask',
    })
    return 'Added to your journal.'
  }
  if (action.kind === 'close_day') {
    const tomorrow = addDays(new Date(), 1)
    tomorrow.setHours(17, 0, 0, 0)
    const unfinished = tasksApi.todayTasks(userId)
    for (const task of unfinished) {
      tasksApi.updateTask(userId, task.id, { due_at: tomorrow.toISOString() })
    }
    const note = action.body?.trim()
    if (note) {
      journalApi.create(userId, {
        mood: 'okay',
        body: note,
        reflection: 'Evening close',
      })
    }
    localStorage.setItem('katana-personal:day-close', todayKey())
    const due = habitsApi.dueToday(userId)
    const habitsDone = due.filter((h) => habitsApi.isDoneToday(userId, h.id)).length
    parkDayCloseMoment({
      parked: unfinished.length,
      habitsDone,
      habitsDue: due.length,
      waterGlasses: Math.round(waterMl(healthApi.getWater(userId))),
      noteSnippet: note || undefined,
      dateLabel: format(new Date(), 'EEEE · MMM d'),
    })
    return unfinished.length
      ? `Day closed — parked ${unfinished.length} for tomorrow.`
      : 'Day closed. Rest well.'
  }
  return ''
}

export const SUGGESTED_ASKS = [
  'What should I work on today?',
  'Clear my morning',
  'When should I work out?',
  'Review my week',
  'Prep for tomorrow',
  'Close my day',
  'Invite a friend',
  'What’s shared with me?',
  'How are my Circles?',
  'Add gym tomorrow',
] as const

/** Time-aware chips for Ask — keeps demos feeling alive without an LLM. */
export function suggestedAsksForHour(hour = new Date().getHours()): string[] {
  if (hour < 12) {
    return ['Clear my morning', 'What’s my one next move?', 'Hold me to my top priority']
  }
  if (hour < 17) {
    return ['What’s my one next move?', 'Am I avoiding something?', 'What’s shared with me?']
  }
  return ['Close my day', 'Did I keep my commitments?', 'Prep for tomorrow']
}

function tryParseCommitment(
  userId: string,
  question: string,
  personality: AskPersonality,
  preferences?: Record<string, unknown>,
): AskReply | null {
  const q = question.trim()
  const lower = q.toLowerCase()

  if (/^(?:drop|cancel|clear)(?:\s+my)?\s+commitment\s*[?.!]*$/i.test(lower)) {
    const active = getActiveCommitment(userId)
    if (!active) {
      return {
        text: 'No active commitment to drop.',
        actions: [{ id: createId(), label: 'Open Ask', kind: 'open_route', route: '/ask' }],
      }
    }
    clearCommitment(userId, active.id)
    return asAuthoritative({
      text: `Dropped the commitment on “${active.title}.” The task stays on your list unless you delete it.`,
      actions: [
        { id: createId(), label: 'Open Tasks', kind: 'open_route', route: '/tasks' },
        {
          id: createId(),
          label: `Mark “${active.title}” done`,
          kind: 'complete_task',
          taskId: active.taskId,
        },
      ],
    })
  }

  if (
    /^(?:snooze|pause|defer)(?:\s+(?:my|the))?\s+commitment\s*[?.!]*$/i.test(lower) ||
    /^(?:remind me later|not now)\s*[?.!]*$/i.test(lower)
  ) {
    const before = getActiveCommitment(userId)
    const message = runAskAction(userId, {
      id: createId(),
      label: 'Snooze',
      kind: 'snooze_commitment',
    })
    if (!before || !message || message.startsWith('No active')) {
      return {
        text: 'No active commitment to snooze.',
        actions: [{ id: createId(), label: 'Open Ask', kind: 'open_route', route: '/ask' }],
      }
    }
    return asAuthoritative({
      text: message,
      actions: [
        {
          id: createId(),
          label: `Mark “${before.title}” done`,
          kind: 'complete_task',
          taskId: before.taskId,
        },
      ],
    })
  }

  if (/^(?:did i keep|check)(?:\s+my)?\s+commitments?\s*[?.!]*$/i.test(lower)) {
    const active = getActiveCommitment(userId)
    if (!active) {
      return {
        text: 'No open commitment right now. Say “hold me to [thing]” and I’ll lock it in.',
        actions: [
          {
            id: createId(),
            label: 'Hold me to my top priority',
            kind: 'open_route',
            route: `/ask?q=${encodeURIComponent('Hold me to my top priority')}`,
          },
        ],
      }
    }
    return {
      text: `Still holding you to “${active.title}.” It’s open — finish it, snooze the check-in, or drop it.`,
      actions: [
        {
          id: createId(),
          label: `Mark “${active.title}” done`,
          kind: 'complete_task',
          taskId: active.taskId,
        },
        {
          id: createId(),
          label: 'Snooze check-in',
          kind: 'snooze_commitment',
        },
        {
          id: createId(),
          label: 'Drop commitment',
          kind: 'drop_commitment',
        },
      ],
    }
  }

  const bareHold =
    /^(?:hold me to(?:\s+it)?|keep me accountable|don't let me skip(?:\s+it)?|make me do (?:it|this))\s*[?.!]*$/i.test(
      lower,
    ) ||
    /hold me to (?:my )?(?:top )?priority|hold me to (?:my )?next(?: step)?/i.test(lower)

  if (bareHold) {
    const snap = buildSnapshot(userId)
    const next = pickNextStepForUser(userId, snap, { preferences })
    const title =
      next?.title ||
      snap.priorityTasks[0]?.title ||
      snap.todayTasks[0]?.title ||
      snap.openTasks[0]?.title
    if (!title) {
      return {
        text: 'Nothing on the plate to lock yet. Tell me what to hold you to — “hold me to finish the report.”',
        actions: [{ id: createId(), label: 'Open Tasks', kind: 'open_route', route: '/tasks' }],
      }
    }
    // If they're already committed to this task, just check in.
    const existing = getActiveCommitment(userId)
    if (existing && existing.title.toLowerCase() === title.toLowerCase()) {
      return {
        text: `Already holding you to “${existing.title}.” Still open — do it.`,
        actions: [
          {
            id: createId(),
            label: `Mark “${existing.title}” done`,
            kind: 'complete_task',
            taskId: existing.taskId,
          },
        ],
      }
    }
    // Prefer committing an existing open task when the title matches.
    const match =
      snap.openTasks.find((t) => t.title.toLowerCase() === title.toLowerCase()) ||
      snap.priorityTasks.find((t) => t.title.toLowerCase() === title.toLowerCase())
    if (match) {
      bindCommitmentToTask(userId, match.id, match.title)
      return asAuthoritative({
        text:
          personality === 'tough'
            ? `Locked on “${match.title}.” Do it.`
            : `I’m holding you to “${match.title}.” I’ll check back next time you open Ask.`,
        actions: [
          {
            id: createId(),
            label: `Mark “${match.title}” done`,
            kind: 'complete_task',
            taskId: match.id,
          },
        ],
      })
    }
    return commitToTitle(userId, title, personality)
  }

  const titled = q.match(
    /^(?:hold me to|keep me (?:accountable )?(?:for|to)|don't let me skip|make me (?:do|finish))\s+(.+)$/i,
  )
  if (!titled?.[1]) return null
  let raw = titled[1].trim().replace(/[.?!]+$/, '')
  raw = raw.replace(/^(?:my\s+)?(?:top\s+)?priority$/i, '').trim()
  if (!raw || /^(?:it|this|that)$/i.test(raw)) return null
  return commitToTitle(userId, raw, personality)
}

function tryParseCreate(question: string): AskReply | null {
  const q = question.trim()
  const lower = q.toLowerCase()

  // Intent without a title yet — teach the actionable phrase
  if (
    /^(?:i want to |i'?d like to |can you |could you |please )?(?:create|make|add|new)\s+(?:a\s+)?(?:new\s+)?(?:task|reminder|todo)s?\s*[?.!]*$/i.test(
      lower,
    ) ||
    /^(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?(?:task|reminder|todo)\s*[?.!]*$/i.test(lower)
  ) {
    return {
      text: keepShort([
        'Sure — tell me what it is.',
        'Try “add Call Mom Friday 3pm” or “create buy groceries tomorrow.” I’ll draft it and you tap to confirm.',
      ]),
      actions: [
        {
          id: createId(),
          label: 'Try “add Call Mom Friday 3pm”',
          kind: 'open_route',
          route: '/ask?q=add%20Call%20Mom%20Friday%203pm',
        },
        { id: createId(), label: 'Open Tasks', kind: 'open_route', route: '/tasks' },
      ],
    }
  }

  const addMatch = lower.match(
    /^(?:i want to |i'?d like to |can you |could you |please )?(?:add|remind me to|create|schedule|make|new task:?)\s+(?:a\s+)?(?:new\s+)?(?:task|reminder|todo|event)?\s*(?:for|to|called|titled|:)?\s*(.+)$/i,
  )
  if (!addMatch?.[1]) {
    const simple = lower.match(/^(?:add|remind me to|create|schedule|make)\s+(.+)$/i)
    if (!simple?.[1]) return null
    return parseCreatePayload(q, simple[1], lower)
  }

  let raw = addMatch[1].trim()
  // Drop leftover "a task" / "task:" prefixes if the regex left them
  raw = raw.replace(/^(?:a\s+)?(?:new\s+)?(?:task|reminder|todo|event)\s*(?:for|to|called|titled|:)?\s*/i, '').trim()
  if (!raw || /^(?:a\s+)?(?:task|reminder|todo|event)s?$/i.test(raw)) {
    return {
      text: keepShort([
        'What should I call it?',
        'Say “add [title]” — optional day/time like Friday 3pm.',
      ]),
      actions: [{ id: createId(), label: 'Open Tasks', kind: 'open_route', route: '/tasks' }],
    }
  }

  return parseCreatePayload(q, raw, lower)
}

function parseCreatePayload(original: string, raw: string, lower: string): AskReply | null {
  const isEvent =
    lower.startsWith('schedule') ||
    lower.includes(' meeting') ||
    lower.includes(' appointment') ||
    lower.includes(' event') ||
    raw.startsWith('@')
  const parsed = parseCapture(isEvent ? `@ ${raw.replace(/^@\s*/, '')}` : raw)
  if (!parsed) return null

  if (parsed.kind === 'event' && parsed.eventStart && parsed.eventEnd) {
    return {
      text: `I can schedule “${parsed.title}” (${parsed.summary.replace(/^Event · /, '')}). Tap to confirm.`,
      actions: [
        {
          id: createId(),
          label: `Schedule “${parsed.title}”`,
          kind: 'create_event',
          title: parsed.title,
          startsAt: parsed.eventStart.toISOString(),
          endsAt: parsed.eventEnd.toISOString(),
        },
      ],
    }
  }

  return {
    text: `I can add “${parsed.title}”${parsed.dueAt ? ` · ${parsed.summary.replace(/^Task · [^·]+ · /, '')}` : ''}. Tap to confirm.`,
    actions: [
      {
        id: createId(),
        label: `Add “${parsed.title}”`,
        kind: 'create_task',
        title: parsed.title,
        dueAt: parsed.dueAt,
      },
    ],
  }
}
