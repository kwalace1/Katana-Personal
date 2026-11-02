/**
 * Default calendar type colors. Item type decides the color.
 * A saved calendar preference may override these when the calendar is painted.
 * Decorative theme families must not replace these defaults.
 */
export const CALENDAR_ITEM_COLORS = {
  event: '#3673CC',
  task: '#D48929',
  goal: '#25875F',
  habit: '#8956CF',
} as const

export type CalendarItemType = keyof typeof CALENDAR_ITEM_COLORS
