import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { accentTokens } from '@/lib/accent'
import { contrastRatio, highContrastPalette, parseHsl, renderContrastStyle } from './contrast'
import { CLASSIC_DARK, CLASSIC_LIGHT } from './classic'
import { CALENDAR_ITEM_COLORS } from './functional'
import {
  APPEARANCE_STORAGE_KEY,
  parseThemePreferences,
  readThemePreferences,
  THEME_PREFS_STORAGE_KEY,
  writeThemePreferences,
} from './preferences'
import { resolveEffectiveTheme } from './resolve'
import { nextSeasonChange, seasonAt } from './seasons'
import { FAMILY_PALETTES, themePalette, themeSwatch } from './families'
import { activeChangePoint, nextPeriodChange, nextScheduleChange, periodAt, schedulesMatch, suggestChangeMinutes, validateCustomSchedule } from './rotation'
import { DEFAULT_SEASON_ASSIGNMENTS, DEFAULT_THEME_PREFERENCES, DEFAULT_THEME_SCHEDULE, THEME_FAMILIES } from './types'

const themeDir = dirname(fileURLToPath(import.meta.url))
const css =
  readFileSync(join(themeDir, '../index.css'), 'utf8') +
  readFileSync(join(themeDir, 'families.css'), 'utf8')

describe('classic palette', () => {
  it('matches the Classic Light and Classic Dark values painted in CSS', () => {
    for (const palette of [CLASSIC_LIGHT, CLASSIC_DARK]) {
      for (const [name, value] of Object.entries(palette)) {
        expect(css).toContain(`${name}: ${value};`)
      }
    }
  })
})

describe('calendar type colors', () => {
  it('keeps the fixed item-type colors', () => {
    expect(CALENDAR_ITEM_COLORS).toEqual({
      event: '#3673CC',
      task: '#D48929',
      goal: '#25875F',
      habit: '#8956CF',
    })
  })
})

describe('theme preferences', () => {
  beforeEach(() => {
    localStorage.removeItem(APPEARANCE_STORAGE_KEY)
    localStorage.removeItem(THEME_PREFS_STORAGE_KEY)
  })

  it('keeps an existing light or dark choice and defaults the new fields', () => {
    expect(parseThemePreferences(null, 'dark')).toEqual({
      ...DEFAULT_THEME_PREFERENCES,
      appearance: 'dark',
    })
    expect(parseThemePreferences(null, 'light').appearance).toBe('light')
    expect(parseThemePreferences(null, null).appearance).toBe('system')
  })

  it('falls back when stored values are missing or invalid', () => {
    expect(parseThemePreferences('not-json', 'sepia')).toEqual(DEFAULT_THEME_PREFERENCES)
    expect(
      parseThemePreferences(
        JSON.stringify({ family: 'aurora', rotation: 'hourly', contrast: 'max' }),
        'system',
      ),
    ).toEqual(DEFAULT_THEME_PREFERENCES)
    expect(parseThemePreferences(JSON.stringify({ contrast: 'standard' }), 'light').contrast).toBe('system')
  })

    it('reads and writes family, rotation, and contrast without touching appearance', () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'dark')
    writeThemePreferences({ rotation: 'seasonal', contrast: 'high' })
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark')
    expect(readThemePreferences()).toEqual({
      ...DEFAULT_THEME_PREFERENCES,
      appearance: 'dark',
      rotation: 'seasonal',
      contrast: 'high',
    })
    writeThemePreferences({ rotation: 'time-of-day', family: 'ocean' })
    expect(readThemePreferences().contrast).toBe('high')
    expect(readThemePreferences().family).toBe('ocean')
  })
})

describe('effective theme', () => {
  it('follows system, light, and dark, and applies seasonal rotation on its own', () => {
    expect(
      resolveEffectiveTheme(
        { ...DEFAULT_THEME_PREFERENCES, family: 'classic', appearance: 'system', rotation: 'off', contrast: 'high' },
        true,
      ),
    ).toMatchObject({
      family: 'classic',
      manualFamily: 'classic',
      appearance: 'dark',
      rotation: 'off',
      contrast: 'high',
      contrastPreference: 'high',
    })
    expect(
      resolveEffectiveTheme(
        { ...DEFAULT_THEME_PREFERENCES, family: 'classic', appearance: 'light', rotation: 'seasonal', contrast: 'system' },
        true,
        false,
        new Date(2026, 9, 27),
      ),
    ).toMatchObject({
      appearance: 'light',
      contrast: 'standard',
      contrastPreference: 'system',
      rotation: 'seasonal',
      family: 'autumn',
      manualFamily: 'classic',
      season: 'autumn',
      period: null,
    })
    expect(
      resolveEffectiveTheme(
        { ...DEFAULT_THEME_PREFERENCES, family: 'classic', appearance: 'light', rotation: 'seasonal', contrast: 'system' },
        true,
        true,
      ).contrast,
    ).toBe('high')
    expect(
      resolveEffectiveTheme(
        { ...DEFAULT_THEME_PREFERENCES, family: 'sunrise', appearance: 'dark', rotation: 'off', contrast: 'system' },
        false,
      ),
    ).toMatchObject({ family: 'sunrise', appearance: 'dark', rotation: 'off', contrast: 'standard' })
    expect(
      resolveEffectiveTheme(
        { ...DEFAULT_THEME_PREFERENCES, family: 'winter', appearance: 'system', rotation: 'seasonal', contrast: 'high' },
        false,
        false,
        new Date(2026, 2, 1),
      ),
    ).toMatchObject({
      family: 'spring',
      manualFamily: 'winter',
      appearance: 'light',
      rotation: 'seasonal',
      contrast: 'high',
      season: 'spring',
    })
    expect(
      resolveEffectiveTheme(
        { ...DEFAULT_THEME_PREFERENCES, contrast: 'high', rotation: 'time-of-day' },
        false,
        false,
        new Date(2026, 5, 15, 8, 15),
      ),
    ).toMatchObject({ family: 'sunrise', contrast: 'high', contrastPreference: 'high' })
    expect(
      resolveEffectiveTheme(
        { ...DEFAULT_THEME_PREFERENCES, contrast: 'high', rotation: 'seasonal', appearance: 'dark' },
        true,
        false,
        new Date(2026, 5, 1),
      ),
    ).toMatchObject({ family: 'summer', appearance: 'dark', contrast: 'high' })
    expect(
      resolveEffectiveTheme(
        { ...DEFAULT_THEME_PREFERENCES, contrast: 'system', rotation: 'off' },
        false,
        true,
      ).contrast,
    ).toBe('high')
  })
})

describe('time of day', () => {
  const at = (hour: number, minute: number) => new Date(2026, 5, 15, hour, minute, 30)

  it('assigns each local period, including midnight', () => {
    expect(periodAt(at(4, 59))).toBe('night')
    expect(periodAt(at(5, 0))).toBe('morning')
    expect(periodAt(at(10, 59))).toBe('morning')
    expect(periodAt(at(11, 0))).toBe('day')
    expect(periodAt(at(16, 59))).toBe('day')
    expect(periodAt(at(17, 0))).toBe('evening')
    expect(periodAt(at(20, 59))).toBe('evening')
    expect(periodAt(at(21, 0))).toBe('night')
    expect(periodAt(at(0, 0))).toBe('night')
    expect(periodAt(at(23, 59))).toBe('night')
  })

  it('points the next change at a later boundary', () => {
    expect(nextPeriodChange(at(10, 59)).getHours()).toBe(11)
    expect(nextPeriodChange(at(11, 0)).getHours()).toBe(17)
    const afterNight = nextPeriodChange(at(21, 30))
    expect(afterNight.getHours()).toBe(5)
    expect(afterNight.getDate()).toBe(16)
    const exact = new Date(2026, 5, 15, 11, 0, 0, 0)
    const afterExact = nextPeriodChange(exact)
    expect(afterExact.getTime()).toBeGreaterThan(exact.getTime())
    expect(afterExact.getHours()).toBe(17)
    expect(afterExact.getMinutes()).toBe(0)
    const midnight = new Date(2026, 5, 16, 0, 0, 0, 0)
    const afterMidnight = nextPeriodChange(midnight)
    expect(afterMidnight.getHours()).toBe(5)
    expect(afterMidnight.getDate()).toBe(16)
  })

  it('follows a daylight-saving gap when this timezone has one', () => {
    let gap: Date | null = null
    for (let month = 0; month < 12 && !gap; month++) {
      for (let day = 1; day <= 28; day++) {
        const before = new Date(2026, month, day, 1, 30, 0, 0)
        const later = new Date(before.getTime() + 60 * 60 * 1000)
        if (later.getHours() === (before.getHours() + 2) % 24) {
          gap = before
          break
        }
      }
    }
    if (!gap) return
    const changes = [
      { minutes: 60, theme: 'sunrise' as const },
      { minutes: 150, theme: 'ocean' as const },
      { minutes: 18 * 60, theme: 'forest' as const },
    ]
    const next = nextScheduleChange(changes, gap)
    expect(next.getTime()).toBeGreaterThan(gap.getTime())
    expect(activeChangePoint(changes, next)?.theme).toBe('ocean')
    expect(next.getTime() - gap.getTime()).toBeLessThan(3 * 60 * 60 * 1000)
  })

  it('uses the schedule while time of day is on and keeps the manual theme when off', () => {
    const prefs = {
      ...DEFAULT_THEME_PREFERENCES,
      family: 'classic' as const,
      rotation: 'time-of-day' as const,
      schedule: { ...DEFAULT_THEME_SCHEDULE, morning: 'spring' as const },
    }
    expect(resolveEffectiveTheme(prefs, false, false, at(8, 15))).toMatchObject({
      family: 'spring',
      manualFamily: 'classic',
      rotation: 'time-of-day',
      period: 'morning',
      appearance: 'light',
    })
    expect(resolveEffectiveTheme(prefs, false, false, at(0, 30))).toMatchObject({
      family: 'forest',
      period: 'night',
    })
    expect(resolveEffectiveTheme({ ...prefs, rotation: 'off' }, true, false, at(8, 15))).toMatchObject({
      family: 'classic',
      manualFamily: 'classic',
      rotation: 'off',
      period: null,
      appearance: 'dark',
    })
  })

  it('keeps a saved theme when the schedule is missing or a slot is invalid', () => {
    expect(parseThemePreferences(JSON.stringify({ family: 'forest', rotation: 'off' }), 'light')).toMatchObject({
      family: 'forest',
      rotation: 'off',
      schedule: DEFAULT_THEME_SCHEDULE,
    })
    expect(
      parseThemePreferences(
        JSON.stringify({ family: 'classic', schedule: { morning: 'nope', day: 'summer' } }),
        'dark',
      ).schedule,
    ).toEqual({ ...DEFAULT_THEME_SCHEDULE, day: 'summer' })
  })

  it('keeps a custom list overnight and leaves the preset schedule in place', () => {
    const custom = [
      { minutes: 6 * 60 + 30, theme: 'sunrise' as const },
      { minutes: 10 * 60, theme: 'ocean' as const },
      { minutes: 14 * 60 + 30, theme: 'spring' as const },
      { minutes: 18 * 60, theme: 'sunset' as const },
      { minutes: 22 * 60 + 30, theme: 'forest' as const },
    ]
    const prefs = {
      ...DEFAULT_THEME_PREFERENCES,
      family: 'classic' as const,
      rotation: 'time-of-day' as const,
      scheduleKind: 'custom' as const,
      schedule: { ...DEFAULT_THEME_SCHEDULE, morning: 'winter' as const },
      customSchedule: custom,
    }
    expect(resolveEffectiveTheme(prefs, false, false, at(6, 30)).family).toBe('sunrise')
    expect(resolveEffectiveTheme(prefs, false, false, at(6, 29)).family).toBe('forest')
    expect(resolveEffectiveTheme(prefs, false, false, at(0, 0)).family).toBe('forest')
    expect(resolveEffectiveTheme(prefs, false, false, at(23, 59)).family).toBe('forest')
    expect(resolveEffectiveTheme(prefs, false, false, at(14, 30)).family).toBe('spring')
    expect(resolveEffectiveTheme(prefs, false, false, at(10, 0)).family).toBe('ocean')
    expect(resolveEffectiveTheme({ ...prefs, scheduleKind: 'preset' }, false, false, at(8, 0))).toMatchObject({
      family: 'winter',
      period: 'morning',
    })
    expect(activeChangePoint(custom, at(22, 30))?.theme).toBe('forest')
    const afterLast = nextScheduleChange(custom, at(22, 30))
    expect(afterLast.getDate()).toBe(16)
    expect(afterLast.getHours()).toBe(6)
    expect(afterLast.getMinutes()).toBe(30)
  })

  it('rejects duplicate times and keeps a short custom list from replacing the preset', () => {
    expect(validateCustomSchedule([
      { minutes: 8 * 60, theme: 'ocean' },
      { minutes: 8 * 60, theme: 'sunset' },
    ])).toEqual({ ok: false, message: 'Two changes use the same time.' })
    expect(validateCustomSchedule([{ minutes: 8 * 60, theme: 'ocean' }])).toEqual({
      ok: false,
      message: 'Add at least two theme changes.',
    })
    expect(suggestChangeMinutes([5 * 60, 11 * 60, 17 * 60, 21 * 60])).toBe(22 * 60)
    expect(suggestChangeMinutes([5 * 60, 23 * 60])).toBe(23 * 60 + 30)
    expect(schedulesMatch(
      [
        { minutes: 21 * 60, theme: 'forest' },
        { minutes: 5 * 60, theme: 'sunrise' },
      ],
      [
        { minutes: 5 * 60, theme: 'sunrise' },
        { minutes: 21 * 60, theme: 'forest' },
      ],
    )).toBe(true)
    expect(schedulesMatch([{ minutes: 5 * 60, theme: 'sunrise' }], [{ minutes: 5 * 60, theme: 'ocean' }])).toBe(false)
    const parsed = parseThemePreferences(
      JSON.stringify({
        family: 'forest',
        schedule: { morning: 'spring' },
        scheduleKind: 'custom',
        customSchedule: [{ minutes: 90, theme: 'ocean' }, { minutes: 90, theme: 'sunset' }, { theme: 'forest' }],
      }),
      'light',
    )
    expect(parsed.family).toBe('forest')
    expect(parsed.schedule.morning).toBe('spring')
    expect(parsed.customSchedule).toEqual([{ minutes: 90, theme: 'ocean' }])
    expect(
      resolveEffectiveTheme({ ...parsed, rotation: 'time-of-day' }, false, false, at(8, 0)).family,
    ).toBe('spring')
  })
})

describe('seasonal preferences', () => {
  beforeEach(() => {
    localStorage.removeItem(APPEARANCE_STORAGE_KEY)
    localStorage.removeItem(THEME_PREFS_STORAGE_KEY)
  })

  it('accepts a seasonal family without changing appearance', () => {
    expect(parseThemePreferences(JSON.stringify({ family: 'spring' }), 'light')).toMatchObject({
      family: 'spring',
      appearance: 'light',
      rotation: 'off',
      contrast: 'system',
    })
  })

  it('uses meteorological boundaries, leap day, and the opposite southern calendar', () => {
    const on = (year: number, month: number, day: number) => new Date(year, month, day, 12)
    expect(seasonAt(on(2026, 1, 28), 'northern')).toBe('winter')
    expect(seasonAt(on(2024, 1, 29), 'northern')).toBe('winter')
    expect(seasonAt(on(2026, 2, 1), 'northern')).toBe('spring')
    expect(seasonAt(on(2026, 4, 31), 'northern')).toBe('spring')
    expect(seasonAt(on(2026, 5, 1), 'northern')).toBe('summer')
    expect(seasonAt(on(2026, 7, 31), 'northern')).toBe('summer')
    expect(seasonAt(on(2026, 8, 1), 'northern')).toBe('autumn')
    expect(seasonAt(on(2026, 10, 30), 'northern')).toBe('autumn')
    expect(seasonAt(on(2026, 11, 1), 'northern')).toBe('winter')
    expect(seasonAt(on(2027, 0, 1), 'northern')).toBe('winter')
    expect(seasonAt(on(2026, 2, 1), 'southern')).toBe('autumn')
    expect(seasonAt(on(2026, 5, 1), 'southern')).toBe('winter')
    expect(seasonAt(on(2026, 8, 1), 'southern')).toBe('spring')
    expect(seasonAt(on(2026, 11, 1), 'southern')).toBe('summer')
    expect(seasonAt(on(2024, 1, 29), 'southern')).toBe('summer')

    const afterFebruary = nextSeasonChange(new Date(2024, 1, 29, 15))
    expect(afterFebruary.getFullYear()).toBe(2024)
    expect(afterFebruary.getMonth()).toBe(2)
    expect(afterFebruary.getDate()).toBe(1)
    const afterDecember = nextSeasonChange(new Date(2026, 11, 1, 0, 0, 0, 0))
    expect(afterDecember.getFullYear()).toBe(2027)
    expect(afterDecember.getMonth()).toBe(2)
    expect(afterDecember.getDate()).toBe(1)
  })

  it('keeps manual, daily, and seasonal preferences while only one mode is applied', () => {
    const custom = [
      { minutes: 6 * 60 + 30, theme: 'sunrise' as const },
      { minutes: 22 * 60, theme: 'forest' as const },
    ]
    const prefs = {
      ...DEFAULT_THEME_PREFERENCES,
      family: 'classic' as const,
      rotation: 'seasonal' as const,
      hemisphere: 'southern' as const,
      seasons: { ...DEFAULT_SEASON_ASSIGNMENTS, winter: 'ocean' as const },
      schedule: { ...DEFAULT_THEME_SCHEDULE, morning: 'winter' as const },
      scheduleKind: 'custom' as const,
      customSchedule: custom,
    }
    expect(resolveEffectiveTheme(prefs, false, false, new Date(2026, 5, 1, 8))).toMatchObject({
      family: 'ocean',
      manualFamily: 'classic',
      rotation: 'seasonal',
      season: 'winter',
      period: null,
      appearance: 'light',
    })
    expect(resolveEffectiveTheme({ ...prefs, hemisphere: 'northern' }, true, false, new Date(2026, 5, 1, 20))).toMatchObject({
      family: 'summer',
      appearance: 'dark',
      season: 'summer',
    })
    expect(resolveEffectiveTheme({ ...prefs, rotation: 'time-of-day' }, false, false, new Date(2026, 5, 1, 23))).toMatchObject({
      family: 'forest',
      rotation: 'time-of-day',
      season: null,
    })
    expect(resolveEffectiveTheme({ ...prefs, rotation: 'off' }, false, false, new Date(2026, 5, 1))).toMatchObject({
      family: 'classic',
      rotation: 'off',
      season: null,
      period: null,
    })

    writeThemePreferences({
      rotation: 'time-of-day',
      scheduleKind: 'custom',
      customSchedule: custom,
      seasons: prefs.seasons,
      hemisphere: 'southern',
    })
    writeThemePreferences({ rotation: 'seasonal' })
    const stored = readThemePreferences()
    expect(stored.rotation).toBe('seasonal')
    expect(stored.customSchedule).toEqual(custom)
    expect(stored.hemisphere).toBe('southern')
    expect(stored.seasons.winter).toBe('ocean')
    writeThemePreferences({ seasons: DEFAULT_SEASON_ASSIGNMENTS })
    expect(readThemePreferences().seasons).toEqual(DEFAULT_SEASON_ASSIGNMENTS)
    expect(readThemePreferences().hemisphere).toBe('southern')
    expect(readThemePreferences().customSchedule).toEqual(custom)
    expect(readThemePreferences().family).toBe('classic')
  })

  it('keeps the other season and period assignments when one slot is saved', () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'light')
    writeThemePreferences({
      family: 'classic',
      rotation: 'seasonal',
      hemisphere: 'southern',
      seasons: { winter: 'ocean' },
      schedule: { morning: 'winter' },
      scheduleKind: 'custom',
      customSchedule: [
        { minutes: 6 * 60, theme: 'sunrise' },
        { minutes: 21 * 60, theme: 'forest' },
      ],
    })
    writeThemePreferences({ rotation: 'time-of-day' })
    writeThemePreferences({ rotation: 'off' })
    const stored = readThemePreferences()
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('light')
    expect(stored.family).toBe('classic')
    expect(stored.rotation).toBe('off')
    expect(stored.hemisphere).toBe('southern')
    expect(stored.seasons).toEqual({ ...DEFAULT_SEASON_ASSIGNMENTS, winter: 'ocean' })
    expect(stored.schedule.morning).toBe('winter')
    expect(stored.schedule.day).toBe('ocean')
    expect(stored.customSchedule).toHaveLength(2)
    expect(stored.scheduleKind).toBe('custom')
  })

  it('falls back when a stored season assignment is missing', () => {
    expect(
      parseThemePreferences(
        JSON.stringify({ seasons: { spring: 'forest', summer: 'nope' }, hemisphere: 'southern' }),
        'light',
      ),
    ).toMatchObject({
      hemisphere: 'southern',
      seasons: { ...DEFAULT_SEASON_ASSIGNMENTS, spring: 'forest' },
      rotation: 'off',
    })
  })
})

describe('theme swatches', () => {
  it('uses the dark palette when the effective appearance is dark', () => {
    expect(themeSwatch('autumn', 'dark')['--background']).toBe(FAMILY_PALETTES.autumn.dark['--background'])
    expect(themeSwatch('autumn', 'light')['--background']).toBe(FAMILY_PALETTES.autumn.light['--background'])
    expect(themeSwatch('classic', 'dark')['--background']).toBe(CLASSIC_DARK['--background'])
  })
})

describe('theme family palettes', () => {
  it('paints every family token from the shared palette records', () => {
    for (const pair of Object.values(FAMILY_PALETTES)) {
      for (const palette of [pair.light, pair.dark]) {
        for (const [name, value] of Object.entries(palette)) {
          expect(css).toContain(`${name}: ${value};`)
        }
      }
    }
  })

  it('keeps text and accent contrast readable in light and dark', () => {
    const pairs: [string, string, number][] = [
      ['--foreground', '--background', 4.5],
      ['--foreground', '--card', 4.5],
      ['--primary-foreground', '--primary', 4.5],
      ['--muted-foreground', '--background', 4.5],
      ['--muted-foreground', '--muted', 4.5],
      ['--secondary-foreground', '--secondary', 4.5],
      ['--accent-foreground', '--accent', 4.5],
      ['--primary', '--background', 3],
      ['--muted-foreground', '--card', 4.5],
    ]
    for (const palette of [CLASSIC_LIGHT, CLASSIC_DARK]) {
      for (const [fg, bg, min] of pairs) {
        expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(min)
      }
    }
    for (const pair of Object.values(FAMILY_PALETTES)) {
      for (const palette of [pair.light, pair.dark]) {
        for (const [fg, bg, min] of pairs) {
          expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(min)
        }
      }
    }
  })
})

describe('high contrast', () => {
  const textPairs = [
    ['--foreground', '--background'],
    ['--foreground', '--card'],
    ['--muted-foreground', '--background'],
    ['--muted-foreground', '--card'],
    ['--muted-foreground', '--muted'],
    ['--secondary-foreground', '--secondary'],
    ['--primary-foreground', '--primary'],
    ['--accent-foreground', '--accent'],
  ] as const

  it('keeps each theme recognizable while clearing enhanced text and boundary contrast', () => {
    for (const family of THEME_FAMILIES) {
      for (const appearance of ['light', 'dark'] as const) {
        const palette = themePalette(family, appearance)
        const tuned = highContrastPalette(palette, appearance)
        expect(tuned['--background']).toBe(palette['--background'])
        expect(tuned['--card']).toBe(palette['--card'])
        expect(tuned['--accent']).toBe(palette['--accent'])
        expect(tuned['--primary-foreground']).toBe(palette['--primary-foreground'])
        const primary = parseHsl(tuned['--primary'])
        const sourcePrimary = parseHsl(palette['--primary'])
        expect(primary?.h).toBe(sourcePrimary?.h)
        expect(primary?.s).toBe(sourcePrimary?.s)
        for (const [fg, bg] of textPairs) {
          expect(contrastRatio(tuned[fg], tuned[bg])).toBeGreaterThanOrEqual(7)
        }
        expect(contrastRatio(tuned['--border'], tuned['--background'])).toBeGreaterThanOrEqual(3)
        expect(contrastRatio(tuned['--border'], tuned['--card'])).toBeGreaterThanOrEqual(3)
        expect(contrastRatio(tuned['--input'], tuned['--card'])).toBeGreaterThanOrEqual(3)
        expect(contrastRatio(tuned['--primary'], tuned['--background'])).toBeGreaterThanOrEqual(3)
        expect(contrastRatio(tuned['--ring'], tuned['--background'])).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('keeps a custom Classic accent hue and still clears button text', () => {
    const template = accentTokens(28, false)
    const tuned = highContrastPalette({ ...CLASSIC_LIGHT, ...template }, 'light')
    expect(parseHsl(tuned['--primary'])?.h).toBe(28)
    expect(parseHsl(tuned['--primary'])?.s).toBe(48)
    expect(contrastRatio(tuned['--primary-foreground'], tuned['--primary'])).toBeGreaterThanOrEqual(7)
  })

  it('paints tuned tokens for the active family and removes them when contrast is standard', () => {
    document.documentElement.dataset.theme = 'classic'
    document.documentElement.dataset.contrast = 'high'
    document.documentElement.classList.remove('dark')
    renderContrastStyle()
    const css = document.getElementById('kp-contrast')?.textContent ?? ''
    expect(css).toContain("html[data-contrast='high'][data-theme='classic']")
    expect(css).toContain('--border:')
    expect(css).toContain('--muted-foreground:')
    document.documentElement.dataset.contrast = 'standard'
    renderContrastStyle()
    expect(document.getElementById('kp-contrast')).toBeNull()
    document.documentElement.classList.remove('dark')
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.contrast
  })
})
