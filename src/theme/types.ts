/** Decorative theme families. */
export const THEME_FAMILIES = [
  'classic',
  'sunrise',
  'sunset',
  'ocean',
  'forest',
  'spring',
  'summer',
  'autumn',
  'winter',
] as const
export type ThemeFamily = (typeof THEME_FAMILIES)[number]

/** Light, dark, or follow the operating system. Owned by next-themes. */
export const APPEARANCES = ['system', 'light', 'dark'] as const
export type Appearance = (typeof APPEARANCES)[number]

/**
 * Off keeps the saved theme. Time of day uses the daily schedule.
 * Seasonal uses the local meteorological season. Only one mode is applied.
 */
export const ROTATION_MODES = ['off', 'time-of-day', 'seasonal'] as const
export type RotationMode = (typeof ROTATION_MODES)[number]

/** Meteorological seasons. The same four months map differently by hemisphere. */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
export type Season = (typeof SEASONS)[number]

/** Saved calendar. Northern is the default. Location is never inferred. */
export const HEMISPHERES = ['northern', 'southern'] as const
export type Hemisphere = (typeof HEMISPHERES)[number]

export type SeasonAssignments = Record<Season, ThemeFamily>

/** Each season uses the theme family of the same name. */
export const DEFAULT_SEASON_ASSIGNMENTS: SeasonAssignments = {
  spring: 'spring',
  summer: 'summer',
  autumn: 'autumn',
  winter: 'winter',
}

/** Fixed local-time periods. Night wraps across midnight. */
export const DAY_PERIODS = ['morning', 'day', 'evening', 'night'] as const
export type DayPeriod = (typeof DAY_PERIODS)[number]

export type ThemeSchedule = Record<DayPeriod, ThemeFamily>

/** Morning Sunrise, daytime Ocean, evening Sunset, night Forest. */
export const DEFAULT_THEME_SCHEDULE: ThemeSchedule = {
  morning: 'sunrise',
  day: 'ocean',
  evening: 'sunset',
  night: 'forest',
}

/** Preset keeps the four fixed periods. Custom uses the user's change times. */
export const SCHEDULE_KINDS = ['preset', 'custom'] as const
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number]

/** A theme that starts at a local minute-of-day and lasts until the next change. */
export type ThemeChange = {
  minutes: number
  theme: ThemeFamily
}

/**
 * System follows the device increased-contrast setting. High turns enhanced
 * contrast on for every theme. A missing value follows the device so an OS
 * preference is never turned off. There is no saved choice that suppresses it.
 */
export const CONTRAST_PREFERENCES = ['system', 'high'] as const
export type ContrastPreference = (typeof CONTRAST_PREFERENCES)[number]

export type ThemePreferences = {
  /** Saved manual theme. Rotation does not overwrite this. */
  family: ThemeFamily
  appearance: Appearance
  rotation: RotationMode
  contrast: ContrastPreference
  /** Four-period assignments. Kept even while a custom schedule is active. */
  schedule: ThemeSchedule
  /** Which Time of Day list is active. Preset is the default for existing users. */
  scheduleKind: ScheduleKind
  /** Custom change times. Kept even while Preset is active. */
  customSchedule: ThemeChange[]
  /** Which meteorological calendar to use. Kept even while Seasonal is off. */
  hemisphere: Hemisphere
  /** Theme for each season. Kept even while another rotation mode is active. */
  seasons: SeasonAssignments
}

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  family: 'classic',
  appearance: 'system',
  rotation: 'off',
  contrast: 'system',
  schedule: DEFAULT_THEME_SCHEDULE,
  scheduleKind: 'preset',
  customSchedule: [],
  hemisphere: 'northern',
  seasons: DEFAULT_SEASON_ASSIGNMENTS,
}

/** What the document actually paints. */
export type EffectiveTheme = {
  family: ThemeFamily
  /** Manual theme, kept even while rotation is painting another family. */
  manualFamily: ThemeFamily
  appearance: 'light' | 'dark'
  appearancePreference: Appearance
  rotation: RotationMode
  rotationPreference: RotationMode
  /** Set only while time of day is the applied mode. */
  period: DayPeriod | null
  /** Set only while seasonal rotation is the applied mode. */
  season: Season | null
  contrast: 'standard' | 'high'
  contrastPreference: ContrastPreference
}
