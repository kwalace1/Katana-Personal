import { tasksApi } from '@/modules/tasks/api'
import { calendarApi } from '@/modules/calendar/api'
import { habitsApi } from '@/modules/habits/api'
import { goalsApi } from '@/modules/goals/api'
import { journalApi } from '@/modules/journal/api'
import { healthApi } from '@/modules/health/api'
import { notesApi } from '@/modules/notes/api'
import { parseCapture } from '@/lib/capture'
import { addDays, format, formatShortDate, formatTime, todayKey } from '@/lib/dates'
import { createId } from '@/lib/id'
import type { Task } from '@/modules/tasks/types'
import type { CalendarEvent } from '@/modules/calendar/types'
import type { Habit } from '@/modules/habits/types'
import type { Goal } from '@/modules/goals/types'
import type { AskAction } from './ask-api'

export interface LifeSnapshot {
  name: string
  todayLabel: string
  openTasks: Task[]
  todayTasks: Task[]
  priorityTasks: Task[]
  upcomingEvents: CalendarEvent[]
  todayEvents: CalendarEvent[]
  habitsDue: Habit[]
  habitsDoneIds: string[]
  activeGoals: Goal[]
  behindGoals: Goal[]
  journalToday: boolean
  waterGlasses: number
  recentWorkouts: number
  recentNotes: number
}

export interface AskReply {
  text: string
  actions: AskAction[]
}

export function buildSnapshot(userId: string, displayName = 'there'): LifeSnapshot {
  const today = new Date()
  const openTasks = tasksApi.listTasks(userId).filter((t) => t.status !== 'done')
  const habitsDue = habitsApi.dueToday(userId)
  const activeGoals = goalsApi.active(userId, 20)
  const behindGoals = activeGoals.filter((g) => g.progress / Math.max(g.target, 1) < 0.4)

  return {
    name: displayName,
    todayLabel: format(today, 'EEEE, MMMM d'),
    openTasks,
    todayTasks: tasksApi.todayTasks(userId),
    priorityTasks: tasksApi.priorityTasks(userId, 5),
    upcomingEvents: calendarApi.upcoming(userId, 8),
    todayEvents: calendarApi.forDay(userId, today),
    habitsDue,
    habitsDoneIds: habitsDue.filter((h) => habitsApi.isDoneToday(userId, h.id)).map((h) => h.id),
    activeGoals,
    behindGoals,
    journalToday: Boolean(journalApi.forDate(userId, todayKey())),
    waterGlasses: healthApi.getWater(userId).glasses,
    recentWorkouts: healthApi.listWorkouts(userId).filter((w) => w.date >= todayKey(addDays(today, -7))).length,
    recentNotes: notesApi.listNotes(userId).length,
  }
}

function listTitles(items: { title: string }[], limit = 4): string {
  if (items.length === 0) return 'none'
  return items
    .slice(0, limit)
    .map((i) => i.title)
    .join(', ')
}

export function buildDailyBriefing(snap: LifeSnapshot): string {
  const parts: string[] = []
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  parts.push(`${hello}, ${snap.name}.`)

  if (snap.todayEvents.length > 0) {
    const first = snap.todayEvents[0]
    const when = first.all_day ? 'all day' : formatTime(first.starts_at)
    parts.push(
      snap.todayEvents.length === 1
        ? `You have one thing on the calendar today: ${first.title} (${when}).`
        : `You have ${snap.todayEvents.length} things on the calendar today, starting with ${first.title} (${when}).`,
    )
  } else if (snap.upcomingEvents.length > 0) {
    const next = snap.upcomingEvents[0]
    parts.push(`Your calendar is clear today. Next up is ${next.title} on ${formatShortDate(next.starts_at)}.`)
  } else {
    parts.push('Your calendar is open today — a good day to protect some quiet focus.')
  }

  if (snap.priorityTasks.length > 0) {
    const top = snap.priorityTasks[0]
    parts.push(
      snap.priorityTasks.length === 1
        ? `Top of the list: ${top.title}.`
        : `I’d start with ${top.title}. You also have ${snap.openTasks.length} open task${snap.openTasks.length === 1 ? '' : 's'} waiting.`,
    )
  } else {
    parts.push('No open tasks — enjoy the calm, or capture something small if it’s on your mind.')
  }

  if (snap.habitsDue.length > 0) {
    const left = snap.habitsDue.length - snap.habitsDoneIds.length
    if (left === 0) {
      parts.push('All of today’s habits are checked in. Nice.')
    } else {
      const pending = snap.habitsDue.filter((h) => !snap.habitsDoneIds.includes(h.id))
      parts.push(
        left === 1
          ? `One habit still open: ${pending[0].title}.`
          : `${left} habits still open — ${listTitles(pending, 3)}.`,
      )
    }
  }

  if (snap.behindGoals.length > 0) {
    parts.push(
      snap.behindGoals.length === 1
        ? `${snap.behindGoals[0].title} could use a little attention.`
        : `${snap.behindGoals.length} goals are moving slowly — ${listTitles(snap.behindGoals, 2)} stand out.`,
    )
  }

  if (!snap.journalToday) {
    parts.push('You haven’t written in your journal yet today.')
  }

  return parts.join(' ')
}

function briefingActions(snap: LifeSnapshot): AskAction[] {
  const actions: AskAction[] = []
  const top = snap.priorityTasks[0]
  if (top) {
    actions.push({
      id: createId(),
      label: `Mark “${top.title}” done`,
      kind: 'complete_task',
      taskId: top.id,
    })
  }
  const pendingHabit = snap.habitsDue.find((h) => !snap.habitsDoneIds.includes(h.id))
  if (pendingHabit) {
    actions.push({
      id: createId(),
      label: `Check in “${pendingHabit.title}”`,
      kind: 'toggle_habit',
      habitId: pendingHabit.id,
    })
  }
  actions.push({ id: createId(), label: 'Log water', kind: 'log_water' })
  return actions
}

function answerFocus(snap: LifeSnapshot): AskReply {
  if (snap.priorityTasks.length > 0) {
    const lines = snap.priorityTasks.slice(0, 3).map((t, i) => `${i + 1}. ${t.title}`)
    const top = snap.priorityTasks[0]
    return {
      text: `Here’s what I’d work on today:\n\n${lines.join('\n')}\n\nStart with #1, then reassess.`,
      actions: [
        {
          id: createId(),
          label: `Mark “${top.title}” done`,
          kind: 'complete_task',
          taskId: top.id,
        },
        {
          id: createId(),
          label: 'Open tasks',
          kind: 'open_route',
          route: `/tasks?id=${top.id}`,
        },
      ],
    }
  }
  if (snap.todayEvents.length > 0) {
    return {
      text: `You don’t have open tasks, but you do have plans today — ${listTitles(snap.todayEvents)}. Protect time around those first.`,
      actions: [{ id: createId(), label: 'Open calendar', kind: 'open_route', route: '/calendar' }],
    }
  }
  return {
    text: 'Nothing urgent is waiting. That’s rare — use it for rest, or pick one small thing that would make tomorrow easier.',
    actions: [{ id: createId(), label: 'Add a task', kind: 'open_route', route: '/tasks' }],
  }
}

function answerWorkout(snap: LifeSnapshot): AskReply {
  const busyBlocks = snap.todayEvents.filter((e) => !e.all_day)
  let text: string
  if (busyBlocks.length === 0) {
    text =
      snap.recentWorkouts === 0
        ? 'Your day looks open. A short workout this morning or late afternoon would fit well — especially since you haven’t logged one this week.'
        : 'Your day looks open. Morning or late afternoon would both work. You’ve already moved a bit this week, so keep it light if you want.'
  } else {
    const first = busyBlocks[0]
    const startHour = new Date(first.starts_at).getHours()
    if (startHour >= 12) {
      text = `You’re free before ${first.title} (${formatTime(first.starts_at)}). That’s a good window to work out.`
    } else {
      const last = busyBlocks[busyBlocks.length - 1]
      text = `I’d wait until after ${last.title} (${formatTime(last.ends_at || last.starts_at)}), then take a short session when the day opens up.`
    }
  }
  return {
    text,
    actions: [{ id: createId(), label: 'Log a workout', kind: 'open_route', route: '/health' }],
  }
}

function answerWeek(snap: LifeSnapshot): AskReply {
  const bits: string[] = []
  bits.push(`This week so far: ${snap.openTasks.length} open task${snap.openTasks.length === 1 ? '' : 's'}.`)
  bits.push(
    snap.upcomingEvents.length > 0
      ? `Coming up: ${listTitles(snap.upcomingEvents, 4)}.`
      : 'The calendar ahead looks light.',
  )
  bits.push(
    snap.habitsDue.length > 0
      ? `Habits today: ${snap.habitsDoneIds.length} of ${snap.habitsDue.length} done.`
      : 'No habits set yet.',
  )
  if (snap.activeGoals.length > 0) {
    bits.push(
      snap.behindGoals.length > 0
        ? `Goals needing love: ${listTitles(snap.behindGoals, 3)}.`
        : 'Your goals are in decent shape.',
    )
  }
  bits.push(
    snap.recentWorkouts > 0
      ? `You’ve logged ${snap.recentWorkouts} workout${snap.recentWorkouts === 1 ? '' : 's'} in the last week.`
      : 'No workouts logged this week yet.',
  )
  return {
    text: bits.join(' '),
    actions: [{ id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' }],
  }
}

function answerGoals(snap: LifeSnapshot): AskReply {
  if (snap.activeGoals.length === 0) {
    return {
      text: 'You don’t have any goals set yet. When you’re ready, add one that would make this season feel meaningful.',
      actions: [{ id: createId(), label: 'Add a goal', kind: 'open_route', route: '/goals' }],
    }
  }
  if (snap.behindGoals.length === 0) {
    return {
      text: `You’re keeping pace. Active goals: ${listTitles(snap.activeGoals, 5)}.`,
      actions: [{ id: createId(), label: 'Open goals', kind: 'open_route', route: '/goals' }],
    }
  }
  const lines = snap.behindGoals.slice(0, 5).map((g) => {
    const pct = Math.round((g.progress / Math.max(g.target, 1)) * 100)
    return `• ${g.title} (${pct}% there)`
  })
  const first = snap.behindGoals[0]
  return {
    text: `These could use a nudge:\n\n${lines.join('\n')}\n\nPick one and take a tiny step today.`,
    actions: [
      {
        id: createId(),
        label: `Open “${first.title}”`,
        kind: 'open_route',
        route: `/goals?id=${first.id}`,
      },
    ],
  }
}

function answerHabits(snap: LifeSnapshot): AskReply {
  if (snap.habitsDue.length === 0) {
    return {
      text: 'No habits for today. Add one if there’s a rhythm you want to keep.',
      actions: [{ id: createId(), label: 'Add a habit', kind: 'open_route', route: '/habits' }],
    }
  }
  const pending = snap.habitsDue.filter((h) => !snap.habitsDoneIds.includes(h.id))
  if (pending.length === 0) {
    return {
      text: 'You’ve checked in on every habit today. Beautiful.',
      actions: [{ id: createId(), label: 'Open habits', kind: 'open_route', route: '/habits' }],
    }
  }
  const first = pending[0]
  return {
    text: `Still open today: ${listTitles(pending, 6)}. One check-in is enough to keep the streak alive.`,
    actions: [
      {
        id: createId(),
        label: `Check in “${first.title}”`,
        kind: 'toggle_habit',
        habitId: first.id,
      },
    ],
  }
}

function answerHealth(snap: LifeSnapshot): AskReply {
  return {
    text: `Water today: ${snap.waterGlasses} glass${snap.waterGlasses === 1 ? '' : 'es'}. Workouts this week: ${snap.recentWorkouts}. ${
      snap.waterGlasses < 4 ? 'A glass of water would be a kind next step.' : 'Hydration looks solid.'
    }`,
    actions: [
      { id: createId(), label: 'Log a glass of water', kind: 'log_water' },
      { id: createId(), label: 'Open health', kind: 'open_route', route: '/health' },
    ],
  }
}

function answerDefault(snap: LifeSnapshot): AskReply {
  return {
    text: `${buildDailyBriefing(snap)}\n\nYou can also ask things like “What should I work on today?”, “When should I work out?”, “Summarize my week,” or “What goals am I falling behind on?”`,
    actions: briefingActions(snap),
  }
}

export function answerQuestion(userId: string, question: string, displayName?: string): string {
  return answerQuestionWithActions(userId, question, displayName).text
}

export function answerQuestionWithActions(
  userId: string,
  question: string,
  displayName?: string,
): AskReply {
  const snap = buildSnapshot(userId, displayName)
  const q = question.trim().toLowerCase()

  if (!q || q === 'briefing') {
    return { text: buildDailyBriefing(snap), actions: briefingActions(snap) }
  }

  const created = tryParseCreate(question.trim())
  if (created) return created

  if (q.includes('work out') || q.includes('workout') || q.includes('exercise') || q.includes('gym')) {
    return answerWorkout(snap)
  }
  if (
    q.includes('work on') ||
    q.includes('focus') ||
    q.includes('priorit') ||
    q.includes('should i do') ||
    (q.includes('today') && (q.includes('what') || q.includes('should')))
  ) {
    return answerFocus(snap)
  }
  if (q.includes('week') || q.includes('summar')) return answerWeek(snap)
  if (q.includes('goal') || q.includes('behind') || q.includes('falling')) return answerGoals(snap)
  if (q.includes('habit')) return answerHabits(snap)
  if (q.includes('health') || q.includes('water') || q.includes('sleep') || q.includes('nutrition')) {
    return answerHealth(snap)
  }
  if (q.includes('brief') || q.includes('overview') || q.includes('how am i') || q.includes('status')) {
    return { text: buildDailyBriefing(snap), actions: briefingActions(snap) }
  }
  return answerDefault(snap)
}

export function runAskAction(userId: string, action: AskAction): string {
  if (action.kind === 'complete_task' && action.taskId) {
    tasksApi.completeTask(userId, action.taskId)
    return 'Marked done.'
  }
  if (action.kind === 'toggle_habit' && action.habitId) {
    habitsApi.toggleToday(userId, action.habitId)
    return 'Habit updated.'
  }
  if (action.kind === 'log_water') {
    const current = healthApi.getWater(userId)
    healthApi.setWater(userId, current.glasses + 1)
    return 'Logged a glass of water.'
  }
  if (action.kind === 'create_task' && action.title) {
    const lists = tasksApi.listLists(userId)
    const task = tasksApi.createTask(userId, {
      title: action.title,
      list_id: lists[0]?.id ?? null,
      due_at: action.dueAt ?? null,
    })
    return `Added “${task.title}”.`
  }
  if (action.kind === 'create_event' && action.title && action.startsAt && action.endsAt) {
    calendarApi.create(userId, {
      title: action.title,
      notes: '',
      starts_at: action.startsAt,
      ends_at: action.endsAt,
      all_day: false,
      location: '',
      recurrence: 'none',
      reminder_minutes: 30,
    })
    return `Scheduled “${action.title}”.`
  }
  return ''
}

export const SUGGESTED_ASKS = [
  'What should I work on today?',
  'When should I work out?',
  'Summarize my week.',
  'What goals am I falling behind on?',
  'Add gym tomorrow',
] as const

function tryParseCreate(question: string): AskReply | null {
  const q = question.trim()
  const lower = q.toLowerCase()
  const addMatch = lower.match(/^(?:add|remind me to|create|schedule)\s+(.+)$/i)
  if (!addMatch) return null

  // Prefer capture parser for dates/times
  const raw = addMatch[1]
  const isEvent =
    lower.startsWith('schedule') ||
    lower.includes(' meeting') ||
    lower.includes(' appointment') ||
    raw.startsWith('@')
  const parsed = parseCapture(isEvent ? `@ ${raw.replace(/^@\s*/, '')}` : raw)
  if (!parsed) return null

  if (parsed.kind === 'event' && parsed.eventStart && parsed.eventEnd) {
    return {
      text: `I can schedule “${parsed.title}” (${parsed.summary.replace(/^Event · /, '')}). Tap to confirm.`,
      actions: [
        {
          id: createId(),
          label: `Schedule “${parsed.title}”`,
          kind: 'create_event',
          title: parsed.title,
          startsAt: parsed.eventStart.toISOString(),
          endsAt: parsed.eventEnd.toISOString(),
        },
      ],
    }
  }

  return {
    text: `I can add “${parsed.title}”${parsed.dueAt ? ` (${parsed.summary})` : ''}. Tap to confirm.`,
    actions: [
      {
        id: createId(),
        label: `Add “${parsed.title}”`,
        kind: 'create_task',
        title: parsed.title,
        dueAt: parsed.dueAt,
      },
    ],
  }
}
