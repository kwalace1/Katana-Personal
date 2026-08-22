/** Client-side Ask LLM types (mirrors api/ask-llm-core — keep in sync). */

export type CompactTask = { id: string; title: string; dueAt?: string | null }
export type CompactHabit = { id: string; title: string; done: boolean }
export type CompactGoal = {
  id: string
  title: string
  progress: number
  target: number
  horizon: string
}
export type CompactEvent = { title: string; startsAt: string; allDay?: boolean }
export type CompactJournal = { date: string; mood: string | null; excerpt: string }

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
  openTasks?: CompactTask[]
  todayTasks?: CompactTask[]
  priorityTasks?: CompactTask[]
  habits?: CompactHabit[]
  goals?: CompactGoal[]
  behindGoals?: CompactGoal[]
  todayEvents?: CompactEvent[]
  upcomingEvents?: CompactEvent[]
  recentJournal?: CompactJournal[]
}

export type AskToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type AskChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_call_id?: string
  name?: string
  tool_calls?: AskToolCall[]
}
