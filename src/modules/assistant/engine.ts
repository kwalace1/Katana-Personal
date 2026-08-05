import { tasksApi } from '@/modules/tasks/api'
import { calendarApi } from '@/modules/calendar/api'
import { habitsApi } from '@/modules/habits/api'
import { goalsApi } from '@/modules/goals/api'
import { journalApi } from '@/modules/journal/api'
import { healthApi } from '@/modules/health/api'
import { liftApi } from '@/modules/health/lift-api'
import { notesApi } from '@/modules/notes/api'
import { parseCapture } from '@/lib/capture'
import { addDays, format, formatShortDate, formatTime, todayKey } from '@/lib/dates'
import { createId } from '@/lib/id'
import { weekLabel } from '@/lib/week-review'
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
  journalMood: string | null
  waterGlasses: number
  recentWorkouts: number
  recentLifts: number
  sleepHoursLast: number
  caloriesToday: number
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
  const journal = journalApi.forDate(userId, todayKey())
  const weekStart = todayKey(addDays(today, -7))

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
    journalToday: Boolean(journal),
    journalMood: journal?.mood ?? null,
    waterGlasses: healthApi.getWater(userId).glasses,
    recentWorkouts: healthApi
      .listWorkouts(userId)
      .filter((w) => w.date >= weekStart && !w.lift_session_id).length,
    recentLifts: liftApi.listSessions(userId).filter((s) => s.date >= weekStart).length,
    sleepHoursLast: healthApi.listSleep(userId)[0]?.hours ?? 0,
    caloriesToday: healthApi
      .listNutrition(userId)
      .filter((n) => n.date === todayKey())
      .reduce((s, n) => s + (n.calories || 0), 0),
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

export function buildBriefingActions(snap: LifeSnapshot): AskAction[] {
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
  if (snap.waterGlasses < 6) {
    actions.push({ id: createId(), label: 'Log water', kind: 'log_water' })
  }
  if (!snap.journalToday) {
    actions.push({
      id: createId(),
      label: 'Open journal',
      kind: 'open_route',
      route: '/journal',
    })
  }
  return actions
}

/** @deprecated use buildBriefingActions */
function briefingActions(snap: LifeSnapshot): AskAction[] {
  return buildBriefingActions(snap)
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
  bits.push(`Week of ${weekLabel()}.`)
  bits.push(`${snap.openTasks.length} open task${snap.openTasks.length === 1 ? '' : 's'}.`)
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

  const actions: AskAction[] = []
  const top = snap.priorityTasks[0]
  if (top) {
    actions.push({
      id: createId(),
      label: `Finish “${top.title}”`,
      kind: 'complete_task',
      taskId: top.id,
    })
  }
  if (snap.todayTasks.length > 0) {
    actions.push({
      id: createId(),
      label: 'Park today’s unfinished',
      kind: 'park_tasks',
    })
  }
  if (snap.behindGoals[0]) {
    actions.push({
      id: createId(),
      label: `Open “${snap.behindGoals[0].title}”`,
      kind: 'open_route',
      route: `/goals?id=${snap.behindGoals[0].id}`,
    })
  }
  actions.push({ id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' })

  return { text: bits.join(' '), actions }
}

function answerCloseDay(snap: LifeSnapshot): AskReply {
  const unfinished = snap.todayTasks.length
  const habitsLeft = snap.habitsDue.length - snap.habitsDoneIds.length
  const parts = [
    'Let’s close the day gently.',
    unfinished > 0
      ? `${unfinished} unfinished task${unfinished === 1 ? '' : 's'} can move to tomorrow.`
      : 'No unfinished tasks due today.',
    habitsLeft > 0
      ? `${habitsLeft} habit${habitsLeft === 1 ? '' : 's'} still open — check in if you can.`
      : 'Habits look settled.',
  ]

  const actions: AskAction[] = []
  const pendingHabit = snap.habitsDue.find((h) => !snap.habitsDoneIds.includes(h.id))
  if (pendingHabit) {
    actions.push({
      id: createId(),
      label: `Check in “${pendingHabit.title}”`,
      kind: 'toggle_habit',
      habitId: pendingHabit.id,
    })
  }
  if (unfinished > 0) {
    actions.push({ id: createId(), label: 'Park unfinished for tomorrow', kind: 'park_tasks' })
  }
  actions.push({
    id: createId(),
    label: 'Close day',
    kind: 'close_day',
    body: '',
  })
  if (!snap.journalToday) {
    actions.push({ id: createId(), label: 'Write in journal', kind: 'open_route', route: '/journal' })
  }

  return { text: parts.join(' '), actions }
}

function answerTomorrow(snap: LifeSnapshot): AskReply {
  const tomorrowEvents = snap.upcomingEvents.filter((e) => {
    const d = new Date(e.starts_at)
    const tmr = addDays(new Date(), 1)
    return (
      d.getFullYear() === tmr.getFullYear() &&
      d.getMonth() === tmr.getMonth() &&
      d.getDate() === tmr.getDate()
    )
  })
  const bits = [
    'Prep for tomorrow:',
    tomorrowEvents.length > 0
      ? `On the calendar: ${listTitles(tomorrowEvents, 4)}.`
      : 'Nothing on the calendar yet — keep it light or add one anchor.',
    snap.priorityTasks[0]
      ? `Carry forward: ${snap.priorityTasks[0].title}.`
      : 'No priority task waiting — nice.',
  ]
  return {
    text: bits.join(' '),
    actions: [
      ...(snap.todayTasks.length > 0
        ? [{ id: createId(), label: 'Park today’s unfinished', kind: 'park_tasks' as const }]
        : []),
      { id: createId(), label: 'Add for tomorrow', kind: 'open_route', route: '/tasks' },
      { id: createId(), label: 'Open calendar', kind: 'open_route', route: '/calendar' },
    ],
  }
}

function answerClearMorning(snap: LifeSnapshot): AskReply {
  const morningEvents = snap.todayEvents.filter((e) => {
    if (e.all_day) return true
    return new Date(e.starts_at).getHours() < 12
  })
  const morningTasks = snap.priorityTasks.slice(0, 2)
  if (morningEvents.length === 0 && morningTasks.length === 0) {
    return {
      text: 'Your morning looks open. Protect an hour of quiet focus, or start with one habit check-in.',
      actions: buildBriefingActions(snap),
    }
  }
  const lines: string[] = ['Clear the morning:']
  if (morningEvents.length > 0) lines.push(`Calendar: ${listTitles(morningEvents, 3)}.`)
  if (morningTasks.length > 0) lines.push(`Then: ${listTitles(morningTasks, 2)}.`)
  const actions: AskAction[] = []
  if (morningTasks[0]) {
    actions.push({
      id: createId(),
      label: `Mark “${morningTasks[0].title}” done`,
      kind: 'complete_task',
      taskId: morningTasks[0].id,
    })
  }
  actions.push(...buildBriefingActions(snap).filter((a) => a.kind === 'toggle_habit' || a.kind === 'log_water'))
  return { text: lines.join(' '), actions }
}

function answerJournal(snap: LifeSnapshot): AskReply {
  if (snap.journalToday) {
    return {
      text: 'You’ve already written today. You can open the journal to add more, or save the page for evening close.',
      actions: [{ id: createId(), label: 'Open journal', kind: 'open_route', route: '/journal' }],
    }
  }
  return {
    text: 'A single honest line is enough. Tap below to jot “One thing I’m carrying” into today’s journal, or open the full page.',
    actions: [
      {
        id: createId(),
        label: 'Save a one-line journal',
        kind: 'upsert_journal',
        body: 'One thing I’m carrying from today.',
      },
      { id: createId(), label: 'Open journal', kind: 'open_route', route: '/journal' },
    ],
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
  const bits = [
    `Water today: ${snap.waterGlasses} glass${snap.waterGlasses === 1 ? '' : 'es'}.`,
    `Workouts this week: ${snap.recentWorkouts}. Lifts: ${snap.recentLifts}.`,
  ]
  if (snap.sleepHoursLast > 0) bits.push(`Last sleep logged: ${snap.sleepHoursLast}h.`)
  if (snap.caloriesToday > 0) bits.push(`Meals today: ${snap.caloriesToday} cal.`)
  bits.push(
    snap.waterGlasses < 4 ? 'A glass of water would be a kind next step.' : 'Hydration looks solid.',
  )
  return {
    text: bits.join(' '),
    actions: [
      { id: createId(), label: 'Log a glass of water', kind: 'log_water' },
      { id: createId(), label: 'Open health', kind: 'open_route', route: '/health' },
    ],
  }
}

function answerAboutMe(snap: LifeSnapshot): AskReply {
  const parts: string[] = [
    `Here’s a snapshot of you in Katana, ${snap.name}.`,
    `Today is ${snap.todayLabel}.`,
  ]
  parts.push(
    snap.openTasks.length > 0
      ? `You have ${snap.openTasks.length} open task${snap.openTasks.length === 1 ? '' : 's'}${
          snap.priorityTasks[0] ? `, led by “${snap.priorityTasks[0].title}”` : ''
        }.`
      : 'Your task list is clear.',
  )
  parts.push(
    snap.habitsDue.length > 0
      ? `Habits today: ${snap.habitsDoneIds.length} of ${snap.habitsDue.length} done${
          snap.habitsDue[0] ? ` (${listTitles(snap.habitsDue, 3)})` : ''
        }.`
      : 'No habits set yet — you can add them anytime.',
  )
  if (snap.activeGoals.length > 0) {
    parts.push(
      snap.behindGoals.length > 0
        ? `Active goals: ${listTitles(snap.activeGoals, 3)}. Needs attention: ${listTitles(snap.behindGoals, 2)}.`
        : `Active goals: ${listTitles(snap.activeGoals, 3)} — looking steady.`,
    )
  } else {
    parts.push('No active goals yet.')
  }
  parts.push(
    `Health: ${snap.waterGlasses} glass${snap.waterGlasses === 1 ? '' : 'es'} of water today, ${snap.recentWorkouts} workout${snap.recentWorkouts === 1 ? '' : 's'} and ${snap.recentLifts} lift session${snap.recentLifts === 1 ? '' : 's'} this week${
      snap.caloriesToday > 0 ? `, ${snap.caloriesToday} cal logged today` : ''
    }.`,
  )
  if (snap.journalToday) {
    parts.push(
      snap.journalMood
        ? `You’ve journaled today (mood: ${snap.journalMood}).`
        : 'You’ve journaled today.',
    )
  } else {
    parts.push('No journal entry for today yet.')
  }
  if (snap.todayEvents.length > 0) {
    parts.push(`On the calendar: ${listTitles(snap.todayEvents, 3)}.`)
  }

  return {
    text: parts.join(' '),
    actions: [
      { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
      { id: createId(), label: 'Open goals', kind: 'open_route', route: '/goals' },
      { id: createId(), label: 'Open journal', kind: 'open_route', route: '/journal' },
    ],
  }
}

function answerCapabilities(_snap: LifeSnapshot): AskReply {
  return {
    text: [
      'I’m your local day guide — no cloud AI, just what’s already in Katana.',
      'I can brief your day, suggest what to focus on, help close the evening, prep tomorrow, check habits and goals, and point you to health (water, lifts, sleep, meals).',
      'You can also say things like “add gym tomorrow” or “add a task called call Mom” and I’ll create them.',
      'Ask in your own words — try “tell me about myself,” “what should I work on today,” or “close my day.”',
    ].join(' '),
    actions: [
      { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
      { id: createId(), label: 'Open Health', kind: 'open_route', route: '/health' },
      { id: createId(), label: 'Open Habits', kind: 'open_route', route: '/habits' },
    ],
  }
}

function answerDefault(snap: LifeSnapshot): AskReply {
  const top = snap.priorityTasks[0]
  const hint = top
    ? `If you’re unsure, start with “${top.title}”.`
    : 'If you’re unsure, ask what I can do — or say “briefing” for a fresh overview.'
  return {
    text: `I didn’t catch a specific ask there. ${hint} You can also say “tell me about myself,” “what should I work on today,” “close my day,” or “add gym tomorrow.”`,
    actions: [
      ...(top
        ? [
            {
              id: createId(),
              label: `Finish “${top.title}”`,
              kind: 'complete_task' as const,
              taskId: top.id,
            },
          ]
        : []),
      { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
      { id: createId(), label: 'Daily briefing', kind: 'open_route', route: '/ask?q=briefing' },
    ],
  }
}

export function answerQuestion(userId: string, question: string, displayName?: string): string {
  return answerQuestionWithActions(userId, question, displayName).text
}

type Intent = { test: (q: string) => boolean; answer: (snap: LifeSnapshot) => AskReply }

const INTENTS: Intent[] = [
  {
    test: (q) =>
      q.includes('what can you') ||
      q.includes('what do you do') ||
      q.includes('what are you') ||
      q.includes('your capabilities') ||
      q.includes('how do you work') ||
      (q.includes('help') && (q.includes('what') || q.includes('how') || q === 'help' || q.endsWith(' help'))),
    answer: answerCapabilities,
  },
  {
    test: (q) =>
      q.includes('about myself') ||
      q.includes('about me') ||
      q.includes('who am i') ||
      q.includes('my profile') ||
      q.includes('know about me') ||
      q.includes('tell me about my life'),
    answer: answerAboutMe,
  },
  {
    test: (q) =>
      q.includes('close') ||
      q.includes('evening') ||
      q.includes('wrap up') ||
      q.includes('end my day') ||
      q.includes('end the day'),
    answer: answerCloseDay,
  },
  {
    test: (q) =>
      q.includes('tomorrow') ||
      q.includes('prep') ||
      q.includes('prepare') ||
      (q.includes('ahead') && !q.includes('behind')),
    answer: answerTomorrow,
  },
  {
    test: (q) =>
      q.includes('clear my morning') ||
      q.includes('morning') ||
      (q.includes('clear') && q.includes('am')),
    answer: answerClearMorning,
  },
  {
    test: (q) =>
      q.includes('journal') ||
      q.includes('reflect') ||
      q.includes('write in') ||
      q.includes('diary'),
    answer: answerJournal,
  },
  {
    test: (q) =>
      q.includes('work out') || q.includes('workout') || q.includes('exercise') || q.includes('gym'),
    answer: answerWorkout,
  },
  {
    test: (q) =>
      q.includes('work on') ||
      q.includes('focus') ||
      q.includes('priorit') ||
      q.includes('should i do') ||
      (q.includes('today') && (q.includes('what') || q.includes('should'))),
    answer: answerFocus,
  },
  {
    test: (q) => q.includes('week') || q.includes('summar') || q.includes('review'),
    answer: answerWeek,
  },
  {
    test: (q) => q.includes('goal') || q.includes('behind') || q.includes('falling'),
    answer: answerGoals,
  },
  {
    test: (q) => q.includes('habit'),
    answer: answerHabits,
  },
  {
    test: (q) =>
      q.includes('health') ||
      q.includes('water') ||
      q.includes('sleep') ||
      q.includes('nutrition') ||
      q.includes('lift') ||
      q.includes('meal'),
    answer: answerHealth,
  },
  {
    test: (q) => q.includes('brief') || q.includes('overview') || q.includes('how am i') || q.includes('status'),
    answer: (snap) => ({ text: buildDailyBriefing(snap), actions: briefingActions(snap) }),
  },
]

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

  for (const intent of INTENTS) {
    if (intent.test(q)) return intent.answer(snap)
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
  if (action.kind === 'park_tasks') {
    const tomorrow = addDays(new Date(), 1)
    tomorrow.setHours(17, 0, 0, 0)
    const unfinished = tasksApi.todayTasks(userId)
    for (const task of unfinished) {
      tasksApi.updateTask(userId, task.id, { due_at: tomorrow.toISOString() })
    }
    return unfinished.length
      ? `Parked ${unfinished.length} task${unfinished.length === 1 ? '' : 's'} for tomorrow.`
      : 'Nothing to park.'
  }
  if (action.kind === 'upsert_journal') {
    journalApi.upsert(userId, {
      mood: 'okay',
      body: action.body?.trim() || 'Noted from Ask.',
      reflection: 'Ask',
    })
    return 'Journal updated.'
  }
  if (action.kind === 'close_day') {
    const tomorrow = addDays(new Date(), 1)
    tomorrow.setHours(17, 0, 0, 0)
    const unfinished = tasksApi.todayTasks(userId)
    for (const task of unfinished) {
      tasksApi.updateTask(userId, task.id, { due_at: tomorrow.toISOString() })
    }
    if (action.body?.trim()) {
      journalApi.upsert(userId, {
        mood: 'okay',
        body: action.body.trim(),
        reflection: 'Evening close',
      })
    }
    localStorage.setItem('katana-personal:day-close', todayKey())
    return unfinished.length
      ? `Day closed — parked ${unfinished.length} for tomorrow.`
      : 'Day closed. Rest well.'
  }
  return ''
}

export const SUGGESTED_ASKS = [
  'What should I work on today?',
  'Clear my morning',
  'When should I work out?',
  'Review my week',
  'Prep for tomorrow',
  'Close my day',
  'Add gym tomorrow',
] as const

/** Time-aware chips for Ask — keeps demos feeling alive without an LLM. */
export function suggestedAsksForHour(hour = new Date().getHours()): string[] {
  if (hour < 12) {
    return ['Clear my morning', 'What should I work on today?', 'When should I work out?', 'Add gym tomorrow']
  }
  if (hour < 17) {
    return ['What should I work on today?', 'Review my week', 'Prep for tomorrow', 'When should I work out?']
  }
  return ['Close my day', 'Prep for tomorrow', 'Review my week', 'What should I work on today?']
}

function tryParseCreate(question: string): AskReply | null {
  const q = question.trim()
  const lower = q.toLowerCase()
  const addMatch = lower.match(/^(?:add|remind me to|create|schedule)\s+(.+)$/i)
  if (!addMatch) return null

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
