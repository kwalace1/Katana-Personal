import { api } from '@/lib/office/app/api-client'
import type {
  BoardTask,
  TaskComment,
  TaskExecutionPolicy,
  TaskExecutionPolicyState,
  TaskHandoffPacket,
  TaskPreviewLink,
  TaskRuntimeService,
} from '@/lib/office/types'

export const fetchTasks = (includeArchived = false) =>
  api<Record<string, BoardTask>>('GET', `/tasks${includeArchived ? '?includeArchived=true' : ''}`)

export interface GitHubIssueImportRequest {
  repo: string
  token?: string
  state?: 'open' | 'closed' | 'all'
  limit?: number
  labels?: string[]
  projectId?: string | null
  agentId?: string | null
}

export interface GitHubIssueImportItem {
  taskId?: string
  number: number
  title: string
  url: string | null
}

export interface GitHubIssueImportResult {
  repo: string
  state: 'open' | 'closed' | 'all'
  fetched: number
  created: GitHubIssueImportItem[]
  skipped: GitHubIssueImportItem[]
}

export interface TaskHandoffSnapshotResult {
  packet: TaskHandoffPacket
  files: {
    markdownPath: string
    jsonPath: string
  }
}

export interface TaskExecutionPolicyResult {
  task: BoardTask
  policy: TaskExecutionPolicy | null
  state: TaskExecutionPolicyState | null
  summary: {
    enabled: boolean
    status: string
    currentStage: TaskExecutionPolicy['stages'][number] | null
    remainingStages: number
    blockReason: string | null
  }
}

export type TaskWriteInput = Partial<BoardTask> & {
  title?: string
  description?: string
  agentId?: string
  provisionWorkspace?: boolean
  previewLinks?: Array<Partial<TaskPreviewLink> & { url: string }>
  runtimeServices?: Array<Partial<TaskRuntimeService>>
  appendComment?: TaskComment
}

export const createTask = (data: TaskWriteInput & {
  title: string
  description: string
  agentId: string
}) =>
  api<BoardTask>('POST', '/tasks', data)

export const updateTask = (id: string, data: TaskWriteInput) =>
  api<BoardTask>('PUT', `/tasks/${id}`, data)

export const fetchTaskHandoff = (id: string) =>
  api<TaskHandoffPacket>('GET', `/tasks/${encodeURIComponent(id)}/handoff`)

export const fetchTaskHandoffMarkdown = (id: string) =>
  api<string>('GET', `/tasks/${encodeURIComponent(id)}/handoff?format=markdown`)

export const saveTaskHandoffSnapshot = (id: string, options: { prepareWorkspace?: boolean } = {}) =>
  api<TaskHandoffSnapshotResult>('POST', `/tasks/${encodeURIComponent(id)}/handoff`, {
    prepareWorkspace: options.prepareWorkspace ?? true,
  }, { timeoutMs: 30_000 })

export const decideTaskExecutionPolicy = (
  id: string,
  data: { action?: 'approve' | 'request_changes' | 'reset'; stageId?: string | null; actor?: string; note?: string | null },
) =>
  api<TaskExecutionPolicyResult>('POST', `/tasks/${encodeURIComponent(id)}/execution-policy`, data)

export const deleteTask = (id: string) =>
  api<BoardTask>('DELETE', `/tasks/${id}`)

export const archiveTask = (id: string) =>
  api<BoardTask>('PUT', `/tasks/${id}`, { status: 'archived' })

export const unarchiveTask = (id: string) =>
  api<BoardTask>('PUT', `/tasks/${id}`, { status: 'backlog' })

export const bulkUpdateTasks = (ids: string[], data: { status?: string; agentId?: string | null; projectId?: string | null }) =>
  api<{ updated: number; ids: string[] }>('POST', '/tasks/bulk', { ids, ...data })

export const importGitHubIssues = (data: GitHubIssueImportRequest) =>
  api<GitHubIssueImportResult>('POST', '/tasks/import/github', data, { timeoutMs: 30_000 })
