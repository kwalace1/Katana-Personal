import { CALENDAR_ITEM_COLORS, type CalendarItemType } from '@/theme/functional'

/** Device cache. Account copy lives on profile.preferences under CALENDAR_COLOR_PREF_KEY. */
export const CALENDAR_COLOR_STORAGE_KEY = 'katana-personal:calendar-colors'
export const CALENDAR_COLOR_PREF_KEY = 'calendar_item_colors'

export const CALENDAR_ITEM_TYPES = ['event', 'task', 'goal', 'habit'] as const

export type CalendarItemColors = Record<CalendarItemType, string>

/** Curated choices. The first four are the original defaults. */
export const CALENDAR_COLOR_SWATCHES = [
  '#3673CC',
  '#D48929',
  '#25875F',
  '#8956CF',
  '#0E7490',
  '#BE123C',
  '#4F46E5',
  '#57534E',
] as const

const HEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

export function defaultCalendarItemColors(): CalendarItemColors {
  return { ...CALENDAR_ITEM_COLORS }
}

/** Accept #RGB and #RRGGBB. Anything else is rejected. */
export function normalizeCalendarHex(value: string): string | null {
  const match = HEX.exec(value.trim())
  if (!match) return null
  let hex = match[1] ?? ''
  if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('')
  return `#${hex.toUpperCase()}`
}

export function parseCalendarItemColors(value: unknown): CalendarItemColors {
  const colors = defaultCalendarItemColors()
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  for (const kind of CALENDAR_ITEM_TYPES) {
    if (typeof record[kind] !== 'string') continue
    const hex = normalizeCalendarHex(record[kind])
    if (hex) colors[kind] = hex
  }
  return colors
}

function storedOverrides(colors: CalendarItemColors): Partial<CalendarItemColors> | null {
  const overrides: Partial<CalendarItemColors> = {}
  for (const kind of CALENDAR_ITEM_TYPES) {
    const hex = normalizeCalendarHex(colors[kind]) ?? CALENDAR_ITEM_COLORS[kind]
    if (hex.toUpperCase() !== CALENDAR_ITEM_COLORS[kind].toUpperCase()) overrides[kind] = hex
  }
  return Object.keys(overrides).length > 0 ? overrides : null
}

export function readStoredCalendarItemColors(): CalendarItemColors {
  try {
    const raw = localStorage.getItem(CALENDAR_COLOR_STORAGE_KEY)
    if (!raw) return defaultCalendarItemColors()
    return parseCalendarItemColors(JSON.parse(raw) as unknown)
  } catch {
    return defaultCalendarItemColors()
  }
}

/**
 * Profile preferences win when the account has a saved value.
 * A missing value keeps the device cache, then the original defaults.
 */
export function resolveCalendarItemColors(prefs?: Record<string, unknown> | null): CalendarItemColors {
  if (prefs && Object.prototype.hasOwnProperty.call(prefs, CALENDAR_COLOR_PREF_KEY)) {
    const saved = prefs[CALENDAR_COLOR_PREF_KEY]
    if (saved && typeof saved === 'object') return parseCalendarItemColors(saved)
  }
  return readStoredCalendarItemColors()
}

/** Writes the device cache and returns the account patch. Null means “use defaults”. */
export function calendarColorPreferencePatch(colors: CalendarItemColors): Record<string, unknown> {
  const overrides = storedOverrides(colors)
  try {
    if (!overrides) localStorage.removeItem(CALENDAR_COLOR_STORAGE_KEY)
    else localStorage.setItem(CALENDAR_COLOR_STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // ignore quota / private mode
  }
  return { [CALENDAR_COLOR_PREF_KEY]: overrides }
}

let activeColors: CalendarItemColors = defaultCalendarItemColors()

export function currentCalendarItemColors(): CalendarItemColors {
  return activeColors
}

export function runWithCalendarItemColors<T>(colors: CalendarItemColors, run: () => T): T {
  const previous = activeColors
  activeColors = colors
  try {
    return run()
  } finally {
    activeColors = previous
  }
}
