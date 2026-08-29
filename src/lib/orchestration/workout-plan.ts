import type { LifeSnapshot } from '@/modules/assistant/engine'
import type { Habit } from '@/modules/habits/types'

const WORKOUT_HABIT_RE = /\b(gym|workout|work out|exercise|lift|training|run|jog)\b/i

export interface WorkoutPlan {
  enabled: boolean
  weeklyTarget: number
  completedThisWeek: number
  label: string
  habitId?: string
}

export function isWorkoutHabit(habit: Habit): boolean {
  return WORKOUT_HABIT_RE.test(habit.title)
}

/** Resolve weekly workout target from prefs, habits, or movement history. */
export function resolveWorkoutPlan(
  snap: LifeSnapshot,
  habits: Habit[],
  preferences?: Record<string, unknown>,
): WorkoutPlan {
  const prefTarget =
    typeof preferences?.weeklyWorkoutTarget === 'number' && preferences.weeklyWorkoutTarget > 0
      ? preferences.weeklyWorkoutTarget
      : null
  const workoutHabit = habits.find(isWorkoutHabit)
  const completed = snap.week.workouts + snap.week.lifts

  const hasFitnessSignal =
    completed > 0 || workoutHabit != null || prefTarget != null || snap.recentWorkouts > 0 || snap.recentLifts > 0

  if (!hasFitnessSignal) {
    return { enabled: false, weeklyTarget: 0, completedThisWeek: completed, label: 'Work out' }
  }

  const weeklyTarget = prefTarget ?? (workoutHabit ? 3 : 4)
  return {
    enabled: true,
    weeklyTarget,
    completedThisWeek: completed,
    label: workoutHabit?.title ?? 'Go to the gym',
    habitId: workoutHabit?.id,
  }
}

/** Behind the pace implied by day-of-week vs weekly target. */
export function isWorkoutBehind(plan: WorkoutPlan, now = new Date()): boolean {
  if (!plan.enabled || plan.weeklyTarget <= 0) return false
  if (plan.completedThisWeek >= plan.weeklyTarget) return false

  const day = now.getDay()
  const daysIntoWeek = day === 0 ? 7 : day
  const expectedByNow = Math.ceil((plan.weeklyTarget * daysIntoWeek) / 7)
  return plan.completedThisWeek < expectedByNow
}
