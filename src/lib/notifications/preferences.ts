/** Notification & quiet-hours preferences stored on profile.preferences */

export type QuietHours = {
  enabled: boolean
  /** 0–23 local hour when quiet period starts (inclusive) */
  start: number
  /** 0–23 local hour when quiet period ends (exclusive) */
  end: number
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: true,
  start: 22,
  end: 7,
}

export function parseQuietHours(preferences?: Record<string, unknown> | null): QuietHours {
  const raw = preferences?.quiet_hours
  if (!raw || typeof raw !== 'object') return DEFAULT_QUIET_HOURS
  const q = raw as Record<string, unknown>
  return {
    enabled: q.enabled !== false,
    start: clampHour(q.start, DEFAULT_QUIET_HOURS.start),
    end: clampHour(q.end, DEFAULT_QUIET_HOURS.end),
  }
}

function clampHour(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(23, Math.max(0, Math.floor(n)))
}

export function remindersEnabled(preferences?: Record<string, unknown> | null): boolean {
  return preferences?.gentle_reminders === true
}

/** Proactive orchestration nudges (workout windows, focus pings). Plus feature. */
export function orchestrationPushEnabled(preferences?: Record<string, unknown> | null): boolean {
  return preferences?.orchestration_push === true
}

export function dayClosedToday(preferences?: Record<string, unknown> | null, now = new Date()): boolean {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return preferences?.day_closed_on === key
}

/** True when local time is inside quiet hours (supports overnight ranges). */
export function isQuietHour(now: Date, quiet: QuietHours = DEFAULT_QUIET_HOURS): boolean {
  if (!quiet.enabled) return false
  const hour = now.getHours()
  if (quiet.start === quiet.end) return false
  if (quiet.start < quiet.end) return hour >= quiet.start && hour < quiet.end
  return hour >= quiet.start || hour < quiet.end
}

export function canNotifyNow(preferences?: Record<string, unknown> | null, now = new Date()): boolean {
  if (dayClosedToday(preferences, now)) return false
  if (isQuietHour(now, parseQuietHours(preferences))) return false
  return true
}
