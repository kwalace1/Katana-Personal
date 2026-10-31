import type { Hemisphere, Season } from './types'

/** Meteorological season for each calendar month, northern hemisphere. January is 0. */
const NORTHERN_BY_MONTH: readonly Season[] = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'autumn',
  'autumn',
  'autumn',
  'winter',
]

const SOUTHERN_OF: Record<Season, Season> = {
  spring: 'autumn',
  summer: 'winter',
  autumn: 'spring',
  winter: 'summer',
}

/** Local midnight when a meteorological season starts. Same dates in both hemispheres. */
const SEASON_STARTS = [
  { month: 2, day: 1 },
  { month: 5, day: 1 },
  { month: 8, day: 1 },
  { month: 11, day: 1 },
] as const

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
}

const NORTHERN_RANGES: Record<Season, string> = {
  spring: 'March 1 – May 31',
  summer: 'June 1 – August 31',
  autumn: 'September 1 – November 30',
  winter: 'December 1 – February 28/29',
}

const SOUTHERN_RANGES: Record<Season, string> = {
  spring: 'September 1 – November 30',
  summer: 'December 1 – February 28/29',
  autumn: 'March 1 – May 31',
  winter: 'June 1 – August 31',
}

export function seasonRanges(hemisphere: Hemisphere): Record<Season, string> {
  return hemisphere === 'southern' ? SOUTHERN_RANGES : NORTHERN_RANGES
}

/** The one meteorological season for this local date. February 29 stays in the February season. */
export function seasonAt(date: Date, hemisphere: Hemisphere): Season {
  const northern = NORTHERN_BY_MONTH[date.getMonth()] ?? 'winter'
  return hemisphere === 'southern' ? SOUTHERN_OF[northern] : northern
}

/** The next local March 1, June 1, September 1, or December 1 strictly after `date`. */
export function nextSeasonChange(date: Date): Date {
  const year = date.getFullYear()
  for (const start of SEASON_STARTS) {
    const candidate = new Date(year, start.month, start.day, 0, 0, 0, 0)
    if (candidate.getTime() > date.getTime()) return candidate
  }
  return new Date(year + 1, 2, 1, 0, 0, 0, 0)
}
