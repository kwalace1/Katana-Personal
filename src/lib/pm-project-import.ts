/**
 * Import a full PM project from XLSX/CSV: optional Project sheet + Tasks sheet,
 * or a single sheet of tasks with metadata from the UI.
 */

import type { ParsedSheet } from '@/lib/file-parse-utils'
import type { Project } from '@/lib/project-data'
import {
  detectPmTaskMapping,
  executePmTaskImport,
  buildPmImportPreview,
  type PmTaskColumnMapping,
  type PmImportPreviewRow,
} from '@/lib/pm-file-import'
import { createProject, updateProject } from '@/lib/project-data-supabase'
import { dateKeyDaysFromNow, toDateKey } from '@/lib/due-date-utils'

export interface ParsedProjectMeta {
  name: string
  status: Project['status']
  deadline: string
  description?: string
  ownerName?: string
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return ''
  return (row[idx] ?? '').trim()
}

const PROJECT_NAME_ALIASES = ['project_name', 'project', 'name', 'title', 'initiative']
const PROJECT_STATUS_ALIASES = ['status', 'project_status', 'state']
const PROJECT_DEADLINE_ALIASES = ['deadline', 'due', 'due_date', 'target_date', 'end_date']
const PROJECT_DESC_ALIASES = ['description', 'summary', 'notes', 'details']
const PROJECT_OWNER_ALIASES = ['owner', 'project_owner', 'lead', 'manager']

function findColIdx(normalizedHeaders: string[], aliases: string[]): number {
  for (const a of aliases) {
    const i = normalizedHeaders.findIndex((h) => h === a || h.includes(a))
    if (i >= 0) return i
  }
  return -1
}

function parseProjectRow(headers: string[], row: string[]): Partial<ParsedProjectMeta> {
  const nh = headers.map(normHeader)
  const ni = findColIdx(nh, PROJECT_NAME_ALIASES.map(normHeader))
  const si = findColIdx(nh, PROJECT_STATUS_ALIASES.map(normHeader))
  const di = findColIdx(nh, PROJECT_DEADLINE_ALIASES.map(normHeader))
  const desci = findColIdx(nh, PROJECT_DESC_ALIASES.map(normHeader))
  const oi = findColIdx(nh, PROJECT_OWNER_ALIASES.map(normHeader))

  const name = ni >= 0 ? cell(row, ni) : ''
  const statusRaw = si >= 0 ? cell(row, si) : ''
  const deadlineRaw = di >= 0 ? cell(row, di) : ''
  const description = desci >= 0 ? cell(row, desci) : undefined
  const ownerName = oi >= 0 ? cell(row, oi) : undefined

  const status = parseProjectStatus(statusRaw)
  const deadline = normalizeProjectDeadline(deadlineRaw)

  return { name, status, deadline, description, ownerName }
}

function parseProjectStatus(raw: string): Project['status'] {
  const k = raw.trim().toLowerCase().replace(/\s+/g, '_')
  if (!k) return 'active'
  if (k.includes('complete') || k === 'done') return 'completed'
  if (k.includes('hold') || k === 'paused' || k === 'blocked') return 'on-hold'
  return 'active'
}

function defaultProjectDeadline(): string {
  return dateKeyDaysFromNow(30)
}

function normalizeProjectDeadline(raw: string): string {
  const t = raw.trim()
  if (!t) return defaultProjectDeadline()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) return toDateKey(d)
  return defaultProjectDeadline()
}

/** Prefer sheet names; otherwise infer Project vs Tasks heuristically. */
export function selectSheetsForProjectImport(sheets: ParsedSheet[]): {
  projectSheet: ParsedSheet | null
  tasksSheet: ParsedSheet
} {
  if (!sheets.length) {
    throw new Error('No sheets in file.')
  }

  const nameOf = (s: ParsedSheet) => (s.sheetName ?? '').trim().toLowerCase()

  const byRe = (re: RegExp) => sheets.find((s) => re.test(nameOf(s)))

  const projectNamed =
    byRe(/^project$/i) || byRe(/^meta$/i) || byRe(/^overview$/i) || byRe(/^summary$/i) || null
  const tasksNamed =
    byRe(/^tasks$/i) ||
    byRe(/^work[\s_]?items$/i) ||
    byRe(/^issues$/i) ||
    byRe(/^backlog$/i) ||
    null

  if (tasksNamed) {
    return {
      projectSheet: projectNamed && projectNamed !== tasksNamed ? projectNamed : null,
      tasksSheet: tasksNamed,
    }
  }

  if (projectNamed && sheets.length >= 2) {
    const other = sheets.find((s) => s !== projectNamed) ?? sheets[0]
    return { projectSheet: projectNamed, tasksSheet: other }
  }

  if (sheets.length >= 2) {
    const sorted = [...sheets].sort((a, b) => b.rows.length - a.rows.length)
    const likelyTasks = sorted[0]
    const likelyProject = sheets.find((s) => s !== likelyTasks && s.rows.length <= 2) ?? null
    if (likelyProject && likelyProject.rows.length <= 2 && likelyTasks.rows.length > likelyProject.rows.length) {
      return { projectSheet: likelyProject, tasksSheet: likelyTasks }
    }
  }

  return { projectSheet: projectNamed, tasksSheet: sheets[0] }
}

/** Read first data row of a Project sheet into metadata (may be partial). */
export function parseProjectMetaFromSheet(sheet: ParsedSheet): Partial<ParsedProjectMeta> {
  if (!sheet.headers.length || !sheet.rows.length) return {}
  return parseProjectRow(sheet.headers, sheet.rows[0])
}

export function mergeProjectMeta(
  fromFile: Partial<ParsedProjectMeta> | null,
  override: {
    name?: string
    status?: Project['status']
    deadline?: string
  },
): ParsedProjectMeta {
  const name = (override.name?.trim() || fromFile?.name?.trim() || '').trim()
  if (!name) throw new Error('Project name is required (add a Project sheet or enter a name).')
  return {
    name,
    status: fromFile?.status ?? override.status ?? 'active',
    deadline: (override.deadline?.trim() || fromFile?.deadline?.trim() || '').trim() || defaultProjectDeadline(),
    description: fromFile?.description,
    ownerName: fromFile?.ownerName,
  }
}

export interface ProjectImportPreview {
  meta: Partial<ParsedProjectMeta> | null
  mergedMeta: ParsedProjectMeta | null
  tasksSheet: ParsedSheet
  taskMapping: PmTaskColumnMapping
  taskPreview: PmImportPreviewRow[]
  taskRowCount: number
}

export function buildProjectImportPreview(
  sheets: ParsedSheet[],
  override: { name?: string; status?: Project['status']; deadline?: string },
): ProjectImportPreview {
  const { projectSheet, tasksSheet } = selectSheetsForProjectImport(sheets)
  const fromFile = projectSheet ? parseProjectMetaFromSheet(projectSheet) : null
  let merged: ParsedProjectMeta | null = null
  try {
    merged = mergeProjectMeta(fromFile, override)
  } catch {
    merged = null
  }
  const taskMapping = detectPmTaskMapping(tasksSheet.headers)
  let taskRowCount = 0
  for (const row of tasksSheet.rows) {
    const t = cell(row, taskMapping.title)
    if (t) taskRowCount++
  }
  const taskPreview = buildPmImportPreview(tasksSheet, taskMapping, 12)
  return {
    meta: (fromFile && Object.keys(fromFile).length ? fromFile : null) as Partial<ParsedProjectMeta> | null,
    mergedMeta: merged,
    tasksSheet,
    taskMapping,
    taskPreview,
    taskRowCount,
  }
}

export interface ProjectImportResult {
  projectId: string
  tasks: { created: number; skipped: number; errors: string[] }
}

export async function executePmProjectImport(params: {
  sheets: ParsedSheet[]
  override: { name?: string; status?: Project['status']; deadline?: string }
  createdBy?: { name: string; avatar: string }
}): Promise<ProjectImportResult> {
  const { projectSheet, tasksSheet } = selectSheetsForProjectImport(params.sheets)
  const fromFile = projectSheet ? parseProjectMetaFromSheet(projectSheet) : null
  const meta = mergeProjectMeta(fromFile, params.override)

  const projectId = await createProject({
    name: meta.name,
    status: meta.status,
    deadline: meta.deadline,
    createdBy: params.createdBy,
  })

  if (!projectId) {
    throw new Error('Failed to create project.')
  }

  if (meta.ownerName?.trim()) {
    await updateProject(projectId, {
      owner: { name: meta.ownerName.trim(), avatar: '/placeholder.svg?height=32&width=32' },
    })
  }

  const taskMapping = detectPmTaskMapping(tasksSheet.headers)
  const tasks = await executePmTaskImport(projectId, tasksSheet, taskMapping)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('projectDataUpdated', { detail: { projectId } }))
  }

  return { projectId, tasks }
}
