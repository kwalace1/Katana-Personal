import { describe, expect, it, beforeEach } from 'vitest'
import { CALENDAR_ITEM_COLORS } from '@/theme/functional'
import { APPEARANCE_STORAGE_KEY, THEME_PREFS_STORAGE_KEY, writeThemePreferences } from '@/theme/preferences'
import { ACCENT_HUE_KEY } from '@/lib/accent'
import { buildAgenda } from './agenda'
import {
  CALENDAR_COLOR_PREF_KEY,
  CALENDAR_COLOR_STORAGE_KEY,
  calendarColorPreferencePatch,
  defaultCalendarItemColors,
  normalizeCalendarHex,
  parseCalendarItemColors,
  readStoredCalendarItemColors,
  resolveCalendarItemColors,
} from './item-colors'
import type { CalendarEvent } from './types'

describe('calendar item colors', () => {
  beforeEach(() => {
    localStorage.removeItem(CALENDAR_COLOR_STORAGE_KEY)
    localStorage.removeItem(THEME_PREFS_STORAGE_KEY)
    localStorage.removeItem(APPEARANCE_STORAGE_KEY)
    localStorage.removeItem(ACCENT_HUE_KEY)
  })

  it('keeps the original defaults when nothing is saved', () => {
    expect(resolveCalendarItemColors(null)).toEqual(CALENDAR_ITEM_COLORS)
    expect(resolveCalendarItemColors({})).toEqual(CALENDAR_ITEM_COLORS)
    expect(readStoredCalendarItemColors()).toEqual(defaultCalendarItemColors())
  })

  it('rejects malformed colors and keeps the other saved types', () => {
    expect(normalizeCalendarHex('blue')).toBeNull()
    expect(normalizeCalendarHex('#12')).toBeNull()
    expect(normalizeCalendarHex('#abc')).toBe('#AABBCC')
    expect(normalizeCalendarHex('  #3673cc ')).toBe('#3673CC')
    expect(
      parseCalendarItemColors({
        event: 'not-a-color',
        task: '#112233',
        goal: '#zzzzzz',
        habit: 12,
        extra: '#000000',
      }),
    ).toEqual({
      event: '#3673CC',
      task: '#112233',
      goal: '#25875F',
      habit: '#8956CF',
    })
    localStorage.setItem(CALENDAR_COLOR_STORAGE_KEY, '{')
    expect(readStoredCalendarItemColors()).toEqual(CALENDAR_ITEM_COLORS)
  })

  it('prefers the account value, then the device cache, then the defaults', () => {
    localStorage.setItem(CALENDAR_COLOR_STORAGE_KEY, JSON.stringify({ event: '#112233' }))
    expect(resolveCalendarItemColors(undefined).event).toBe('#112233')
    expect(resolveCalendarItemColors({ [CALENDAR_COLOR_PREF_KEY]: { task: '#445566' } })).toEqual({
      ...CALENDAR_ITEM_COLORS,
      task: '#445566',
    })
    expect(resolveCalendarItemColors({ [CALENDAR_COLOR_PREF_KEY]: null }).event).toBe('#112233')
  })

  it('stores only overrides and clears them on reset', () => {
    const custom = { ...defaultCalendarItemColors(), habit: '#BE123C' }
    expect(calendarColorPreferencePatch(custom)).toEqual({
      [CALENDAR_COLOR_PREF_KEY]: { habit: '#BE123C' },
    })
    expect(JSON.parse(localStorage.getItem(CALENDAR_COLOR_STORAGE_KEY) || '{}')).toEqual({ habit: '#BE123C' })
    expect(calendarColorPreferencePatch(defaultCalendarItemColors())).toEqual({
      [CALENDAR_COLOR_PREF_KEY]: null,
    })
    expect(localStorage.getItem(CALENDAR_COLOR_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ACCENT_HUE_KEY)).toBeNull()
  })

  it('leaves theme and appearance preferences alone', () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'dark')
    writeThemePreferences({ family: 'ocean', rotation: 'seasonal', contrast: 'high' })
    calendarColorPreferencePatch({ ...defaultCalendarItemColors(), event: '#0E7490' })
    writeThemePreferences({ family: 'winter', rotation: 'time-of-day' })
    expect(readStoredCalendarItemColors().event).toBe('#0E7490')
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark')
    const theme = JSON.parse(localStorage.getItem(THEME_PREFS_STORAGE_KEY) || '{}') as Record<string, unknown>
    expect(theme.family).toBe('winter')
    expect(theme.contrast).toBe('high')
    expect(theme.calendar_item_colors).toBeUndefined()
  })

  it('paints every item of a type with the resolved color', () => {
    const colors = {
      ...defaultCalendarItemColors(),
      event: '#112233',
      task: '#445566',
      goal: '#778899',
      habit: '#BE123C',
    }
    const event: CalendarEvent = {
      id: 'e1',
      user_id: 'u',
      title: 'Work meeting',
      notes: '',
      starts_at: '2026-10-30T15:00:00.000Z',
      ends_at: '2026-10-30T16:00:00.000Z',
      all_day: false,
      location: '',
      recurrence: 'weekly',
      reminder_minutes: null,
      category: 'work',
      color: '#ff00aa',
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    }
    const items = buildAgenda({
      events: [event],
      tasks: [
        {
          id: 't1',
          user_id: 'u',
          list_id: null,
          title: 'Pay rent',
          notes: '',
          priority: 'medium',
          status: 'todo',
          due_at: '2026-10-30T12:00:00.000Z',
          completed_at: null,
          recurrence: 'weekly',
          category: 'personal',
          sort_order: 0,
          goal_id: null,
          habit_id: null,
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z',
        },
      ],
      goals: [
        {
          id: 'g1',
          user_id: 'u',
          title: 'Ship the release',
          description: '',
          horizon: 'monthly',
          target: 1,
          progress: 0,
          parent_id: null,
          target_date: '2026-10-30',
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z',
        },
      ],
      habits: [
        {
          id: 'h1',
          user_id: 'u',
          folder_id: null,
          title: 'Stretch',
          schedule: 'once',
          custom_days: [],
          once_date: '2026-10-30',
          reminder_time: null,
          reminder_times: [],
          nudge_until_done: false,
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z',
        },
      ],
      colors,
      rangeStart: new Date('2026-10-25T00:00:00.000Z'),
      rangeEnd: new Date('2026-11-08T00:00:00.000Z'),
    })
    expect(items.filter((item) => item.kind === 'event').every((item) => item.color === '#112233')).toBe(true)
    const tasks = items.filter((item) => item.kind === 'task')
    expect(tasks.length).toBeGreaterThan(1)
    expect(tasks.every((item) => item.color === '#445566')).toBe(true)
    expect(items.find((item) => item.kind === 'goal')?.color).toBe('#778899')
    expect(items.find((item) => item.kind === 'habit')?.color).toBe('#BE123C')
    expect(event.color).toBe('#ff00aa')
    expect(event.category).toBe('work')
    expect(CALENDAR_ITEM_COLORS.event).toBe('#3673CC')
  })
})
