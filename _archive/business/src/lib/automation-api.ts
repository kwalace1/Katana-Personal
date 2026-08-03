/**
 * Client API for Automation module: documents, jobs, browser tools, dashboard.
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import {
  deleteTrackedFile,
  formatBytes,
  uploadWithTracking,
  type StorageFileRecord,
} from './storage-api'
import type {
  AutomationBrowserRequest,
  AutomationBrowserResult,
  AutomationBrowserTool,
} from './automation-browser'
import { runAutomationBrowserTool } from './automation-browser'
import {
  extractDocumentText,
  type ExtractStatus,
} from './automation-document-extract'

export const AUTOMATION_MODULE = 'automation'
export const AUTOMATION_BUCKET = 'automation-files'

export type AutomationJobType =
  | AutomationBrowserTool
  | 'document_upload'

export type AutomationJobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AutomationJob {
  id: string
  organization_id: string
  created_by: string | null
  job_type: AutomationJobType
  status: AutomationJobStatus
  title: string | null
  input: Record<string, unknown>
  result: Record<string, unknown> | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface AutomationDocumentRecord {
  id: string
  organization_id: string
  storage_file_id: string
  file_name: string
  mime_type: string | null
  extracted_text: string | null
  extract_status: ExtractStatus
  extract_error: string | null
  char_count: number
  created_at: string
  updated_at: string
}

export interface AutomationDocumentSearchHit {
  id: string
  storage_file_id: string
  file_name: string
  extract_status: ExtractStatus
  char_count: number
  snippet: string
  rank: number
  created_at: string
}

export interface AutomationDashboardStats {
  documentsIndexed: number
  documentsReady: number
  tasksCompleted: number
  toolRuns: number
  failedRuns: number
  jobsByType: Record<string, number>
  recentActivity: AutomationJob[]
}

export interface AutomationSettings {
  viewport: string
  timeoutMs: number
}

const SETTINGS_KEY = 'katana-automation-settings'

const DEFAULT_SETTINGS: AutomationSettings = {
  viewport: '1920x1080',
  timeoutMs: 30_000,
}

export function formatBytesPublic(bytes: number): string {
  return formatBytes(bytes)
}

export function parseViewport(viewport: string): { width: number; height: number } {
  const m = viewport.trim().match(/^(\d{3,4})\s*[x×]\s*(\d{3,4})$/i)
  if (!m) return { width: 1280, height: 900 }
  return {
    width: Math.min(Math.max(Number(m[1]), 320), 2560),
    height: Math.min(Math.max(Number(m[2]), 240), 2000),
  }
}

export function loadAutomationSettings(): AutomationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AutomationSettings>
    return {
      viewport: typeof parsed.viewport === 'string' && parsed.viewport.trim()
        ? parsed.viewport.trim()
        : DEFAULT_SETTINGS.viewport,
      timeoutMs:
        typeof parsed.timeoutMs === 'number' && parsed.timeoutMs >= 3000
          ? Math.min(parsed.timeoutMs, 60_000)
          : DEFAULT_SETTINGS.timeoutMs,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveAutomationSettings(settings: AutomationSettings): void {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      viewport: settings.viewport.trim() || DEFAULT_SETTINGS.viewport,
      timeoutMs: Math.min(Math.max(settings.timeoutMs, 3000), 60_000),
    }),
  )
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function listAutomationDocuments(): Promise<StorageFileRecord[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('storage_files')
    .select('*')
    .eq('module', AUTOMATION_MODULE)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('listAutomationDocuments:', error)
    return []
  }
  return (data || []) as StorageFileRecord[]
}

export async function listAutomationDocumentRecords(): Promise<AutomationDocumentRecord[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('automation_documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    // Table may not exist until migration is applied
    console.warn('listAutomationDocumentRecords:', error.message)
    return []
  }
  return (data || []) as AutomationDocumentRecord[]
}

async function upsertAutomationDocumentIndex(input: {
  storageFileId: string
  fileName: string
  mimeType: string
  extract: Awaited<ReturnType<typeof extractDocumentText>>
}): Promise<AutomationDocumentRecord | null> {
  if (!isSupabaseConfigured) return null

  const orgId = await getOrganizationId()
  if (!orgId) return null
  const userId = await getCurrentUserId()

  const row = {
    organization_id: orgId,
    storage_file_id: input.storageFileId,
    file_name: input.fileName,
    mime_type: input.mimeType || null,
    extracted_text: input.extract.text || null,
    extract_status: input.extract.status,
    extract_error: input.extract.error ?? null,
    char_count: input.extract.text.length,
    created_by: userId,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('automation_documents')
    .upsert(row, { onConflict: 'storage_file_id' })
    .select()
    .single()

  if (error) {
    console.error('upsertAutomationDocumentIndex:', error)
    return null
  }
  return data as AutomationDocumentRecord
}

export async function uploadAutomationDocument(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<
  | { record: StorageFileRecord; url: string; index: AutomationDocumentRecord | null }
  | { error: string }
> {
  const result = await uploadWithTracking(file, {
    module: AUTOMATION_MODULE,
    bucket: AUTOMATION_BUCKET,
    compress: false,
    onProgress,
  })

  if ('error' in result) return result
  if (!result.record) {
    return { error: 'Upload succeeded but metadata was not recorded' }
  }

  const extract = await extractDocumentText(file)
  const index = await upsertAutomationDocumentIndex({
    storageFileId: result.record.id,
    fileName: file.name,
    mimeType: file.type || result.record.mime_type || '',
    extract,
  })

  const indexedOk = extract.status === 'ready'
  await recordAutomationJob({
    jobType: 'document_upload',
    status: indexedOk || extract.status === 'unsupported' ? 'completed' : 'failed',
    title: indexedOk
      ? `Indexed ${file.name}`
      : extract.status === 'unsupported'
        ? `Stored ${file.name} (no text extract)`
        : `Failed to index ${file.name}`,
    input: { file_name: file.name, file_size: file.size },
    result: {
      file_id: result.record.id,
      path: result.path,
      url: result.url,
      extract_status: extract.status,
      char_count: extract.text.length,
    },
    errorMessage: indexedOk ? null : extract.error ?? null,
  })

  return { record: result.record, url: result.url, index }
}

/** Re-download a stored file and (re)build its text index. */
export async function reindexAutomationDocument(
  file: StorageFileRecord,
): Promise<AutomationDocumentRecord | null> {
  if (!isSupabaseConfigured) return null

  const { data: blob, error } = await supabase.storage
    .from(file.bucket)
    .download(file.file_path)

  if (error || !blob) {
    console.error('reindexAutomationDocument download:', error)
    return null
  }

  const local = new File([blob], file.file_name, {
    type: file.mime_type || blob.type || 'application/octet-stream',
  })
  const extract = await extractDocumentText(local)
  return upsertAutomationDocumentIndex({
    storageFileId: file.id,
    fileName: file.file_name,
    mimeType: file.mime_type || '',
    extract,
  })
}

export async function searchAutomationDocuments(
  query: string,
  limit = 10,
): Promise<AutomationDocumentSearchHit[]> {
  if (!isSupabaseConfigured) return []
  const q = query.trim()
  if (!q) return []

  const { data, error } = await supabase.rpc('search_automation_documents', {
    p_query: q,
    p_limit: limit,
  })

  if (error) {
    console.warn('searchAutomationDocuments:', error.message)
    // Fallback: client-side filter if RPC missing
    const docs = await listAutomationDocumentRecords()
    const lower = q.toLowerCase()
    return docs
      .filter(
        (d) =>
          d.extract_status === 'ready' &&
          ((d.extracted_text || '').toLowerCase().includes(lower) ||
            d.file_name.toLowerCase().includes(lower)),
      )
      .slice(0, limit)
      .map((d) => ({
        id: d.id,
        storage_file_id: d.storage_file_id,
        file_name: d.file_name,
        extract_status: d.extract_status,
        char_count: d.char_count,
        snippet: (d.extracted_text || '').slice(0, 600),
        rank: 0.1,
        created_at: d.created_at,
      }))
  }

  return (data || []) as AutomationDocumentSearchHit[]
}

export async function deleteAutomationDocument(fileId: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    await supabase.from('automation_documents').delete().eq('storage_file_id', fileId)
  }
  return deleteTrackedFile(fileId)
}

export async function getAutomationDocumentUrl(
  file: StorageFileRecord,
): Promise<string | null> {
  const { data } = supabase.storage.from(file.bucket).getPublicUrl(file.file_path)
  return data?.publicUrl || null
}

export async function listAutomationJobs(limit = 40): Promise<AutomationJob[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await supabase
    .from('automation_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('listAutomationJobs:', error)
    return []
  }
  return (data || []) as AutomationJob[]
}

export async function getAutomationDashboardStats(): Promise<AutomationDashboardStats> {
  const [docs, indexes, jobs] = await Promise.all([
    listAutomationDocuments(),
    listAutomationDocumentRecords(),
    listAutomationJobs(50),
  ])

  const toolTypes = new Set<string>([
    'screenshot',
    'extract_text',
    'fill_form',
    'click',
    'download',
  ])

  const toolJobs = jobs.filter((j) => toolTypes.has(j.job_type))
  const tasksCompleted = jobs.filter((j) => j.status === 'completed').length
  const toolRuns = toolJobs.length
  const failedRuns = jobs.filter((j) => j.status === 'failed').length
  const readyCount = indexes.filter((d) => d.extract_status === 'ready').length

  const jobsByType: Record<string, number> = {}
  for (const job of jobs) {
    jobsByType[job.job_type] = (jobsByType[job.job_type] || 0) + 1
  }

  return {
    documentsIndexed: docs.length,
    documentsReady: readyCount,
    tasksCompleted,
    toolRuns,
    failedRuns,
    jobsByType,
    recentActivity: jobs.slice(0, 12),
  }
}

export async function recordAutomationJob(input: {
  jobType: AutomationJobType
  status: AutomationJobStatus
  title?: string
  input?: Record<string, unknown>
  result?: Record<string, unknown> | null
  errorMessage?: string | null
}): Promise<AutomationJob | null> {
  if (!isSupabaseConfigured) return null

  const orgId = await getOrganizationId()
  if (!orgId) return null
  const userId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('automation_jobs')
    .insert({
      organization_id: orgId,
      created_by: userId,
      job_type: input.jobType,
      status: input.status,
      title: input.title ?? null,
      input: input.input ?? {},
      result: input.result ?? null,
      error_message: input.errorMessage ?? null,
      completed_at:
        input.status === 'completed' || input.status === 'failed'
          ? new Date().toISOString()
          : null,
    })
    .select()
    .single()

  if (error) {
    console.error('recordAutomationJob:', error)
    return null
  }
  return data as AutomationJob
}

function downloadBase64File(
  fileName: string,
  contentType: string,
  contentBase64: string,
): void {
  const binary = atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function callBrowserApi(
  body: AutomationBrowserRequest,
): Promise<AutomationBrowserResult | null> {
  const token = await getAccessToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch('/api/automation-browser', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    // 422 = tool ran but failed (structured result). 401 = auth on production.
    if (res.status === 404 || res.status === 502 || res.status === 503) {
      return null
    }

    const data = (await res.json().catch(() => null)) as {
      ok?: boolean
      tool?: string
      url?: string
      error?: string
      title?: string
      text?: string
      screenshotUrl?: string
      pagesVisited?: string[]
      statusCode?: number
      download?: AutomationBrowserResult['download']
    } | null

    if (res.status === 401) {
      return {
        ok: false,
        tool: body.tool,
        url: body.url,
        error: data?.error || 'Sign in required to run browser tools',
      }
    }

    if (data && typeof data.tool === 'string') {
      return data as AutomationBrowserResult
    }

    if (!res.ok) {
      return {
        ok: false,
        tool: body.tool,
        url: body.url,
        error: (data && data.error) || `API error ${res.status}`,
      }
    }

    return null
  } catch {
    return null
  }
}

export async function runBrowserTool(
  request: AutomationBrowserRequest,
): Promise<AutomationBrowserResult> {
  const settings = loadAutomationSettings()
  const viewport = parseViewport(settings.viewport)
  const payload: AutomationBrowserRequest = {
    ...request,
    timeoutMs: request.timeoutMs ?? settings.timeoutMs,
    viewportWidth: request.viewportWidth ?? viewport.width,
    viewportHeight: request.viewportHeight ?? viewport.height,
  }

  let result = await callBrowserApi(payload)

  // Local fallback when Vite plugin / Vercel route is unavailable
  if (!result) {
    result = await runAutomationBrowserTool(payload)
  }

  if (result.download && result.ok) {
    downloadBase64File(
      result.download.fileName,
      result.download.contentType,
      result.download.contentBase64,
    )
  }

  await recordAutomationJob({
    jobType: request.tool,
    status: result.ok ? 'completed' : 'failed',
    title: result.title || `${request.tool} → ${request.url}`,
    input: {
      url: request.url,
      selector: request.selector,
      formData: request.formData,
      clickSequence: request.clickSequence,
      viewport: `${payload.viewportWidth}x${payload.viewportHeight}`,
      timeoutMs: payload.timeoutMs,
    },
    result: {
      ok: result.ok,
      text: result.text?.slice(0, 4000),
      screenshotUrl: result.screenshotUrl,
      pagesVisited: result.pagesVisited,
      statusCode: result.statusCode,
      downloadFileName: result.download?.fileName,
      downloadSize: result.download?.size,
    },
    errorMessage: result.error ?? null,
  })

  return result
}

export function jobTypeLabel(type: AutomationJobType): string {
  switch (type) {
    case 'screenshot':
      return 'Screenshot'
    case 'extract_text':
      return 'Extract text'
    case 'fill_form':
      return 'Fill form'
    case 'click':
      return 'Click sequence'
    case 'download':
      return 'Download'
    case 'document_upload':
      return 'Document indexed'
    default:
      return type
  }
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) return `${Math.max(seconds, 0)}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function extractStatusLabel(status: ExtractStatus): string {
  switch (status) {
    case 'ready':
      return 'Indexed'
    case 'pending':
      return 'Pending'
    case 'unsupported':
      return 'Stored'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}
