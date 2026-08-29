import { addDays } from '@/lib/dates'
import { createId } from '@/lib/id'
import type { AskAction } from '@/modules/assistant/ask-api'
import type { AskReply } from '@/modules/assistant/engine'
import type { Goal } from '@/modules/goals/types'

export interface GoalPaceStatus {
  goal: Goal
  expectedPct: number
  actualPct: number
  behind: boolean
  daysLeft: number | null
  daysElapsed: number | null
}

function pct(goal: Goal): number {
  return (goal.progress / Math.max(goal.target, 1)) * 100
}

/** Compare actual progress vs linear pace to target_date. */
export function goalPaceStatus(goal: Goal, now = new Date()): GoalPaceStatus {
  const actualPct = pct(goal)
  if (!goal.target_date) {
    const behind = actualPct < 40
    return { goal, expectedPct: 50, actualPct, behind, daysLeft: null, daysElapsed: null }
  }

  const target = new Date(goal.target_date.slice(0, 10))
  const start = goal.created_at ? new Date(goal.created_at) : addDays(now, -30)
  const totalMs = target.getTime() - start.getTime()
  const elapsedMs = now.getTime() - start.getTime()
  const daysLeft = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000))
  const daysElapsed = Math.max(1, Math.ceil(elapsedMs / 86400000))

  if (totalMs <= 0 || elapsedMs >= totalMs) {
    return { goal, expectedPct: 100, actualPct, behind: actualPct < 95, daysLeft, daysElapsed }
  }

  const expectedPct = Math.min(100, (elapsedMs / totalMs) * 100)
  const slack = goal.horizon === 'annual' ? 12 : goal.horizon === 'quarterly' ? 8 : 5
  const behind = actualPct + slack < expectedPct

  return { goal, expectedPct, actualPct, behind, daysLeft, daysElapsed }
}

export function goalsBehindPace(goals: Goal[], now = new Date()): Goal[] {
  return goals
    .filter((g) => goalPaceStatus(g, now).behind)
    .sort((a, b) => {
      const pa = goalPaceStatus(a, now)
      const pb = goalPaceStatus(b, now)
      const gapA = pa.expectedPct - pa.actualPct
      const gapB = pb.expectedPct - pb.actualPct
      return gapB - gapA
    })
}

export function buildGoalAdjustmentReply(snap: { activeGoals: Goal[] }, q: string): AskReply | null {
  const lower = q.toLowerCase()
  if (
    !lower.includes('fall behind') &&
    !lower.includes('falling behind') &&
    !lower.includes('adjust') &&
    !lower.includes('catch up') &&
    !lower.includes('get back on track')
  ) {
    return null
  }

  const behind = goalsBehindPace(snap.activeGoals)
  if (behind.length === 0) {
    return {
      text: 'You’re on pace for your active goals. Keep the rhythm — one small step beats a big overhaul.',
      actions: [{ id: createId(), label: 'Open goals', kind: 'open_route', route: '/goals' }],
    }
  }

  const status = goalPaceStatus(behind[0]!)
  const daysLine =
    status.daysLeft != null ? ` About ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'} left.` : ''
  const text = `“${behind[0]!.title}” is at ${Math.round(status.actualPct)}% — expected ~${Math.round(status.expectedPct)}% by now.${daysLine} Here’s a catch-up plan:`

  const actions: AskAction[] = [
    {
      id: createId(),
      label: `Bump progress on “${behind[0]!.title}”`,
      kind: 'adjust_goal',
      goalId: behind[0]!.id,
      title: behind[0]!.title,
    },
    {
      id: createId(),
      label: 'Weekly check-in task',
      kind: 'create_task',
      title: `Check in: ${behind[0]!.title}`,
      dueAt: addDays(new Date(), 7).toISOString(),
    },
    { id: createId(), label: 'Open goal', kind: 'open_route', route: `/goals?id=${behind[0]!.id}` },
  ]

  if (behind[0]!.title.toLowerCase().match(/weight|fit|gym|run|lose/)) {
    actions.unshift({
      id: createId(),
      label: 'Schedule gym this week',
      kind: 'schedule_workout',
      title: 'Gym',
    })
  }

  return { text, actions: actions.slice(0, 4) }
}
