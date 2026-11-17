/**
 * Canonical Ask LLM types + tool definitions.
 * Imported by the client (`llm.ts`) and the API (`api/ask-llm-core.ts`) so they cannot drift.
 */

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

export type CompactCommitment = {
  id: string
  taskId: string
  title: string
  createdAt: string
}

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
  /** Daily water goal in milliliters, when the client knows it. */
  waterGoalMl?: number
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
  /** Sparse-context signal for LLM */
  contextGapLabels?: string[]
  richnessScore?: number
  /** Active accountability commitment, when present. */
  activeCommitment?: CompactCommitment | null
  /** From PersonalContext.workload — optional Phase 1+ signal */
  workloadLevel?: 'light' | 'moderate' | 'heavy'
  freeMinutes?: number
  conflictLabels?: string[]
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

/** OpenRouter / Gemini tool schemas — executed client-side via executeAskTool. */
export const ASK_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'create_task',
      description: 'Create a new task in Katana.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          dueAt: { type: 'string', description: 'Optional ISO-8601 or YYYY-MM-DD due date' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'make_commitment',
      description:
        'Hold the user accountable to something: create a high-priority task due today and register it as the active Ask commitment (checked on next Ask open). Prefer this over create_task when they say hold me to / make me / don’t let me skip.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'What to hold them to' },
          taskId: {
            type: 'string',
            description: 'Optional existing open task id from the snapshot to bind instead of creating a new task',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'drop_commitment',
      description:
        'Drop the active Ask commitment without deleting the underlying task. Use when the user asks to cancel or drop the commitment.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'complete_task',
      description: 'Mark an open task done. Prefer taskId from the snapshot; title match is ok.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          title: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'toggle_habit',
      description: 'Check or uncheck a habit due today.',
      parameters: {
        type: 'object',
        properties: {
          habitId: { type: 'string' },
          title: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_habit',
      description: 'Create a new daily habit.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_goal',
      description: 'Create a new goal (default quarterly horizon).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          targetDate: { type: 'string', description: 'Optional ISO-8601 or YYYY-MM-DD target date' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_event',
      description: 'Schedule a calendar event.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          startsAt: { type: 'string', description: 'ISO-8601 start' },
          endsAt: { type: 'string', description: 'ISO-8601 end' },
        },
        required: ['title', 'startsAt', 'endsAt'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'schedule_workout',
      description:
        'Block a workout on the calendar using the user’s plan and free gaps. Prefer this over create_event for movement.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Optional workout label override' },
          preferTomorrow: {
            type: 'boolean',
            description: 'When true, prefer a tomorrow-morning slot',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'log_water',
      description: 'Log drinking water by volume. Use the person’s unit when they name one.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'How much to add' },
          unit: { type: 'string', enum: ['ml', 'floz', 'cup', 'l'], description: 'mL, fl oz, cup, or L' },
        },
        required: ['amount', 'unit'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'upsert_journal',
      description: 'Write or update today’s journal entry.',
      parameters: {
        type: 'object',
        properties: {
          body: { type: 'string' },
          mood: { type: 'string', enum: ['great', 'good', 'okay', 'low', 'rough'] },
        },
        required: ['body'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'park_tasks',
      description: 'Move unfinished today tasks to tomorrow.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'close_day',
      description: 'Close the day: park leftover tasks and optionally journal a note.',
      parameters: {
        type: 'object',
        properties: {
          note: { type: 'string' },
        },
      },
    },
  },
] as const

export const ASK_TOOL_NAMES = ASK_TOOL_DEFINITIONS.map((t) => t.function.name)

export type AskToolName = (typeof ASK_TOOL_NAMES)[number]
