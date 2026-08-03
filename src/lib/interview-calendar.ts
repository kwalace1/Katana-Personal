/**
 * Build calendar / email helpers for scheduling interviews (ICS + Google Calendar + mailto).
 */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Parse `YYYY-MM-DD` and optional `HH:mm` as local wall-clock time. */
export function parseLocalInterviewDateTime(dateStr: string, timeStr: string | undefined): Date {
  const t = (timeStr || '09:00').slice(0, 5)
  const [y, mo, d] = dateStr.split('-').map((x) => parseInt(x, 10))
  const [hh, mm] = t.split(':').map((x) => parseInt(x, 10))
  return new Date(y, (mo || 1) - 1, d || 1, Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0)
}

function toGcalUtcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
}

function escapeIcsText(s: string): string {
  return (s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

export function buildInterviewIcs(opts: {
  title: string
  description: string
  start: Date
  end: Date
  uid?: string
}): string {
  const uid = opts.uid || `${Date.now()}-${Math.random().toString(36).slice(2)}@katana-hr`
  const dtStamp = toGcalUtcStamp(new Date())
  const dtStart = toGcalUtcStamp(opts.start)
  const dtEnd = toGcalUtcStamp(opts.end)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Katana HR//Interview//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(opts.title)}`,
    `DESCRIPTION:${escapeIcsText(opts.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function buildGoogleCalendarUrl(title: string, details: string, start: Date, end: Date): string {
  const dates = `${toGcalUtcStamp(start)}/${toGcalUtcStamp(end)}`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    details,
    dates,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** mailto: encode path (subject/body) only, not the address. */
export function buildInterviewMailtoHref(to: string, subject: string, body: string): string {
  const enc = (s: string) => encodeURIComponent(s)
  return `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`
}

export function downloadIcsFile(filename: string, icsBody: string): void {
  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
