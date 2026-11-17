import { createId } from '@/lib/id'
import { healthApi } from '@/modules/health/api'
import { formatWater, mlFromAmount, readWaterGoal, readWaterUnit, waterUnitMeta, type WaterUnit } from '@/modules/health/water'
import { bindCommitmentToTask, makeCommitment } from './commitments'
import { buildSnapshot, runAskAction } from './engine'
import type { AskAction } from './ask-api'
import type { AskToolCall } from './ask-llm-types'
import { tasksApi } from '@/modules/tasks/api'

export type AskToolExecResult = {
  toolCallId: string
  name: string
  ok: boolean
  message: string
  action?: AskAction
}

function waterUnitFromArg(value: unknown): WaterUnit | null {
  if (value === 'ml' || value === 'l' || value === 'cup' || value === 'floz') return value
  if (value === 'fl oz' || value === 'oz') return 'floz'
  return null
}

function mlFromWaterArgs(args: Record<string, unknown>): number {
  const unit = waterUnitFromArg(args.unit)
  const amount = typeof args.amount === 'number' ? args.amount : null
  if (unit && amount != null && amount > 0) return mlFromAmount(amount, unit)
  if (typeof args.glasses === 'number' && args.glasses > 0) {
    return Math.min(12, Math.floor(args.glasses)) * 250
  }
  const preferred = readWaterUnit()
  return mlFromAmount(waterUnitMeta(preferred).defaultAmount, preferred)
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || '{}') as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function findTaskId(userId: string, taskId?: string, title?: string): string | null {
  const snap = buildSnapshot(userId)
  if (taskId && snap.openTasks.some((t) => t.id === taskId)) return taskId
  if (title) {
    const lower = title.toLowerCase()
    const exact = snap.openTasks.find((t) => t.title.toLowerCase() === lower)
    if (exact) return exact.id
    const partial = snap.openTasks.find(
      (t) => t.title.toLowerCase().includes(lower) || lower.includes(t.title.toLowerCase()),
    )
    if (partial) return partial.id
  }
  return null
}

function findHabitId(userId: string, habitId?: string, title?: string): string | null {
  const snap = buildSnapshot(userId)
  if (habitId && snap.habitsDue.some((h) => h.id === habitId)) return habitId
  if (title) {
    const lower = title.toLowerCase()
    const exact = snap.habitsDue.find((h) => h.title.toLowerCase() === lower)
    if (exact) return exact.id
    const partial = snap.habitsDue.find(
      (h) => h.title.toLowerCase().includes(lower) || lower.includes(h.title.toLowerCase()),
    )
    if (partial) return partial.id
  }
  return null
}

/** Execute one OpenRouter tool call against local Katana data via runAskAction. */
export function executeAskTool(userId: string, call: AskToolCall): AskToolExecResult {
  const name = call.function?.name || ''
  const args = parseArgs(call.function?.arguments || '{}')
  const toolCallId = call.id || createId()

  try {
    if (name === 'create_task') {
      const title = asString(args.title)
      if (!title) return { toolCallId, name, ok: false, message: 'Missing task title.' }
      const message = runAskAction(userId, {
        id: createId(),
        label: `Add “${title}”`,
        kind: 'create_task',
        title,
        dueAt: asString(args.dueAt) ?? null,
      })
      return {
        toolCallId,
        name,
        ok: true,
        message: message || `Added “${title}”.`,
        action: { id: createId(), label: 'Open Tasks', kind: 'open_route', route: '/tasks' },
      }
    }

    if (name === 'make_commitment') {
      const title = asString(args.title)
      const taskId = asString(args.taskId)
      if (taskId) {
        const task = tasksApi.getTask(userId, taskId)
        if (!task || task.status === 'done') {
          return { toolCallId, name, ok: false, message: 'Could not find that open task to commit to.' }
        }
        bindCommitmentToTask(userId, task.id, task.title)
        return {
          toolCallId,
          name,
          ok: true,
          message: `Holding them to “${task.title}.” Will check back next Ask open.`,
          action: {
            id: createId(),
            label: `Mark “${task.title}” done`,
            kind: 'complete_task',
            taskId: task.id,
          },
        }
      }
      if (!title) return { toolCallId, name, ok: false, message: 'Missing commitment title.' }
      const made = makeCommitment(userId, title)
      return {
        toolCallId,
        name,
        ok: true,
        message: `Commitment locked: “${made.title}” (high priority, due today). Will check back next Ask open.`,
        action: {
          id: createId(),
          label: `Mark “${made.title}” done`,
          kind: 'complete_task',
          taskId: made.taskId,
        },
      }
    }

    if (name === 'drop_commitment') {
      const message = runAskAction(userId, {
        id: createId(),
        label: 'Drop commitment',
        kind: 'drop_commitment',
      })
      return {
        toolCallId,
        name,
        ok: Boolean(message),
        message: message || 'No active commitment to drop.',
      }
    }

    if (name === 'complete_task') {
      const taskId = findTaskId(userId, asString(args.taskId), asString(args.title))
      if (!taskId) return { toolCallId, name, ok: false, message: 'Could not find that open task.' }
      const message = runAskAction(userId, {
        id: createId(),
        label: 'Complete',
        kind: 'complete_task',
        taskId,
      })
      return {
        toolCallId,
        name,
        ok: true,
        message: message || 'Marked done.',
        action: { id: createId(), label: 'Open Tasks', kind: 'open_route', route: '/tasks' },
      }
    }

    if (name === 'toggle_habit') {
      const habitId = findHabitId(userId, asString(args.habitId), asString(args.title))
      if (!habitId) {
        return { toolCallId, name, ok: false, message: 'Could not find that habit for today.' }
      }
      const message = runAskAction(userId, {
        id: createId(),
        label: 'Toggle habit',
        kind: 'toggle_habit',
        habitId,
      })
      return {
        toolCallId,
        name,
        ok: true,
        message: message || 'Habit updated.',
        action: { id: createId(), label: 'Open Habits', kind: 'open_route', route: '/habits' },
      }
    }

    if (name === 'create_habit') {
      const title = asString(args.title)
      if (!title) return { toolCallId, name, ok: false, message: 'Missing habit title.' }
      const message = runAskAction(userId, {
        id: createId(),
        label: `Add habit “${title}”`,
        kind: 'create_habit',
        title,
      })
      return {
        toolCallId,
        name,
        ok: true,
        message: message || `Added habit “${title}”.`,
        action: { id: createId(), label: 'Open Habits', kind: 'open_route', route: '/habits' },
      }
    }

    if (name === 'create_goal') {
      const title = asString(args.title)
      if (!title) return { toolCallId, name, ok: false, message: 'Missing goal title.' }
      const message = runAskAction(userId, {
        id: createId(),
        label: `Add goal “${title}”`,
        kind: 'create_goal',
        title,
        dueAt: asString(args.targetDate) ?? null,
      })
      return {
        toolCallId,
        name,
        ok: true,
        message: message || `Added goal “${title}”.`,
        action: { id: createId(), label: 'Open Goals', kind: 'open_route', route: '/goals' },
      }
    }

    if (name === 'create_event') {
      const title = asString(args.title)
      const startsAt = asString(args.startsAt)
      const endsAt = asString(args.endsAt)
      if (!title || !startsAt || !endsAt) {
        return { toolCallId, name, ok: false, message: 'Need title, startsAt, and endsAt.' }
      }
      const message = runAskAction(userId, {
        id: createId(),
        label: `Schedule “${title}”`,
        kind: 'create_event',
        title,
        startsAt,
        endsAt,
      })
      return {
        toolCallId,
        name,
        ok: true,
        message: message || `Scheduled “${title}”.`,
        action: { id: createId(), label: 'Open Calendar', kind: 'open_route', route: '/calendar' },
      }
    }

    if (name === 'schedule_workout') {
      const title = asString(args.title)
      const preferTomorrow = args.preferTomorrow === true
      const message = runAskAction(userId, {
        id: createId(),
        label: title ? `Schedule “${title}”` : 'Schedule workout',
        kind: 'schedule_workout',
        title,
        body: preferTomorrow ? 'tomorrow' : undefined,
      })
      return {
        toolCallId,
        name,
        ok: Boolean(message),
        message: message || 'Scheduled a workout block.',
        action: { id: createId(), label: 'Open Calendar', kind: 'open_route', route: '/calendar' },
      }
    }

    if (name === 'log_water') {
      const ml = mlFromWaterArgs(args)
      if (ml > 0) healthApi.addVolume(userId, ml, 'ml')
      return {
        toolCallId,
        name,
        ok: ml > 0,
        message: ml > 0 ? `Logged ${formatWater(ml, readWaterGoal().unit)}.` : 'Need an amount and a unit.',
        action: { id: createId(), label: 'Open Health', kind: 'open_route', route: '/health' },
      }
    }

    if (name === 'upsert_journal') {
      const body = asString(args.body) || 'Noted from Ask.'
      const message = runAskAction(userId, {
        id: createId(),
        label: 'Journal',
        kind: 'upsert_journal',
        body,
      })
      return {
        toolCallId,
        name,
        ok: true,
        message: message || 'Journal updated.',
        action: { id: createId(), label: 'Open Journal', kind: 'open_route', route: '/journal' },
      }
    }

    if (name === 'park_tasks') {
      const message = runAskAction(userId, {
        id: createId(),
        label: 'Park tasks',
        kind: 'park_tasks',
      })
      return { toolCallId, name, ok: true, message: message || 'Parked tasks.' }
    }

    if (name === 'close_day') {
      const message = runAskAction(userId, {
        id: createId(),
        label: 'Close day',
        kind: 'close_day',
        body: asString(args.note),
      })
      return {
        toolCallId,
        name,
        ok: true,
        message: message || 'Day closed.',
        action: { id: createId(), label: 'Open Today', kind: 'open_route', route: '/dashboard' },
      }
    }

    return { toolCallId, name, ok: false, message: `Unknown tool: ${name}` }
  } catch (err) {
    return {
      toolCallId,
      name,
      ok: false,
      message: err instanceof Error ? err.message : 'Tool failed.',
    }
  }
}

export function executeAskTools(userId: string, calls: AskToolCall[]): AskToolExecResult[] {
  return calls.map((c) => executeAskTool(userId, c))
}
