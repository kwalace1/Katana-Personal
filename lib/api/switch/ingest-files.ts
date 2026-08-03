/**
 * Switch file ingest — fetch from signed/public URL, store in Supabase Storage
 * POST /switch/ingest/files
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { authenticateSwitchRequest, getAdminClient } from './switch-auth'
import { resolveSwitchIngestJobId } from './ingest-job'
import {
  SWITCH_INGEST_BUCKET,
  SWITCH_MAX_FILES_PER_REQUEST,
  SWITCH_MAX_FILE_BYTES,
} from './switch-config'
import { switchError, switchJson, withCors, corsHeaders } from './switch-errors'

type FileSourceType = 'signed_url' | 'public_url' | 'webhook'

interface FileSource {
  type: FileSourceType
  url?: string
  headers?: Record<string, string>
}

interface IngestFileInput {
  external_id: string
  file_name: string
  mime_type?: string
  module?: string
  source: FileSource
  metadata?: Record<string, unknown>
}

interface FileResult {
  external_id: string
  status: 'ingested' | 'failed'
  katana_file_id?: string
  storage_path?: string
  public_url?: string
  error_code?: string
  error_message?: string
}

async function ensureBucket(admin: SupabaseClient): Promise<void> {
  const { data: buckets } = await admin.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === SWITCH_INGEST_BUCKET)
  if (exists) return
  await admin.storage.createBucket(SWITCH_INGEST_BUCKET, { public: true })
}

async function fetchFileFromSource(source: FileSource): Promise<{ buffer: Uint8Array; contentType: string }> {
  if (source.type === 'webhook') {
    throw new Error('webhook source type is registered only; Katana fetches when url is provided on a later poll')
  }

  const url = source.url?.trim()
  if (!url) throw new Error('source.url is required for signed_url and public_url')

  const res = await fetch(url, {
    headers: source.headers ?? {},
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    throw new Error(`Source fetch failed: HTTP ${res.status}`)
  }

  const contentLength = Number(res.headers.get('content-length') || 0)
  if (contentLength > SWITCH_MAX_FILE_BYTES) {
    throw new Error(`File exceeds ${SWITCH_MAX_FILE_BYTES} byte limit`)
  }

  const arrayBuffer = await res.arrayBuffer()
  if (arrayBuffer.byteLength > SWITCH_MAX_FILE_BYTES) {
    throw new Error(`File exceeds ${SWITCH_MAX_FILE_BYTES} byte limit`)
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  return { buffer: new Uint8Array(arrayBuffer), contentType }
}

export async function handleSwitchIngestFiles(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (req.method !== 'POST') {
    return withCors(switchError(405, 'INVALID_REQUEST', 'Method not allowed'))
  }

  const auth = await authenticateSwitchRequest(req)
  if (!auth) {
    return withCors(switchError(401, 'UNAUTHORIZED', 'Valid Bearer token required'))
  }

  const admin = getAdminClient()
  if (!admin) {
    return withCors(switchError(503, 'NOT_CONFIGURED', 'SUPABASE_SERVICE_ROLE_KEY is not configured'))
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return withCors(switchError(400, 'INVALID_REQUEST', 'Invalid JSON body'))
  }

  const files = body.files as IngestFileInput[] | undefined
  if (!Array.isArray(files) || files.length === 0) {
    return withCors(
      switchError(400, 'VALIDATION_ERROR', 'files array is required', {
        details: [{ field: 'files', message: 'At least one file entry required' }],
      }),
    )
  }

  if (files.length > SWITCH_MAX_FILES_PER_REQUEST) {
    return withCors(
      switchError(400, 'VALIDATION_ERROR', `Maximum ${SWITCH_MAX_FILES_PER_REQUEST} files per request`),
    )
  }

  const sourceSystem = body.source_system ? String(body.source_system) : null
  const requestedJobId = body.job_id ? String(body.job_id) : null

  const resolved = await resolveSwitchIngestJobId(admin, {
    organizationId: auth.organizationId,
    clientRef: auth.clientRef,
    requestedJobId,
    sourceSystem,
    jobType: 'files',
  })
  if ('error' in resolved) {
    return withCors(switchError(500, 'INTERNAL_ERROR', resolved.error))
  }
  const jobId = resolved.jobId

  await ensureBucket(admin)

  const results: FileResult[] = []
  let accepted = 0
  let failed = 0

  for (const file of files) {
    const externalId = String(file.external_id ?? '').trim()
    const fileName = String(file.file_name ?? '').trim()
    const sourceType = file.source?.type as FileSourceType | undefined

    if (!externalId || !fileName || !sourceType) {
      failed++
      results.push({
        external_id: externalId || '(missing)',
        status: 'failed',
        error_code: 'VALIDATION_ERROR',
        error_message: 'external_id, file_name, and source.type are required',
      })
      continue
    }

    if (!['signed_url', 'public_url', 'webhook'].includes(sourceType)) {
      failed++
      results.push({
        external_id: externalId,
        status: 'failed',
        error_code: 'VALIDATION_ERROR',
        error_message: 'source.type must be signed_url, public_url, or webhook',
      })
      continue
    }

    const module = String(file.module ?? 'switch-ingest')
    const mimeType = file.mime_type || 'application/octet-stream'

    if (sourceType === 'webhook') {
      const { data: row, error: insertErr } = await admin
        .from('switch_ingest_files')
        .upsert(
          {
            job_id: jobId,
            organization_id: auth.organizationId,
            external_id: externalId,
            file_name: fileName,
            mime_type: mimeType,
            module,
            bucket: SWITCH_INGEST_BUCKET,
            source_type: 'webhook',
            source_url: file.source.url ?? null,
            status: 'pending',
            metadata: file.metadata ?? {},
          },
          { onConflict: 'organization_id,external_id' },
        )
        .select('id')
        .single()

      if (insertErr || !row) {
        failed++
        results.push({
          external_id: externalId,
          status: 'failed',
          error_code: 'INGEST_FAILED',
          error_message: insertErr?.message ?? 'Failed to register webhook file',
        })
      } else {
        accepted++
        results.push({
          external_id: externalId,
          status: 'ingested',
          katana_file_id: row.id as string,
        })
      }
      continue
    }

    try {
      const { buffer, contentType } = await fetchFileFromSource(file.source)
      const ext = fileName.includes('.') ? fileName.split('.').pop() : 'bin'
      const storagePath = `${auth.organizationId}/${Date.now()}-${externalId.slice(0, 8)}.${ext}`

      const { error: uploadErr } = await admin.storage
        .from(SWITCH_INGEST_BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.mime_type || contentType,
          upsert: false,
        })

      if (uploadErr) throw new Error(uploadErr.message)

      const { data: urlData } = admin.storage.from(SWITCH_INGEST_BUCKET).getPublicUrl(storagePath)

      const { data: row, error: insertErr } = await admin
        .from('switch_ingest_files')
        .upsert(
          {
            job_id: jobId,
            organization_id: auth.organizationId,
            external_id: externalId,
            file_name: fileName,
            mime_type: file.mime_type || contentType,
            module,
            bucket: SWITCH_INGEST_BUCKET,
            storage_path: storagePath,
            public_url: urlData.publicUrl,
            source_type: sourceType,
            source_url: file.source.url ?? null,
            status: 'ingested',
            metadata: file.metadata ?? {},
          },
          { onConflict: 'organization_id,external_id' },
        )
        .select('id, storage_path, public_url')
        .single()

      if (insertErr || !row) throw new Error(insertErr?.message ?? 'Failed to record file')

      accepted++
      results.push({
        external_id: externalId,
        status: 'ingested',
        katana_file_id: row.id as string,
        storage_path: row.storage_path as string,
        public_url: row.public_url as string,
      })
    } catch (e) {
      failed++
      const message = e instanceof Error ? e.message : 'File ingest failed'
      await admin.from('switch_ingest_files').upsert(
        {
          job_id: jobId,
          organization_id: auth.organizationId,
          external_id: externalId,
          file_name: fileName,
          mime_type: mimeType,
          module,
          bucket: SWITCH_INGEST_BUCKET,
          source_type: sourceType,
          source_url: file.source.url ?? null,
          status: 'failed',
          error_code: 'FILE_FETCH_FAILED',
          error_message: message,
          metadata: file.metadata ?? {},
        },
        { onConflict: 'organization_id,external_id' },
      )

      results.push({
        external_id: externalId,
        status: 'failed',
        error_code: 'FILE_FETCH_FAILED',
        error_message: message,
      })
    }
  }

  const jobStatus = failed === 0 ? 'completed' : accepted === 0 ? 'failed' : 'partial'

  await admin
    .from('switch_ingest_jobs')
    .update({
      status: jobStatus,
      accepted_count: accepted,
      failed_count: failed,
      completed_at: new Date().toISOString(),
      error_summary: failed > 0 ? `${failed} file(s) failed` : null,
    })
    .eq('id', jobId)

  return withCors(
    switchJson({
      job_id: jobId,
      accepted,
      failed,
      file_resolution: {
        signed_url: 'Katana performs an HTTP GET on source.url (optional source.headers).',
        public_url: 'Same as signed_url — direct HTTPS fetch.',
        webhook: 'Registers pending file; provide url later or use signed_url for immediate fetch.',
      },
      results,
    }),
  )
}
