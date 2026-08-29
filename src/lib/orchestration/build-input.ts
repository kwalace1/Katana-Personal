import { todayKey } from '@/lib/dates'
import type { LifeSnapshot } from '@/modules/assistant/engine'
import { habitsApi } from '@/modules/habits/api'
import { healthApi } from '@/modules/health/api'
import { liftApi } from '@/modules/health/lift-api'
import { tasksApi } from '@/modules/tasks/api'
import { parsePreferenceWeights } from './feedback'
import { pickNextStep, resolveWorkoutPlan, type PickNextStepInput } from './next-step'

export function buildPickNextStepInput(
  userId: string,
  snap: LifeSnapshot,
  options?: {
    preferences?: Record<string, unknown>
    dayClosed?: boolean
    now?: Date
  },
): PickNextStepInput {
  const habits = habitsApi.dueToday(userId)
  const openHabits = habits.filter((h) => !habitsApi.isDoneToday(userId, h.id))
  const atRiskHabits = openHabits.filter((h) => habitsApi.streak(userId, h.id) >= 3)
  const today = todayKey(options?.now)
  const workedOutToday =
    healthApi.listWorkouts(userId).some((w) => w.date === today && !w.lift_session_id) ||
    liftApi.listSessions(userId).some((s) => s.date === today)

  return {
    snap,
    overdue: tasksApi.overdue(userId),
    openHabits,
    atRiskHabits,
    workoutPlan: resolveWorkoutPlan(snap, habitsApi.list(userId), options?.preferences),
    workedOutToday,
    dayClosed: options?.dayClosed,
    now: options?.now,
    preferenceWeights: parsePreferenceWeights(options?.preferences),
  }
}

export function pickNextStepForUser(
  userId: string,
  snap: LifeSnapshot,
  options?: Parameters<typeof buildPickNextStepInput>[2],
) {
  return pickNextStep(buildPickNextStepInput(userId, snap, options))
}
