import type { SleepLog } from './types'

export type ImportedSleepNight = {
  date: string
  hours: number
  bedtime: string
  wake: string
  source: NonNullable<SleepLog['source']>
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toHHMM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Apple Health uses `2026-08-16 22:41:00 -0400`. */
export function parseHealthDate(raw: string): Date | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const isoish = trimmed.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/, '$1T$2$3:$4')
  const d = new Date(isoish)
  return Number.isNaN(d.getTime()) ? null : d
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`))
  return m?.[1] ?? null
}

/**
 * Collapse overlapping asleep intervals onto the wake-up calendar date
 * (the morning you got up — same as “log last night”).
 */
export function nightsFromIntervals(
  intervals: { start: Date; end: Date }[],
  source: ImportedSleepNight['source'],
): ImportedSleepNight[] {
  const byDate = new Map<string, { start: Date; end: Date; ms: number }>()
  for (const iv of intervals) {
    if (iv.end <= iv.start) continue
    const date = toDateKey(iv.end)
    const existing = byDate.get(date)
    const ms = iv.end.getTime() - iv.start.getTime()
    if (!existing) {
      byDate.set(date, { start: iv.start, end: iv.end, ms })
      continue
    }
    if (iv.start < existing.start) existing.start = iv.start
    if (iv.end > existing.end) existing.end = iv.end
    existing.ms += ms
  }
  return [...byDate.entries()]
    .map(([date, row]) => ({
      date,
      hours: Math.round((row.ms / 36e5) * 10) / 10,
      bedtime: toHHMM(row.start),
      wake: toHHMM(row.end),
      source,
    }))
    .filter((n) => n.hours > 0.5)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function parseAppleHealthSleepXml(xml: string): ImportedSleepNight[] {
  const intervals: { start: Date; end: Date }[] = []
  const re = /<Record\b[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(xml))) {
    const tag = match[0]
    const type = attr(tag, 'type') || ''
    if (!/SleepAnalysis/i.test(type)) continue
    const value = attr(tag, 'value') || ''
    if (/Awake/i.test(value) && !/Asleep/i.test(value)) continue
    if (value && !/Asleep|InBed/i.test(value)) continue
    const start = parseHealthDate(attr(tag, 'startDate') || '')
    const end = parseHealthDate(attr(tag, 'endDate') || '')
    if (!start || !end) continue
    intervals.push({ start, end })
  }
  return nightsFromIntervals(intervals, 'apple_health')
}

function parseLooseDate(raw: string): Date | null {
  const t = raw.trim().replace(/^"|"$/g, '')
  if (!t) return null
  const direct = new Date(t)
  if (!Number.isNaN(direct.getTime())) return direct
  const m = t.match(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
  )
  if (!m) return null
  const [, date, hourStr, minStr, ap] = m
  let hour = Number(hourStr)
  const min = Number(minStr)
  if (ap?.toUpperCase() === 'PM' && hour < 12) hour += 12
  if (ap?.toUpperCase() === 'AM' && hour === 12) hour = 0
  const iso = `${date}T${pad2(hour)}:${pad2(min)}:00`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

export function parseFitbitSleepCsv(csv: string): ImportedSleepNight[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const header = splitCsvLine(lines[0] || '').map((h) => h.trim().toLowerCase())
  const startIdx = header.findIndex((h) => /start/.test(h))
  const endIdx = header.findIndex((h) => /end/.test(h))
  const minIdx = header.findIndex((h) => /minutes asleep|min asleep|sleep minutes/.test(h))
  if (startIdx < 0 && endIdx < 0) return []
  const intervals: { start: Date; end: Date }[] = []
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line)
    const start = parseLooseDate(cols[startIdx] || '')
    const end = parseLooseDate(cols[endIdx] || '')
    if (start && end) {
      intervals.push({ start, end })
      continue
    }
    if (start && minIdx >= 0) {
      const mins = Number(cols[minIdx])
      if (Number.isFinite(mins) && mins > 0) {
        intervals.push({ start, end: new Date(start.getTime() + mins * 60_000) })
      }
    }
  }
  return nightsFromIntervals(intervals, 'fitbit')
}

export function parseSleepImportFile(filename: string, text: string): ImportedSleepNight[] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.xml') || /SleepAnalysis|<Record\b/i.test(text)) {
    return parseAppleHealthSleepXml(text)
  }
  return parseFitbitSleepCsv(text)
}

/** Hours between bedtime and wake (wake is next morning if earlier). */
export function hoursBetweenTimes(bedtime: string, wake: string): number | null {
  const parse = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null
    return h * 60 + m
  }
  const bed = parse(bedtime)
  const up = parse(wake)
  if (bed == null || up == null) return null
  let mins = up - bed
  if (mins <= 0) mins += 24 * 60
  return Math.round((mins / 60) * 10) / 10
}
