import type { ExternalCalendarEvent } from './types'

function unfoldLines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function parseIcsDate(raw: string): { iso: string; allDay: boolean } | null {
  const v = raw.trim()
  if (!v) return null
  if (/^\d{8}$/.test(v)) {
    const y = v.slice(0, 4)
    const m = v.slice(4, 6)
    const d = v.slice(6, 8)
    return { iso: `${y}-${m}-${d}T00:00:00.000Z`, allDay: true }
  }
  if (/^\d{8}T\d{6}Z?$/.test(v)) {
    const y = v.slice(0, 4)
    const m = v.slice(4, 6)
    const d = v.slice(6, 8)
    const hh = v.slice(9, 11)
    const mm = v.slice(11, 13)
    const ss = v.slice(13, 15)
    const z = v.endsWith('Z') ? 'Z' : ''
    return { iso: `${y}-${m}-${d}T${hh}:${mm}:${ss}.000${z || 'Z'}`, allDay: false }
  }
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return { iso: d.toISOString(), allDay: false }
}

/** Minimal ICS parser — VEVENT blocks with SUMMARY, DTSTART, DTEND, UID. */
export function parseIcsEvents(icsText: string): ExternalCalendarEvent[] {
  const text = unfoldLines(icsText)
  const blocks = text.split('BEGIN:VEVENT').slice(1)
  const out: ExternalCalendarEvent[] = []

  for (const block of blocks) {
    const chunk = block.split('END:VEVENT')[0] || ''
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean)
    const fields: Record<string, string> = {}
    for (const line of lines) {
      const idx = line.indexOf(':')
      if (idx <= 0) continue
      const keyPart = line.slice(0, idx)
      const key = keyPart.split(';')[0]?.toUpperCase() ?? ''
      fields[key] = line.slice(idx + 1)
    }

    const uid = fields.UID || fields.URL
    const summary = fields.SUMMARY?.trim()
    const startRaw = fields.DTSTART
    if (!uid || !summary || !startRaw) continue

    const start = parseIcsDate(startRaw)
    if (!start) continue
    if (fields.DTEND) {
      const end = parseIcsDate(fields.DTEND)
      if (end) {
        out.push({
          external_id: uid,
          title: summary,
          notes: fields.DESCRIPTION?.replace(/\\n/g, '\n').trim() || '',
          starts_at: start.iso,
          ends_at: end.iso,
          all_day: start.allDay && end.allDay,
          location: fields.LOCATION?.replace(/\\,/g, ',').trim() || '',
        })
        continue
      }
    }
    let endIso = start.iso
    if (!start.allDay) {
      const endDate = new Date(start.iso)
      endDate.setHours(endDate.getHours() + 1)
      endIso = endDate.toISOString()
    }
    out.push({
      external_id: uid,
      title: summary,
      notes: fields.DESCRIPTION?.replace(/\\n/g, '\n').trim() || '',
      starts_at: start.iso,
      ends_at: endIso,
      all_day: start.allDay,
      location: fields.LOCATION?.replace(/\\,/g, ',').trim() || '',
    })
  }

  return out
}

export function filterEventsInWindow(
  events: ExternalCalendarEvent[],
  timeMin: string,
  timeMax: string,
): ExternalCalendarEvent[] {
  const min = new Date(timeMin).getTime()
  const max = new Date(timeMax).getTime()
  return events.filter((e) => {
    const start = new Date(e.starts_at).getTime()
    const end = new Date(e.ends_at).getTime()
    return end >= min && start <= max
  })
}
