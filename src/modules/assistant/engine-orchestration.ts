import { formatShortDate, formatTime } from '@/lib/dates'
import { createId } from '@/lib/id'
import { buildGoalPlanReply, isGoalPlanQuestion } from '@/lib/orchestration/goal-plan'
import { findCalendarGap } from '@/lib/orchestration/calendar-gaps'
import { buildPickNextStepInput } from '@/lib/orchestration/build-input'
import { pickNextStep, resolveWorkoutPlan, isWorkoutBehind } from '@/lib/orchestration/next-step'
import type { LifeSnapshot } from './engine'
import type { AskReply } from './engine'
import type { AskAction } from './ask-api'
import { habitsApi } from '@/modules/habits/api'

function keepShort(sentences: string[], max = 3): string {
  return sentences.filter(Boolean).slice(0, max).join(' ')
}

/** Focus / what's next — uses the same picker as Today. */
export function answerFocusOrchestrated(
  userId: string,
  snap: LifeSnapshot,
  displayName?: string,
  preferences?: Record<string, unknown>,
): AskReply {
  const step = pickNextStep(
    buildPickNextStepInput(userId, snap, { preferences }),
  )
  if (!step) {
    return {
      text: 'Nothing urgent is waiting. That’s rare — rest, capture one small thing, or close the day.',
      actions: [
        { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
        { id: createId(), label: 'Capture something', kind: 'open_route', route: '/dashboard' },
      ],
    }
  }
  return {
    text: keepShort([`${step.title}.`, step.reason]),
    actions: step.actions.slice(0, 3),
  }
}

/** Triage: top 2 priorities + defer the rest. */
export function answerWhatMattersToday(
  userId: string,
  snap: LifeSnapshot,
  preferences?: Record<string, unknown>,
): AskReply {
  const step = pickNextStep(
    buildPickNextStepInput(userId, snap, { preferences }),
  )
  const topTasks = snap.priorityTasks.slice(0, 2)
  const deferCount = Math.max(0, snap.openTasks.length - topTasks.length)

  if (step && step.kind !== 'wind_down') {
    const lines = [`Start with “${step.title}.”`, step.reason]
    if (deferCount > 0) {
      lines.push(`${deferCount} other open task${deferCount === 1 ? '' : 's'} can wait.`)
    }
    return { text: keepShort(lines, 4), actions: step.actions.slice(0, 2) }
  }

  if (topTasks.length === 0) {
    return {
      text: 'Nothing heavy on the list — protect open time or check in on one habit.',
      actions: [
        { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
      ],
    }
  }

  const names = topTasks.map((t) => t.title).join(' and ')
  const defer =
    deferCount > 0 ? ` The other ${deferCount} can wait until tomorrow.` : ''
  const actions: AskAction[] = topTasks.slice(0, 2).map((t) => ({
    id: createId(),
    label: `Mark “${t.title}” done`,
    kind: 'complete_task',
    taskId: t.id,
  }))
  if (deferCount > 0) {
    actions.push({ id: createId(), label: 'Park the rest for tomorrow', kind: 'park_tasks' })
  }
  return {
    text: `These two actually matter today: ${names}.${defer}`,
    actions,
  }
}

/** Workout scheduling with calendar gap context. */
export function answerWorkoutOrchestrated(
  userId: string,
  snap: LifeSnapshot,
  q: string,
  preferences?: Record<string, unknown>,
): AskReply {
  const habits = habitsApi.list(userId)
  const plan = resolveWorkoutPlan(snap, habits, preferences)
  const gap = findCalendarGap(snap.todayEvents)
  const moveIntent = q.includes('move') || q.includes('reschedule') || q.includes('shift')

  if (!plan.enabled) {
    return {
      text: 'No workout rhythm set yet. Add a gym habit or log a session — then I can suggest windows.',
      actions: [
        { id: createId(), label: 'Open health', kind: 'open_route', route: '/health' },
        { id: createId(), label: 'Add a habit', kind: 'open_route', route: '/habits' },
      ],
    }
  }

  const behind = isWorkoutBehind(plan)
  const busyBlocks = snap.todayEvents.filter((e) => !e.all_day)
  let text: string

  if (busyBlocks.length === 0) {
    text =
      plan.completedThisWeek === 0
        ? `Your day looks open. ${plan.label} would fit now — you’re 0/${plan.weeklyTarget} this week.`
        : `Your day looks open. ${plan.completedThisWeek}/${plan.weeklyTarget} workouts done this week — ${gap.minutes >= 45 ? 'good window now' : 'a lighter session still helps'}.`
  } else if (gap.minutes >= 45 && gap.nextEvent) {
    text = moveIntent
      ? `Moving today’s workout to now keeps you on pace (${plan.completedThisWeek}/${plan.weeklyTarget} done). ~${Math.round(gap.minutes)} min before ${gap.nextEvent.title} at ${formatTime(gap.nextEvent.starts_at)}.`
      : `You’re free before ${gap.nextEvent.title} (${formatTime(gap.nextEvent.starts_at)}). ~${Math.round(gap.minutes)} minutes — enough for a session.`
  } else if (gap.minutes >= 45) {
    text = `${Math.round(gap.minutes)} minutes open today. ${behind ? 'You’re behind weekly pace — ' : ''}a ${55}-minute session fits.`
  } else {
    const last = busyBlocks[busyBlocks.length - 1]
    text = moveIntent
      ? `Today’s tight. After ${last.title} (${formatTime(last.ends_at || last.starts_at)}), see if a short session works — or try tomorrow morning.`
      : `I’d wait until after ${last.title} (${formatTime(last.ends_at || last.starts_at)}), then take a short session when the day opens up.`
  }

  const actions: AskAction[] = [
    { id: createId(), label: 'Log a workout', kind: 'open_route', route: '/health' },
    { id: createId(), label: 'Open calendar', kind: 'open_route', route: '/calendar' },
  ]
  if (plan.habitId) {
    actions.unshift({
      id: createId(),
      label: `Check in “${plan.label}”`,
      kind: 'toggle_habit',
      habitId: plan.habitId,
    })
  }

  return { text, actions }
}

/** Goal pace vs target date. */
export function answerGoalTrack(snap: LifeSnapshot, q: string): AskReply {
  const match = q.match(/on track for (.+)|track on (.+)|progress on (.+)/)
  const needle = match?.[1] || match?.[2] || match?.[3]
  const goal =
    (needle
      ? snap.activeGoals.find((g) => g.title.toLowerCase().includes(needle.trim().toLowerCase()))
      : null) ??
    snap.behindGoals[0] ??
    snap.activeGoals[0]

  if (!goal) {
    return {
      text: 'No goals yet. Add one with a target date and I can help you stay on pace.',
      actions: [{ id: createId(), label: 'Add a goal', kind: 'open_route', route: '/goals' }],
    }
  }

  const pct = Math.round((goal.progress / Math.max(goal.target, 1)) * 100)
  const behind = snap.behindGoals.some((g) => g.id === goal.id)
  const dateLine = goal.target_date
    ? ` Target: ${formatShortDate(goal.target_date)}.`
    : ''

  const text = behind
    ? `“${goal.title}” is at ${pct}% — behind pace.${dateLine} One small step today keeps it reachable.`
    : `“${goal.title}” is at ${pct}% — on pace.${dateLine} Keep the rhythm going.`

  return {
    text,
    actions: [
      {
        id: createId(),
        label: `Open “${goal.title}”`,
        kind: 'open_route',
        route: `/goals?id=${goal.id}`,
      },
      { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
    ],
  }
}

/** Park non-priority open tasks. */
export function answerTheseCanWait(userId: string, snap: LifeSnapshot): AskReply {
  const priorityIds = new Set(snap.priorityTasks.slice(0, 2).map((t) => t.id))
  const deferrable = snap.openTasks.filter((t) => !priorityIds.has(t.id))

  if (deferrable.length === 0) {
    return {
      text: 'Your list is already trimmed — nothing extra to defer.',
      actions: [{ id: createId(), label: 'Open tasks', kind: 'open_route', route: '/tasks' }],
    }
  }

  return {
    text: `${deferrable.length} task${deferrable.length === 1 ? '' : 's'} can wait. I’ll park non-priority items for tomorrow so you can focus.`,
    actions: [
      { id: createId(), label: 'Park non-priority tasks', kind: 'park_tasks' },
      { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
    ],
  }
}

const FOCUS_TEST =
  /work on|focus|priorit|should i do|what next|what’s next|what's next|whats next|to do|todo|get done|most important/

export function tryOrchestrationIntent(
  userId: string,
  snap: LifeSnapshot,
  q: string,
  displayName?: string,
  preferences?: Record<string, unknown>,
): AskReply | null {
  if (
    isGoalPlanQuestion(q) ||
    (q.includes('lose ') && q.includes('pound')) ||
    q.includes('help me reach') ||
    q.includes('plan to lose') ||
    q.includes('plan for my goal')
  ) {
    const plan = buildGoalPlanReply(userId, snap, q)
    if (plan) return plan
  }

  if (
    q.includes('what matters') ||
    q.includes('matter today') ||
    q.includes('actually matter') ||
    (q.includes('today') && q.includes('matter'))
  ) {
    return answerWhatMattersToday(userId, snap, preferences)
  }

  if (
    q.includes('can wait') ||
    q.includes('defer') ||
    q.includes('park the rest') ||
    (q.includes('wait') && q.includes('task'))
  ) {
    return answerTheseCanWait(userId, snap)
  }

  if (
    q.includes('on track') ||
    q.includes('track for') ||
    q.includes('progress on') ||
    (q.includes('goal') && (q.includes('track') || q.includes('pace') || q.includes('behind')))
  ) {
    return answerGoalTrack(snap, q)
  }

  if (q.includes('work out') || q.includes('workout') || q.includes('exercise') || q.includes('gym')) {
    return answerWorkoutOrchestrated(userId, snap, q, preferences)
  }

  if (FOCUS_TEST.test(q) || (q.includes('today') && (q.includes('what') || q.includes('should') || q.includes('do')))) {
    return answerFocusOrchestrated(userId, snap, displayName, preferences)
  }

  return null
}
