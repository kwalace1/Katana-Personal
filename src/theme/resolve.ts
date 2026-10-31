import { activeChangePoint, changesFor, isUsableSchedule, periodAt } from './rotation'
import { seasonAt } from './seasons'
import type { EffectiveTheme, ThemePreferences } from './types'

/**
 * Resolves what the document should paint.
 * Unknown families fall back to Classic before this runs.
 * Time of day uses the daily schedule. Seasonal uses the local date and hemisphere.
 * Either mode leaves the saved manual theme in place.
 * High contrast applies when chosen, or when System matches an increased-contrast device.
 */
export function resolveEffectiveTheme(
  prefs: ThemePreferences,
  systemDark: boolean,
  systemMoreContrast = false,
  now: Date = new Date(),
): EffectiveTheme {
  const appearance =
    prefs.appearance === 'system' ? (systemDark ? 'dark' : 'light') : prefs.appearance
  const contrast =
    prefs.contrast === 'high' || (prefs.contrast === 'system' && systemMoreContrast)
      ? 'high'
      : 'standard'
  const timeOfDay = prefs.rotation === 'time-of-day'
  const seasonal = prefs.rotation === 'seasonal'
  const usingCustom =
    timeOfDay && prefs.scheduleKind === 'custom' && isUsableSchedule(prefs.customSchedule)
  const point = timeOfDay ? activeChangePoint(changesFor(prefs), now) : null
  const period = timeOfDay && !usingCustom ? periodAt(now) : null
  const season = seasonal ? seasonAt(now, prefs.hemisphere) : null
  const family = point?.theme ?? (season ? prefs.seasons[season] : prefs.family)
  return {
    family,
    manualFamily: prefs.family,
    appearance,
    appearancePreference: prefs.appearance,
    rotation: timeOfDay ? 'time-of-day' : seasonal ? 'seasonal' : 'off',
    rotationPreference: prefs.rotation,
    period,
    season,
    contrast,
    contrastPreference: prefs.contrast,
  }
}
