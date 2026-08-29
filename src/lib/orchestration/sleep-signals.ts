import { todayKey } from '@/lib/dates'
import { healthApi } from '@/modules/health/api'

export const SHORT_SLEEP_HOURS = 6
export const VERY_SHORT_SLEEP_HOURS = 5.5

export interface SleepSignals {
  lastNightHours: number
  shortSleep: boolean
  veryShortSleep: boolean
  /** Rolling 3-night average */
  avg3Night: number
}

export function readSleepSignals(userId: string, now = new Date()): SleepSignals {
  const logs = healthApi.listSleep(userId)
  const today = todayKey(now)
  const lastNight =
    logs.find((s) => s.date === today)?.hours ??
    logs.find((s) => s.date < today)?.hours ??
    0

  const recent = logs.slice(0, 3)
  const avg3Night =
    recent.length > 0 ? recent.reduce((sum, s) => sum + s.hours, 0) / recent.length : lastNight

  return {
    lastNightHours: lastNight,
    shortSleep: lastNight > 0 && lastNight < SHORT_SLEEP_HOURS,
    veryShortSleep: lastNight > 0 && lastNight < VERY_SHORT_SLEEP_HOURS,
    avg3Night,
  }
}

export function recoveryReason(signals: SleepSignals): string {
  if (signals.veryShortSleep) {
    return `Last sleep was ${signals.lastNightHours}h — protect recovery before pushing intensity.`
  }
  if (signals.shortSleep) {
    return `Last sleep was ${signals.lastNightHours}h — lighter day keeps the week honest.`
  }
  if (signals.avg3Night > 0 && signals.avg3Night < SHORT_SLEEP_HOURS) {
    return `Three-night average is ${signals.avg3Night.toFixed(1)}h — ease up before adding more.`
  }
  return 'Recovery first — your sleep data says go easy today.'
}
