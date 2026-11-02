import {
  APPEARANCES,
  CONTRAST_PREFERENCES,
  DAY_PERIODS,
  DEFAULT_SEASON_ASSIGNMENTS,
  DEFAULT_THEME_PREFERENCES,
  DEFAULT_THEME_SCHEDULE,
  HEMISPHERES,
  ROTATION_MODES,
  SEASONS,
  THEME_FAMILIES,
  type Appearance,
  type ContrastPreference,
  type Hemisphere,
  type RotationMode,
  type ScheduleKind,
  type SeasonAssignments,
  type ThemeChange,
  type ThemeFamily,
  type ThemePreferences,
  type ThemeSchedule,
} from './types'

/** next-themes key. Existing light/dark/system choices live here. Do not rename. */
export const APPEARANCE_STORAGE_KEY = 'katana-personal-theme'

/**
 * Family, rotation, and contrast. Appearance stays in APPEARANCE_STORAGE_KEY
 * so the current toggle and stored values keep working.
 */
export const THEME_PREFS_STORAGE_KEY = 'katana-personal:theme'

type ExtraPrefs = {
  family: ThemeFamily
  rotation: RotationMode
  contrast: ContrastPreference
  schedule: ThemeSchedule
  scheduleKind: ScheduleKind
  customSchedule: ThemeChange[]
  hemisphere: Hemisphere
  seasons: SeasonAssignments
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

export function parseAppearance(value: unknown): Appearance {
  return oneOf(value, APPEARANCES, DEFAULT_THEME_PREFERENCES.appearance)
}

/**
 * A saved "standard" choice used to ignore an increased-contrast device.
 * Follow the device instead, so that preference is not suppressed.
 */
function parseContrast(value: unknown): ContrastPreference {
  if (value === 'standard') return 'system'
  return oneOf(value, CONTRAST_PREFERENCES, DEFAULT_THEME_PREFERENCES.contrast)
}

function parseCustomSchedule(value: unknown): ThemeChange[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  const changes: ThemeChange[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const minutes = record.minutes
    if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 0 || minutes > 1439) continue
    if (seen.has(minutes)) continue
    if (typeof record.theme !== 'string' || !(THEME_FAMILIES as readonly string[]).includes(record.theme)) continue
    seen.add(minutes)
    changes.push({ minutes, theme: record.theme as ThemeFamily })
  }
  return changes.sort((a, b) => a.minutes - b.minutes)
}

function parseSeasons(value: unknown): SeasonAssignments {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const seasons = { ...DEFAULT_SEASON_ASSIGNMENTS }
  for (const season of SEASONS) {
    seasons[season] = oneOf(record[season], THEME_FAMILIES, DEFAULT_SEASON_ASSIGNMENTS[season])
  }
  return seasons
}

function parseSchedule(value: unknown): ThemeSchedule {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const schedule = { ...DEFAULT_THEME_SCHEDULE }
  for (const period of DAY_PERIODS) {
    schedule[period] = oneOf(record[period], THEME_FAMILIES, DEFAULT_THEME_SCHEDULE[period])
  }
  return schedule
}

export function parseExtraPrefs(value: unknown): ExtraPrefs {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    family: oneOf(record.family, THEME_FAMILIES, DEFAULT_THEME_PREFERENCES.family),
    rotation: oneOf(record.rotation, ROTATION_MODES, DEFAULT_THEME_PREFERENCES.rotation),
    contrast: parseContrast(record.contrast),
    schedule: parseSchedule(record.schedule),
    scheduleKind: record.scheduleKind === 'custom' ? 'custom' : 'preset',
    customSchedule: parseCustomSchedule(record.customSchedule),
    hemisphere: oneOf(record.hemisphere, HEMISPHERES, DEFAULT_THEME_PREFERENCES.hemisphere),
    seasons: parseSeasons(record.seasons),
  }
}

export function parseThemePreferences(
  extraRaw: string | null,
  appearanceRaw: string | null,
): ThemePreferences {
  let extra: unknown = null
  if (extraRaw) {
    try {
      extra = JSON.parse(extraRaw) as unknown
    } catch {
      extra = null
    }
  }
  return {
    ...parseExtraPrefs(extra),
    appearance: parseAppearance(appearanceRaw),
  }
}

export function readThemePreferences(): ThemePreferences {
  try {
    return parseThemePreferences(
      localStorage.getItem(THEME_PREFS_STORAGE_KEY),
      localStorage.getItem(APPEARANCE_STORAGE_KEY),
    )
  } catch {
    return { ...DEFAULT_THEME_PREFERENCES }
  }
}

export type ThemePreferencePatch = Partial<Omit<ExtraPrefs, 'schedule' | 'seasons'>> & {
  schedule?: Partial<ThemeSchedule>
  seasons?: Partial<SeasonAssignments>
}

/** Saves theme choices. Does not touch the appearance key. A partial schedule keeps the other slots. */
export function writeThemePreferences(partial: ThemePreferencePatch) {
  const current = parseExtraPrefs(
    (() => {
      try {
        const raw = localStorage.getItem(THEME_PREFS_STORAGE_KEY)
        return raw ? (JSON.parse(raw) as unknown) : null
      } catch {
        return null
      }
    })(),
  )
  const next = parseExtraPrefs({
    ...current,
    ...partial,
    schedule: { ...current.schedule, ...partial.schedule },
    seasons: { ...current.seasons, ...partial.seasons },
  })
  localStorage.setItem(THEME_PREFS_STORAGE_KEY, JSON.stringify(next))
}
