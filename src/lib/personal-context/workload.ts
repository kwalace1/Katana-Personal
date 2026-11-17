import { findCalendarGap } from '@/lib/orchestration/calendar-gaps'
import type { PickNextStepInput } from '@/lib/orchestration/next-step'
import type { LifeSnapshot } from '@/modules/assistant/engine'
import type {
  SituationConflict,
  WorkloadLevel,
  WorkloadSummary,
} from './types'

const TIGHT_CALENDAR_MIN = 45
const HEAVY_OVERDUE = 3
const HEAVY_TODAY_TASKS = 6

export function summarizeWorkload(
  life: LifeSnapshot,
  pick: PickNextStepInput,
  now = new Date(),
): { workload: WorkloadSummary; conflicts: SituationConflict[] } {
  const gap = findCalendarGap(life.todayEvents, now)
  const overdueCount = pick.overdue.length
  const todayTaskCount = life.todayTasks.length
  const openHabitCount = pick.openHabits.length
  const todayEventCount = life.todayEvents.length
  const behindGoalCount = life.behindGoals.length
  const freeMinutes = gap.minutes

  const conflicts: SituationConflict[] = []

  if (freeMinutes < TIGHT_CALENDAR_MIN && todayEventCount > 0) {
    conflicts.push({
      kind: 'calendar_tight',
      label: 'Little free time before the next block',
      detail: gap.nextEvent
        ? `${freeMinutes}m free before “${gap.nextEvent.title}”`
        : `${freeMinutes}m free this evening`,
    })
  }

  if (overdueCount > 0) {
    conflicts.push({
      kind: 'overdue_load',
      label:
        overdueCount === 1
          ? '1 overdue task needs attention'
          : `${overdueCount} overdue tasks need attention`,
      detail: pick.overdue
        .slice(0, 3)
        .map((t) => t.title)
        .join(', '),
    })
  }

  if (behindGoalCount > 0) {
    conflicts.push({
      kind: 'behind_goals',
      label:
        behindGoalCount === 1
          ? '1 goal is behind pace'
          : `${behindGoalCount} goals are behind pace`,
      detail: life.behindGoals
        .slice(0, 3)
        .map((g) => g.title)
        .join(', '),
    })
  }

  if (pick.sleep?.shortSleep || pick.sleep?.veryShortSleep) {
    conflicts.push({
      kind: 'recovery_needed',
      label: 'Sleep suggests a lighter push today',
      detail: `${pick.sleep.lastNightHours}h last night`,
    })
  }

  if (life.activeCommitment) {
    conflicts.push({
      kind: 'commitment_open',
      label: `Open commitment: “${life.activeCommitment.title}”`,
    })
  }

  const level = classifyWorkload({
    overdueCount,
    todayTaskCount,
    freeMinutes,
    todayEventCount,
    openHabitCount,
  })

  return {
    workload: {
      level,
      overdueCount,
      todayTaskCount,
      openHabitCount,
      todayEventCount,
      freeMinutes,
      behindGoalCount,
    },
    conflicts,
  }
}

function classifyWorkload(input: {
  overdueCount: number
  todayTaskCount: number
  freeMinutes: number
  todayEventCount: number
  openHabitCount: number
}): WorkloadLevel {
  const pressure =
    (input.overdueCount >= HEAVY_OVERDUE ? 2 : input.overdueCount > 0 ? 1 : 0) +
    (input.todayTaskCount >= HEAVY_TODAY_TASKS ? 2 : input.todayTaskCount >= 3 ? 1 : 0) +
    (input.freeMinutes < TIGHT_CALENDAR_MIN && input.todayEventCount > 0 ? 1 : 0) +
    (input.openHabitCount >= 4 ? 1 : 0)

  if (pressure >= 3) return 'heavy'
  if (pressure >= 1) return 'moderate'
  return 'light'
}
