import { addDays, todayKey } from '@/lib/dates'
import { tasksApi } from '@/modules/tasks/api'
import { calendarApi } from '@/modules/calendar/api'
import { notesApi } from '@/modules/notes/api'
import type { TaskPriority } from '@/modules/tasks/types'

export type CaptureKind = 'task' | 'note' | 'event'

export interface CaptureResult {
  kind: CaptureKind
  id: string
  title: string
  to: string
  summary: string
}

export interface ParsedCapture {
  kind: CaptureKind
  title: string
  dueAt: string | null
  priority: TaskPriority
  eventStart: Date | null
  eventEnd: Date | null
  allDay: boolean
  summary: string
}

const WEEKDAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
}

function nextWeekday(target: number, from = new Date()): Date {
  const d = new Date(from)
  d.setHours(9, 0, 0, 0)
  const diff = (target - d.getDay() + 7) % 7 || 7
  return addDays(d, diff)
}

function parseTimeToken(raw: string): { hours: number; minutes: number } | null {
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!m) return null
  let hours = Number(m[1])
  const minutes = m[2] ? Number(m[2]) : 0
  const ampm = m[3]
  if (ampm === 'pm' && hours < 12) hours += 12
  if (ampm === 'am' && hours === 12) hours = 0
  if (!ampm && hours <= 7) hours += 12 // bare "3" → 3pm heuristic for busy people
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

function applyTime(date: Date, time: { hours: number; minutes: number }): Date {
  const d = new Date(date)
  d.setHours(time.hours, time.minutes, 0, 0)
  return d
}

/** Parse capture text into a structured draft (does not write). */
export function parseCapture(raw: string): ParsedCapture | null {
  let text = raw.trim()
  if (!text) return null

  let kind: CaptureKind = 'task'
  if (text.startsWith('#')) {
    kind = 'note'
    text = text.slice(1).trim()
  } else if (text.startsWith('@')) {
    kind = 'event'
    text = text.slice(1).trim()
  }

  let priority: TaskPriority = 'medium'
  if (/(?:^|\s)!(?:\s|$)/.test(text) || text.includes('!!')) {
    priority = 'high'
    text = text.replace(/!!/g, ' ').replace(/(?:^|\s)!(?:\s|$)/g, ' ').trim()
  }

  let dueDate: Date | null = null
  let time: { hours: number; minutes: number } | null = null
  let allDay = true

  const tokens = text.split(/\s+/)
  const kept: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    const lower = tok.toLowerCase()

    if (lower === 'tomorrow' || lower === 'tmrw' || lower === 'tmr') {
      dueDate = addDays(new Date(), 1)
      dueDate.setHours(9, 0, 0, 0)
      continue
    }
    if (lower === 'today') {
      dueDate = new Date()
      dueDate.setHours(9, 0, 0, 0)
      continue
    }
    if (WEEKDAYS[lower] !== undefined) {
      dueDate = nextWeekday(WEEKDAYS[lower])
      continue
    }

    const parsedTime = parseTimeToken(tok)
    if (parsedTime) {
      time = parsedTime
      allDay = false
      continue
    }

    kept.push(tok)
  }

  const title = kept.join(' ').trim() || (kind === 'note' ? 'Untitled' : kind === 'event' ? 'New event' : 'New task')

  if (kind === 'event') {
    let start = dueDate ? new Date(dueDate) : new Date()
    if (!dueDate) {
      start.setMinutes(0, 0, 0)
      start.setHours(start.getHours() + 1)
      allDay = false
    }
    if (time) {
      start = applyTime(start, time)
      allDay = false
    } else if (dueDate) {
      start.setHours(9, 0, 0, 0)
      allDay = true
    }
    const end = new Date(start)
    end.setHours(end.getHours() + (allDay ? 0 : 1))
    if (allDay) {
      end.setHours(23, 59, 0, 0)
    }
    const when = allDay
      ? formatCaptureDay(start)
      : `${formatCaptureDay(start)} ${formatClock(start)}`
    const summary = `Event · ${title} · ${when}`
    return { kind, title, dueAt: null, priority, eventStart: start, eventEnd: end, allDay, summary }
  }

  if (kind === 'note') {
    return {
      kind,
      title,
      dueAt: null,
      priority,
      eventStart: null,
      eventEnd: null,
      allDay: true,
      summary: `Note · ${title}`,
    }
  }

  // Task: only set due if user mentioned a day/time — never force "due now"
  let dueAt: string | null = null
  if (dueDate || time) {
    const d = dueDate ? new Date(dueDate) : new Date()
    if (time) {
      dueAt = applyTime(d, time).toISOString()
    } else {
      d.setHours(17, 0, 0, 0)
      dueAt = d.toISOString()
    }
  }

  // Clear preview grammar: "Task · Call Mom · Fri 3pm"
  const bits = [`Task · ${title}`]
  if (priority === 'high') bits.push('high priority')
  if (dueAt) bits.push(formatCaptureWhen(dueAt))

  return {
    kind,
    title,
    dueAt,
    priority,
    eventStart: null,
    eventEnd: null,
    allDay: true,
    summary: bits.join(' · '),
  }
}

function formatClock(d: Date) {
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  const hr = h % 12 || 12
  return m ? `${hr}:${String(m).padStart(2, '0')}${ampm}` : `${hr}${ampm}`
}

function formatCaptureDay(d: Date) {
  const key = todayKey(d)
  if (key === todayKey()) return 'today'
  if (key === todayKey(addDays(new Date(), 1))) return 'tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short' })
}

/** Short when-label for capture preview: "Fri 3pm", "tomorrow", "today 9am". */
function formatCaptureWhen(iso: string) {
  const d = new Date(iso)
  const day = formatCaptureDay(d)
  const hasTime = d.getHours() !== 17 || d.getMinutes() !== 0
  return hasTime ? `${day} ${formatClock(d)}` : day
}

/** Commit a parsed capture to local storage. */
export function commitCapture(userId: string, parsed: ParsedCapture): CaptureResult {
  if (parsed.kind === 'note') {
    const note = notesApi.createNote(userId, { title: parsed.title })
    return { kind: 'note', id: note.id, title: note.title, to: `/notes?id=${note.id}`, summary: parsed.summary }
  }

  if (parsed.kind === 'event' && parsed.eventStart && parsed.eventEnd) {
    const event = calendarApi.create(userId, {
      title: parsed.title,
      notes: '',
      starts_at: parsed.eventStart.toISOString(),
      ends_at: parsed.eventEnd.toISOString(),
      all_day: parsed.allDay,
      location: '',
      recurrence: 'none',
      reminder_minutes: 30,
    })
    return {
      kind: 'event',
      id: event.id,
      title: event.title,
      to: `/calendar?date=${event.starts_at.slice(0, 10)}&id=${event.id}`,
      summary: parsed.summary,
    }
  }

  const lists = tasksApi.listLists(userId)
  const task = tasksApi.createTask(userId, {
    title: parsed.title,
    list_id: lists[0]?.id ?? null,
    due_at: parsed.dueAt,
    priority: parsed.priority,
  })
  return {
    kind: 'task',
    id: task.id,
    title: task.title,
    to: `/tasks?id=${task.id}`,
    summary: parsed.summary,
  }
}

export function captureItem(userId: string, raw: string): CaptureResult | null {
  const parsed = parseCapture(raw)
  if (!parsed) return null
  return commitCapture(userId, parsed)
}
