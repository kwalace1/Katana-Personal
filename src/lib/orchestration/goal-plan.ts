import { addDays } from '@/lib/dates'
import { createId } from '@/lib/id'
import type { LifeSnapshot } from '@/modules/assistant/engine'
import type { AskAction } from '@/modules/assistant/ask-api'
import type { AskReply } from '@/modules/assistant/engine'
import { habitsApi } from '@/modules/habits/api'
import { isWorkoutHabit } from './workout-plan'

export interface ParsedGoalIntent {
  title: string
  targetDate: string | null
  category: 'fitness' | 'health' | 'general'
  targetAmount?: number
  unit?: string
}

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
}

function parseTargetDate(q: string, now = new Date()): string | null {
  const byMonth = q.match(/\bby\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b(?:\s+(\d{4}))?/i)
  if (byMonth) {
    const month = MONTHS[byMonth[1]!.toLowerCase()]
    if (month == null) return null
    const year = byMonth[2] ? Number(byMonth[2]) : now.getFullYear()
    const end = new Date(year, month + 1, 0)
    if (end.getTime() < now.getTime() && !byMonth[2]) {
      end.setFullYear(year + 1)
    }
    return end.toISOString().slice(0, 10)
  }

  const iso = q.match(/\bby\s+(\d{4}-\d{2}-\d{2})\b/)
  if (iso) return iso[1]!

  const inMonths = q.match(/\bin\s+(\d+)\s+months?\b/)
  if (inMonths) {
    return addDays(now, Number(inMonths[1]) * 30).toISOString().slice(0, 10)
  }

  return null
}

export function parseGoalIntent(q: string): ParsedGoalIntent | null {
  const lower = q.toLowerCase()

  const lose = lower.match(/(?:lose|drop|shed)\s+(\d+(?:\.\d+)?)\s*(pounds?|lbs?|kg|kilos?)/)
  if (lose) {
    const targetDate = parseTargetDate(lower)
    return {
      title: `Lose ${lose[1]} ${lose[2]!.startsWith('k') ? 'kg' : 'lbs'}`,
      targetDate,
      category: 'fitness',
      targetAmount: Number(lose[1]),
      unit: lose[2]!.startsWith('k') ? 'kg' : 'lbs',
    }
  }

  const run = lower.match(/(?:run|complete|do)\s+(?:a\s+)?(\d+k|\d+\s*mile|marathon|half marathon)/)
  if (run || lower.includes('5k') || lower.includes('10k')) {
    const label = run?.[1] || (lower.includes('10k') ? '10K' : '5K')
    return {
      title: `Train for ${label.toUpperCase()}`,
      targetDate: parseTargetDate(lower),
      category: 'fitness',
    }
  }

  const generic =
    lower.includes('help me reach') ||
    lower.includes('plan for') ||
    lower.includes('want to') ||
    lower.includes('goal to') ||
    (lower.includes('by ') && (lower.includes('december') || lower.includes('march') || lower.includes('goal')))

  if (generic) {
    const quoted = q.match(/["“](.+?)["”]/)
    const title = quoted?.[1]?.trim() || 'Personal goal'
    return {
      title,
      targetDate: parseTargetDate(lower),
      category: lower.match(/weight|gym|workout|fit|run|lift/) ? 'fitness' : 'general',
    }
  }

  return null
}

export function buildGoalPlanReply(userId: string, snap: LifeSnapshot, q: string): AskReply | null {
  const intent = parseGoalIntent(q)
  if (!intent) return null

  const existing = snap.activeGoals.find((g) =>
    g.title.toLowerCase().includes(intent.title.toLowerCase().slice(0, 12)),
  )
  const gymHabit = habitsApi.list(userId).find(isWorkoutHabit)
  const dateLine = intent.targetDate ? ` by ${intent.targetDate}` : ''

  const lines: string[] = []
  if (existing) {
    lines.push(`You already have “${existing.title}.” I'll keep nudging you on pace${dateLine || '.'}`)
  } else {
    lines.push(`Here's a plan around your actual life for “${intent.title}”${dateLine}:`)
    if (intent.category === 'fitness') {
      lines.push('Three movement days per week, log weight weekly, and one small task each week to stay honest.')
    } else {
      lines.push('One weekly check-in and a small next step each week — no giant overhaul.')
    }
  }

  const actions: AskAction[] = []

  if (!existing) {
    actions.push({
      id: createId(),
      label: `Add goal: ${intent.title}`,
      kind: 'create_goal',
      title: intent.title,
      dueAt: intent.targetDate,
    })
  }

  if (intent.category === 'fitness' && !gymHabit) {
    actions.push({
      id: createId(),
      label: 'Add Gym habit (3× week)',
      kind: 'create_habit',
      title: 'Gym',
    })
  } else if (gymHabit) {
    actions.push({
      id: createId(),
      label: `Check in “${gymHabit.title}” today`,
      kind: 'toggle_habit',
      habitId: gymHabit.id,
    })
  }

  actions.push({
    id: createId(),
    label: 'Weekly weigh-in task',
    kind: 'create_task',
    title: 'Log body weight',
    dueAt: addDays(new Date(), 7).toISOString(),
  })

  actions.push({ id: createId(), label: 'Open Health', kind: 'open_route', route: '/health' })

  return { text: lines.join(' '), actions: actions.slice(0, 4) }
}

export function isGoalPlanQuestion(q: string): boolean {
  const lower = q.toLowerCase()
  return (
    parseGoalIntent(lower) != null ||
    lower.includes('lose ') ||
    lower.includes('plan to') ||
    lower.includes('help me get to') ||
    (lower.includes('pounds') && lower.includes('by'))
  )
}
