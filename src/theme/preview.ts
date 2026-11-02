import { applyThemeAttributes } from './apply'
import { renderContrastStyle, systemPrefersMoreContrast } from './contrast'
import { readThemePreferences } from './preferences'
import { resolveEffectiveTheme } from './resolve'
import { changesFor, nextScheduleChange } from './rotation'
import { nextSeasonChange } from './seasons'
import type { ThemeFamily } from './types'

let previewFamily: ThemeFamily | null = null
let rotationTimer = 0
const clockListeners = new Set<() => void>()

export function getPreviewFamily() {
  return previewFamily
}

/** Settings uses this to refresh the active period when the clock boundary passes. */
export function subscribeThemeClock(listener: () => void) {
  clockListeners.add(listener)
  return () => {
    clockListeners.delete(listener)
  }
}

/** setTimeout delays above this are clamped by browsers, so longer waits are re-armed. */
const MAX_ROTATION_DELAY = 24 * 60 * 60 * 1000

function scheduleRotationTick() {
  window.clearTimeout(rotationTimer)
  const prefs = readThemePreferences()
  if (previewFamily || (prefs.rotation !== 'time-of-day' && prefs.rotation !== 'seasonal')) return
  const now = new Date()
  const at =
    prefs.rotation === 'seasonal'
      ? nextSeasonChange(now).getTime()
      : nextScheduleChange(changesFor(prefs), now).getTime()
  const raw = at - Date.now()
  const delay = raw > MAX_ROTATION_DELAY ? MAX_ROTATION_DELAY : raw
  rotationTimer = window.setTimeout(() => paintEffectiveTheme(), delay > 0 ? delay : 1000)
}

/** Paints the preview family, or the resolved theme, without writing storage. */
export function paintEffectiveTheme() {
  const prefs = readThemePreferences()
  const systemDark = document.documentElement.classList.contains('dark')
  const systemMoreContrast = systemPrefersMoreContrast()
  const effective = resolveEffectiveTheme(prefs, systemDark, systemMoreContrast)
  applyThemeAttributes(previewFamily ? { ...effective, family: previewFamily } : effective)
  renderContrastStyle()
  scheduleRotationTick()
  for (const listener of clockListeners) listener()
}

/** Paints a family immediately. Null restores the saved family. Does not write storage. */
export function setPreviewFamily(family: ThemeFamily | null) {
  previewFamily = family
  paintEffectiveTheme()
}
