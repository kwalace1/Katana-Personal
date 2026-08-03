/**
 * PM task import from CSV/XLSX: column detection and bulk addTask.
 */

import type { ParsedSheet } from '@/lib/file-parse-utils'
import type { Task } from '@/lib/project-data'
import { addTask } from '@/lib/project-data-supabase'
import { dateKeyDaysFromNow, toDateKey } from '@/lib/due-date-utils'

export interface PmTaskColumnMapping {
  title: number
  status?: number
  priority?: number
  assignee?: number
  deadline?: number
  description?: number
}

const HEADER_ALIASES: Record<keyof PmTaskColumnMapping, string[]> = {
  title: ['title', 'task', 'name', 'summary', 'work item'],
  status: ['status', 'state', 'column'],
  priority: ['priority', 'prio', 'severity'],
  assignee: ['assignee', 'owner', 'assigned', 'assigned to', 'who'],
  deadline: ['deadline', 'due', 'due date', 'target date', 'end'],
  description: ['description', 'details', 'notes', 'body'],
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

export function detectPmTaskMapping(headers: string[]): PmTaskColumnMapping {
  const normalized = headers.map(normHeader)
  const findIdx = (aliases: string[]): number => {
    for (let i = 0; i < normalized.length; i++) {
      const h = normalized[i]
      if (aliases.some((a) => h === a || h.includes(a))) return i
    }
    return -1
  }
  const keys = Object.keys(HEADER_ALIASES) as (keyof PmTaskColumnMapping)[]
  const acc: Partial<PmTaskColumnMapping> = {}
  for (const key of keys) {
    acc[key] = findIdx(HEADER_ALIASES[key].map(normHeader))
  }
  const mapping = acc as PmTaskColumnMapping
  if (mapping.title < 0 && normalized.length > 0) mapping.title = 0
  return mapping
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return ''
  return (row[idx] ?? '').trim()
}

const STATUS_MAP: Record<string, Task['status']> = {
  backlog: 'backlog',
  todo: 'todo',
  'to do': 'todo',
  'in progress': 'in-progress',
  inprogress: 'in-progress',
  doing: 'in-progress',
  review: 'review',
  blocked: 'blocked',
  done: 'done',
  complete: 'done',
  completed: 'done',
}

const PRIORITY_MAP: Record<string, Task['priority']> = {
  low: 'low',
  medium: 'medium',
  med: 'medium',
  normal: 'medium',
  high: 'high',
  urgent: 'high',
}

function parseStatus(raw: string): Task['status'] {
  const k = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  return STATUS_MAP[k.replace(/ /g, '')] ?? STATUS_MAP[k] ?? 'todo'
}

function parsePriority(raw: string): Task['priority'] {
  const k = raw.trim().toLowerCase()
  return PRIORITY_MAP[k] ?? 'medium'
}

function defaultDeadline(): string {
  return dateKeyDaysFromNow(14)
}

function normalizeDeadline(raw: string): string {
  const t = raw.trim()
  if (!t) return defaultDeadline()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) return toDateKey(d)
  return defaultDeadline()
}

export type PmImportPreviewRow = { title: string; status: Task['status']; priority: Task['priority']; assignee: string; deadline: string; description: string }

export function buildPmImportPreview(sheet: ParsedSheet, mapping: PmTaskColumnMapping, maxRows = 12): PmImportPreviewRow[] {
  const out: PmImportPreviewRow[] = []
  for (let r = 0; r < sheet.rows.length && out.length < maxRows; r++) {
    const row = sheet.rows[r]
    const title = cell(row, mapping.title)
    if (!title) continue
    const statusRaw = mapping.status != null && mapping.status >= 0 ? cell(row, mapping.status) : ''
    const prioRaw = mapping.priority != null && mapping.priority >= 0 ? cell(row, mapping.priority) : ''
    out.push({
      title,
      status: parseStatus(statusRaw),
      priority: parsePriority(prioRaw),
      assignee: mapping.assignee != null && mapping.assignee >= 0 ? cell(row, mapping.assignee) : '',
      deadline:
        mapping.deadline != null && mapping.deadline >= 0 ? normalizeDeadline(cell(row, mapping.deadline)) : defaultDeadline(),
      description:
        mapping.description != null && mapping.description >= 0 ? cell(row, mapping.description) : '',
    })
  }
  return out
}

export interface PmImportResult {
  created: number
  skipped: number
  errors: string[]
}

export async function executePmTaskImport(
  projectId: string,
  sheet: ParsedSheet,
  mapping: PmTaskColumnMapping,
): Promise<PmImportResult> {
  const errors: string[] = []
  let created = 0
  let skipped = 0

  for (let r = 0; r < sheet.rows.length; r++) {
    const row = sheet.rows[r]
    const title = cell(row, mapping.title)
    if (!title) {
      skipped++
      continue
    }
    const statusRaw = mapping.status != null && mapping.status >= 0 ? cell(row, mapping.status) : ''
    const prioRaw = mapping.priority != null && mapping.priority >= 0 ? cell(row, mapping.priority) : ''
    const assigneeName = mapping.assignee != null && mapping.assignee >= 0 ? cell(row, mapping.assignee) : ''
    const deadline =
      mapping.deadline != null && mapping.deadline >= 0 ? normalizeDeadline(cell(row, mapping.deadline)) : defaultDeadline()
    const description =
      mapping.description != null && mapping.description >= 0 ? cell(row, mapping.description) : ''

    const task: Omit<Task, 'id'> = {
      title,
      status: parseStatus(statusRaw),
      priority: parsePriority(prioRaw),
      assignee: { name: assigneeName, avatar: '' },
      deadline,
      progress: 0,
      description: description || undefined,
    }

    try {
      const t = await addTask(projectId, task)
      if (t) created++
      else {
        skipped++
        errors.push(`Row ${r + 2}: addTask returned null`)
      }
    } catch (e) {
      errors.push(`Row ${r + 2}: ${e instanceof Error ? e.message : 'failed'}`)
      skipped++
    }
  }

  return { created, skipped, errors }
}
