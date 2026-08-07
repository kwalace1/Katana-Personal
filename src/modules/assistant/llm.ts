import type { AskReply, LifeSnapshot } from './engine'

/** Slim snapshot for the Gemini proxy — titles only, no full records. */
export type CompactLifeSnapshot = {
  name: string
  todayLabel: string
  openTaskTitles: string[]
  todayTaskTitles: string[]
  priorityTaskTitles: string[]
  todayEventTitles: string[]
  upcomingEventTitles: string[]
  habitsOpen: string[]
  habitsDone: string[]
  goalTitles: string[]
  behindGoalTitles: string[]
  journalToday: boolean
  journalMood: string | null
  waterGlasses: number
  sleepHoursLast: number
  caloriesToday: number
  week: {
    label: string
    tasksCompleted: number
    habitDays: number
    workouts: number
    journalEntries: number
  }
}

export function compactSnapshot(snap: LifeSnapshot): CompactLifeSnapshot {
  const done = new Set(snap.habitsDoneIds)
  return {
    name: snap.name,
    todayLabel: snap.todayLabel,
    openTaskTitles: snap.openTasks.slice(0, 8).map((t) => t.title),
    todayTaskTitles: snap.todayTasks.slice(0, 8).map((t) => t.title),
    priorityTaskTitles: snap.priorityTasks.slice(0, 5).map((t) => t.title),
    todayEventTitles: snap.todayEvents.slice(0, 6).map((e) => e.title),
    upcomingEventTitles: snap.upcomingEvents.slice(0, 6).map((e) => e.title),
    habitsOpen: snap.habitsDue.filter((h) => !done.has(h.id)).map((h) => h.title),
    habitsDone: snap.habitsDue.filter((h) => done.has(h.id)).map((h) => h.title),
    goalTitles: snap.activeGoals.slice(0, 5).map((g) => g.title),
    behindGoalTitles: snap.behindGoals.slice(0, 4).map((g) => g.title),
    journalToday: snap.journalToday,
    journalMood: snap.journalMood,
    waterGlasses: snap.waterGlasses,
    sleepHoursLast: snap.sleepHoursLast,
    caloriesToday: snap.caloriesToday,
    week: {
      label: snap.week.label,
      tasksCompleted: snap.week.tasksCompleted,
      habitDays: snap.week.habitCheckInDays,
      workouts: snap.week.workouts + snap.week.lifts,
      journalEntries: snap.week.journalDays,
    },
  }
}

export async function askLlm(
  question: string,
  snapshot: CompactLifeSnapshot,
): Promise<{ text: string; model: string }> {
  const res = await fetch('/api/ask-llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, snapshot }),
  })
  const data = (await res.json().catch(() => null)) as
    | { text?: string; model?: string; error?: string }
    | null
  if (!res.ok) {
    throw new Error(data?.error || `Ask LLM failed (${res.status})`)
  }
  if (!data?.text) {
    throw new Error('Ask LLM returned an empty reply')
  }
  return { text: data.text, model: data.model || 'gemini' }
}

/** Resolve open-ended asks via Gemini; fall back to rules text on failure. */
export async function resolveWithLlm(
  question: string,
  snap: LifeSnapshot,
  fallback: AskReply,
): Promise<AskReply> {
  try {
    const { text } = await askLlm(question, compactSnapshot(snap))
    return {
      text,
      actions: fallback.actions.slice(0, 4),
    }
  } catch {
    return fallback
  }
}
