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
import { buildWeekStats, type WeekStats } from '@/lib/week-review'
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
  week: WeekStats
}

export interface AskReply {
  text: string
  actions: AskAction[]
  /** When true, Ask UI should try Gemini for a richer open-ended reply. */
  useLlm?: boolean
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
    week: buildWeekStats(userId, today),
  }
}

function listTitles(items: { title: string }[], limit = 4): string {
  if (items.length === 0) return 'none'
  return items
    .slice(0, limit)
    .map((i) => i.title)
    .join(', ')
}

/** Keep Ask replies scannable — a few short sentences. */
function keepShort(sentences: string[], max = 3): string {
  return sentences.filter(Boolean).slice(0, max).join(' ')
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
  const w = snap.week
  const bits: string[] = []
  bits.push(`Week of ${w.label}.`)
  bits.push(
    w.tasksCompleted > 0
      ? `You finished ${w.tasksCompleted} task${w.tasksCompleted === 1 ? '' : 's'} this week.`
      : 'No tasks marked done this week yet.',
  )
  bits.push(
    w.habitCheckInDays > 0
      ? `Habits checked in on ${w.habitCheckInDays} day${w.habitCheckInDays === 1 ? '' : 's'}.`
      : 'No habit check-ins logged this week.',
  )
  const movement = w.workouts + w.lifts
  bits.push(
    movement > 0
      ? `Movement: ${w.workouts} workout${w.workouts === 1 ? '' : 's'}, ${w.lifts} lift session${w.lifts === 1 ? '' : 's'}.`
      : 'No workouts or lifts logged this week yet.',
  )
  if (w.journalDays > 0) {
    bits.push(`Journal on ${w.journalDays} day${w.journalDays === 1 ? '' : 's'}.`)
  }
  bits.push(
    snap.upcomingEvents.length > 0
      ? `Coming up: ${listTitles(snap.upcomingEvents, 4)}.`
      : 'The calendar ahead looks light.',
  )
  if (snap.behindGoals.length > 0) {
    bits.push(`Goals needing love: ${listTitles(snap.behindGoals, 3)}.`)
  }
  if (w.lookAhead) bits.push(w.lookAhead)

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
    text: keepShort([
      'I brief your day, focus you, and can take small actions — add a task or event, check a habit, log water, park work, or close the evening.',
      'Say what you need, like “add Call Mom Friday 3pm,” and I’ll draft it for you to confirm.',
      'I can also point you to Friends, Shared, or Circles.',
    ]),
    actions: [
      { id: createId(), label: 'What should I work on?', kind: 'open_route', route: '/ask?q=What%20should%20I%20work%20on%20today' },
      { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
      { id: createId(), label: 'Invite a friend', kind: 'open_route', route: '/friends' },
    ],
  }
}

function answerTogether(q: string): AskReply {
  if (
    q.includes('invite') ||
    q.includes('friend') ||
    q.includes('add me') ||
    q.includes('accountable') ||
    q.includes('accountability')
  ) {
    return {
      text: keepShort([
        'Together starts with friends.',
        'Connect cloud if needed, then share your Add-me link from Today or Friends.',
      ]),
      actions: [
        { id: createId(), label: 'Invite a friend', kind: 'open_route', route: '/friends' },
        { id: createId(), label: 'Open Shared', kind: 'open_route', route: '/shared' },
      ],
    }
  }
  if (q.includes('shared') || q.includes('share')) {
    return {
      text: keepShort([
        'Shared is a plans inbox you copy into your tasks.',
        'Circle Schedule is what shows on Calendar.',
      ]),
      actions: [
        { id: createId(), label: 'Open Shared', kind: 'open_route', route: '/shared' },
        { id: createId(), label: 'Share from Tasks', kind: 'open_route', route: '/tasks' },
      ],
    }
  }
  return {
    text: keepShort([
      'Circles are streak boards and optional 7-day challenges.',
      'Check in on habits and water — they sync when cloud is on.',
    ]),
    actions: [
      { id: createId(), label: 'Open Circles', kind: 'open_route', route: '/circles' },
      { id: createId(), label: 'Open Friends', kind: 'open_route', route: '/friends' },
    ],
  }
}

function answerAttention(snap: LifeSnapshot): AskReply {
  const items: string[] = []
  const actions: AskAction[] = []

  const pendingHabits = snap.habitsDue.filter((h) => !snap.habitsDoneIds.includes(h.id))
  if (pendingHabits.length > 0) {
    items.push(
      `${pendingHabits.length} habit${pendingHabits.length === 1 ? '' : 's'} still open: ${listTitles(pendingHabits, 4)}.`,
    )
    actions.push({
      id: createId(),
      label: `Check in “${pendingHabits[0].title}”`,
      kind: 'toggle_habit',
      habitId: pendingHabits[0].id,
    })
  }

  if (snap.behindGoals.length > 0) {
    items.push(`Goals needing attention: ${listTitles(snap.behindGoals, 3)}.`)
    actions.push({
      id: createId(),
      label: `Open “${snap.behindGoals[0].title}”`,
      kind: 'open_route',
      route: `/goals?id=${snap.behindGoals[0].id}`,
    })
  }

  if (snap.priorityTasks.length > 0) {
    items.push(
      `Priority task${snap.priorityTasks.length === 1 ? '' : 's'}: ${listTitles(snap.priorityTasks, 3)}.`,
    )
    actions.push({
      id: createId(),
      label: `Mark “${snap.priorityTasks[0].title}” done`,
      kind: 'complete_task',
      taskId: snap.priorityTasks[0].id,
    })
  } else if (snap.todayTasks.length > 0) {
    items.push(`Due today: ${listTitles(snap.todayTasks, 3)}.`)
  } else if (snap.openTasks.length > 0) {
    items.push(`${snap.openTasks.length} open task${snap.openTasks.length === 1 ? '' : 's'} waiting.`)
    actions.push({ id: createId(), label: 'Open tasks', kind: 'open_route', route: '/tasks' })
  }

  if (snap.waterGlasses < 6) {
    items.push(`Water is at ${snap.waterGlasses}/6 glasses for your Circles streak.`)
    actions.push({ id: createId(), label: 'Log a glass of water', kind: 'log_water' })
  }

  if (!snap.journalToday) {
    items.push('No journal entry for today yet.')
    actions.push({ id: createId(), label: 'Open journal', kind: 'open_route', route: '/journal' })
  }

  if (snap.todayEvents.length > 0) {
    items.push(`On the calendar today: ${listTitles(snap.todayEvents, 3)}.`)
  }

  if (items.length === 0) {
    return {
      text: keepShort([
        'Nothing major needing attention — habits, tasks, and goals look settled.',
        'Enjoy the calm, or capture something small.',
      ]),
      actions: [
        { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
        { id: createId(), label: 'Add a task', kind: 'open_route', route: '/tasks' },
      ],
    }
  }

  return {
    text: keepShort(
      [`Here’s what needs attention:`, ...items.map((line, i) => `${i + 1}. ${line}`)],
      5,
    ),
    actions: actions.slice(0, 4),
  }
}

function answerGreeting(snap: LifeSnapshot): AskReply {
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Hi' : 'Good evening'
  const attn = answerAttention(snap)
  const calm = attn.text.startsWith('Nothing major')
    ? keepShort([`${hello}, ${snap.name}.`, 'You’re in good shape today — nothing urgent jumping out.'])
    : keepShort([`${hello}, ${snap.name}.`, attn.text.split('\n')[0] || attn.text])
  return {
    text: calm,
    actions: attn.actions.slice(0, 3),
  }
}

function answerThanks(_snap: LifeSnapshot): AskReply {
  return {
    text: keepShort(['You’re welcome.', 'Ask for a briefing, a focus list, or help closing the day anytime.']),
    actions: [
      { id: createId(), label: 'What’s needing attention?', kind: 'open_route', route: '/ask?q=what%20needs%20attention' },
      { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
    ],
  }
}

function answerDefault(snap: LifeSnapshot): AskReply {
  const attn = answerAttention(snap)
  return {
    text: keepShort([attn.text.split('\n')[0] || attn.text, 'Or ask for a briefing, focus list, or “what can you do.”']),
    actions: attn.actions.slice(0, 4),
  }
}

export function answerQuestion(userId: string, question: string, displayName?: string): string {
  return answerQuestionWithActions(userId, question, displayName).text
}

type Intent = { test: (q: string) => boolean; answer: (snap: LifeSnapshot, q: string) => AskReply }

function isGreeting(q: string): boolean {
  const cleaned = q.replace(/[!?.,]+$/g, '').trim()
  return /^(hi|hey|hello|yo|sup|hiya|howdy|good morning|good afternoon|good evening|morning|evening)(\s+there)?$/.test(
    cleaned,
  )
}

const INTENTS: Intent[] = [
  {
    test: (q) => isGreeting(q),
    answer: answerGreeting,
  },
  {
    test: (q) =>
      q.includes('thank') || q === 'ty' || q === 'thx' || q.includes('appreciate'),
    answer: answerThanks,
  },
  {
    test: (q) =>
      q.includes('what can you') ||
      q.includes('what do you do') ||
      q.includes('what are you') ||
      q.includes('your capabilities') ||
      q.includes('how do you work') ||
      q === 'help' ||
      q === 'commands' ||
      (q.includes('help') && (q.includes('what') || q.includes('how') || q.endsWith(' help'))),
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
      q.includes('friend') ||
      q.includes('invite') ||
      q.includes('circle') ||
      q.includes('shared') ||
      q.includes('together') ||
      q.includes('accountable') ||
      q.includes('accountability') ||
      q.includes('leaderboard') ||
      q.includes('challenge') ||
      (q.includes('share') && (q.includes('what') || q.includes('with') || q.includes('plan'))),
    answer: (_snap, q) => answerTogether(q),
  },
  {
    test: (q) =>
      q.includes('attention') ||
      q.includes('need attention') ||
      q.includes('needing attention') ||
      q.includes('catch me up') ||
      q.includes('catch up') ||
      q.includes('what did i miss') ||
      q.includes('what am i missing') ||
      q.includes('outstanding') ||
      q.includes('left to do') ||
      q.includes('still open') ||
      q.includes('loose end') ||
      q.includes('am i behind') ||
      q.includes('falling behind') ||
      q.includes('what needs') ||
      q.includes('anything need') ||
      q.includes('anything i need') ||
      q.includes('anything i should') ||
      q.includes('what should i know') ||
      q.includes('what’s left') ||
      q.includes("what's left") ||
      q.includes('whats left') ||
      q.includes('pending') ||
      (q.includes('open') && (q.includes('item') || q.includes('task') || q.includes('what'))),
    answer: answerAttention,
  },
  {
    test: (q) =>
      q.includes('close') ||
      q.includes('wrap up') ||
      q.includes('end my day') ||
      q.includes('end the day') ||
      (q.includes('evening') && (q.includes('close') || q.includes('wrap') || q.includes('end'))),
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
      q.includes('clear the morning') ||
      (q.includes('morning') && (q.includes('clear') || q.includes('plan') || q.includes('start'))),
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
      q.includes('what next') ||
      q.includes('what’s next') ||
      q.includes("what's next") ||
      q.includes('whats next') ||
      q.includes('to do') ||
      q.includes('todo') ||
      q.includes('get done') ||
      q.includes('most important') ||
      (q.includes('today') && (q.includes('what') || q.includes('should') || q.includes('do'))),
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
      q.includes('meal') ||
      q.includes('hydrat'),
    answer: answerHealth,
  },
  {
    test: (q) =>
      q.includes('task') ||
      q.includes('to-do') ||
      q.includes('checklist'),
    answer: answerFocus,
  },
  {
    test: (q) =>
      q.includes('calendar') ||
      q.includes('schedule') ||
      q.includes('event') ||
      q.includes('meeting') ||
      q.includes('what’s on') ||
      q.includes("what's on") ||
      q.includes('whats on'),
    answer: (snap) => {
      if (snap.todayEvents.length === 0 && snap.upcomingEvents.length === 0) {
        return {
          text: 'Your calendar is clear — nothing scheduled soon.',
          actions: [{ id: createId(), label: 'Open calendar', kind: 'open_route', route: '/calendar' }],
        }
      }
      if (snap.todayEvents.length > 0) {
        return {
          text: `Today: ${listTitles(snap.todayEvents, 5)}.${
            snap.upcomingEvents.length > snap.todayEvents.length
              ? ` Coming up next: ${listTitles(
                  snap.upcomingEvents.filter((e) => !snap.todayEvents.some((t) => t.id === e.id)),
                  3,
                )}.`
              : ''
          }`,
          actions: [{ id: createId(), label: 'Open calendar', kind: 'open_route', route: '/calendar' }],
        }
      }
      return {
        text: `Nothing today. Next up: ${listTitles(snap.upcomingEvents, 4)}.`,
        actions: [{ id: createId(), label: 'Open calendar', kind: 'open_route', route: '/calendar' }],
      }
    },
  },
  {
    test: (q) =>
      q.includes('brief') ||
      q.includes('overview') ||
      q.includes('how am i') ||
      q.includes('status') ||
      q.includes('how’s my day') ||
      q.includes("how's my day") ||
      q.includes('how is my day') ||
      q.includes('update me') ||
      q.includes('fill me in'),
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
    if (intent.test(q)) return intent.answer(snap, q)
  }

  return { ...answerDefault(snap), useLlm: true }
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
  'Invite a friend',
  'What’s shared with me?',
  'How are my Circles?',
  'Add gym tomorrow',
] as const

/** Time-aware chips for Ask — keeps demos feeling alive without an LLM. */
export function suggestedAsksForHour(hour = new Date().getHours()): string[] {
  if (hour < 12) {
    return ['Clear my morning', 'What should I work on today?', 'Invite a friend']
  }
  if (hour < 17) {
    return ['What should I work on today?', 'What’s shared with me?', 'How are my Circles?']
  }
  return ['Close my day', 'Prep for tomorrow', 'How are my Circles?']
}

function tryParseCreate(question: string): AskReply | null {
  const q = question.trim()
  const lower = q.toLowerCase()

  // Intent without a title yet — teach the actionable phrase
  if (
    /^(?:i want to |i'?d like to |can you |could you |please )?(?:create|make|add|new)\s+(?:a\s+)?(?:new\s+)?(?:task|reminder|todo)s?\s*[?.!]*$/i.test(
      lower,
    ) ||
    /^(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?(?:task|reminder|todo)\s*[?.!]*$/i.test(lower)
  ) {
    return {
      text: keepShort([
        'Sure — tell me what it is.',
        'Try “add Call Mom Friday 3pm” or “create buy groceries tomorrow.” I’ll draft it and you tap to confirm.',
      ]),
      actions: [
        {
          id: createId(),
          label: 'Try “add Call Mom Friday 3pm”',
          kind: 'open_route',
          route: '/ask?q=add%20Call%20Mom%20Friday%203pm',
        },
        { id: createId(), label: 'Open Tasks', kind: 'open_route', route: '/tasks' },
      ],
    }
  }

  const addMatch = lower.match(
    /^(?:i want to |i'?d like to |can you |could you |please )?(?:add|remind me to|create|schedule|make|new task:?)\s+(?:a\s+)?(?:new\s+)?(?:task|reminder|todo|event)?\s*(?:for|to|called|titled|:)?\s*(.+)$/i,
  )
  if (!addMatch?.[1]) {
    const simple = lower.match(/^(?:add|remind me to|create|schedule|make)\s+(.+)$/i)
    if (!simple?.[1]) return null
    return parseCreatePayload(q, simple[1], lower)
  }

  let raw = addMatch[1].trim()
  // Drop leftover "a task" / "task:" prefixes if the regex left them
  raw = raw.replace(/^(?:a\s+)?(?:new\s+)?(?:task|reminder|todo|event)\s*(?:for|to|called|titled|:)?\s*/i, '').trim()
  if (!raw || /^(?:a\s+)?(?:task|reminder|todo|event)s?$/i.test(raw)) {
    return {
      text: keepShort([
        'What should I call it?',
        'Say “add [title]” — optional day/time like Friday 3pm.',
      ]),
      actions: [{ id: createId(), label: 'Open Tasks', kind: 'open_route', route: '/tasks' }],
    }
  }

  return parseCreatePayload(q, raw, lower)
}

function parseCreatePayload(original: string, raw: string, lower: string): AskReply | null {
  const isEvent =
    lower.startsWith('schedule') ||
    lower.includes(' meeting') ||
    lower.includes(' appointment') ||
    lower.includes(' event') ||
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
    text: `I can add “${parsed.title}”${parsed.dueAt ? ` · ${parsed.summary.replace(/^Task · [^·]+ · /, '')}` : ''}. Tap to confirm.`,
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
