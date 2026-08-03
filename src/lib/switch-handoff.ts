/**
 * Katana → Switch Import handoff (Phase 1).
 * Contract: Katana Switch/docs/KATANA_IMPORT_HANDOFF.md
 *
 * Browser uploads a signed URL (or rows) → POST /api/switch/handoff (Katana proxy)
 * → Switch POST /api/katana/handoff → { import_id, import_url }.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCurrentUserId, getOrganizationId } from '@/lib/auth-helpers'

export type SwitchHandoffModule =
  | 'inventory'
  | 'projects'
  | 'workforce'
  | 'kyi'
  | 'finance'
  | 'hr'
  | 'careers'
  | 'automation'

export type SwitchHandoffEntityType =
  | 'inventory_item'
  | 'task'
  | 'project'
  | 'wfm_technician'
  | 'kyi_investor_lead'
  | 'kyi_investor'
  | 'kyi_northstar_investor'
  | 'fin_bank_transaction'
  | 'job_application'
  | 'storage_file'

export type KyiHandoffTarget = 'leads' | 'investors' | 'northstar'

export interface SwitchHandoffActor {
  user_id: string
  organization_id: string
}

export interface SwitchHandoffFileRef {
  file_name: string
  mime_type: string
  source: {
    type: 'signed_url' | 'public_url'
    url: string
  }
}

/** Request envelope — matches KATANA_IMPORT_HANDOFF.md exactly. */
export interface SwitchHandoffRequest {
  module: SwitchHandoffModule
  entity_type: SwitchHandoffEntityType
  source_label: string
  actor: SwitchHandoffActor
  parsed: boolean
  file: SwitchHandoffFileRef | null
  context: Record<string, unknown>
  rows: Record<string, unknown>[] | null
  upsert_key: string | null
  target: KyiHandoffTarget | null
}

/** Response — matches KATANA_IMPORT_HANDOFF.md exactly. */
export interface SwitchHandoffResponse {
  ok: true
  import_id: string
  import_url: string
  dataset_type: string
  module: string
}

export interface SwitchHandoffError {
  ok: false
  error: string
  code?: string
  details?: unknown
}

const HANDOFF_BUCKET = 'switch-handoff'
const SIGNED_URL_TTL_SEC = 60 * 60

const MODULE_BUCKET: Partial<Record<SwitchHandoffModule, string>> = {
  inventory: 'inventory-files',
  projects: 'project-files',
  workforce: 'wfm-files',
  automation: 'automation-files',
  finance: 'finance-statements',
  hr: 'employee-photos',
  careers: 'employee-photos',
  kyi: 'project-files',
}

/** Org setting key + optional Vite flag to show divert without removing native Import. */
export function isSwitchImportDivertEnabled(
  organization?: { settings?: Record<string, unknown> | null } | null,
): boolean {
  const envOn = String(import.meta.env.VITE_SWITCH_IMPORT_DIVERT ?? '').toLowerCase() === 'true'
  const orgOn = organization?.settings?.switch_import_divert === true
  return envOn || orgOn
}

export function buildSwitchHandoffEnvelope(params: {
  module: SwitchHandoffModule
  entity_type: SwitchHandoffEntityType
  source_label: string
  actor: SwitchHandoffActor
  file?: SwitchHandoffFileRef | null
  rows?: Record<string, unknown>[] | null
  parsed?: boolean
  context?: Record<string, unknown>
  upsert_key?: string | null
  target?: KyiHandoffTarget | null
}): SwitchHandoffRequest {
  const rows = params.rows?.length ? params.rows : null
  const file = params.file ?? null
  if (!file && !rows) {
    throw new Error('Handoff requires file and/or rows')
  }
  const parsed = params.parsed ?? Boolean(rows)
  if (parsed && !rows) {
    throw new Error('rows required when parsed is true')
  }
  return {
    module: params.module,
    entity_type: params.entity_type,
    source_label: params.source_label,
    actor: params.actor,
    parsed,
    file,
    context: params.context ?? {},
    rows,
    upsert_key: params.upsert_key ?? null,
    target: params.target ?? null,
  }
}

/**
 * Upload Import file to storage and return a signed URL for Switch to fetch.
 */
export async function uploadImportFileForHandoff(
  file: File,
  module: SwitchHandoffModule,
): Promise<SwitchHandoffFileRef> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')

  const orgId = await getOrganizationId()
  const bucket = MODULE_BUCKET[module] ?? HANDOFF_BUCKET
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 120)
  const path = `${orgId}/handoff/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (uploadError) {
    // Fallback bucket if module bucket missing
    if (bucket !== HANDOFF_BUCKET) {
      const { error: fallbackErr } = await supabase.storage.from(HANDOFF_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })
      if (fallbackErr) throw new Error(`Upload failed: ${fallbackErr.message}`)
      return signedFileRef(HANDOFF_BUCKET, path, file)
    }
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  return signedFileRef(bucket, path, file)
}

async function signedFileRef(bucket: string, path: string, file: File): Promise<SwitchHandoffFileRef> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SEC)
  if (error || !data?.signedUrl) {
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
    if (pub?.publicUrl) {
      return {
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        source: { type: 'public_url', url: pub.publicUrl },
      }
    }
    throw new Error(error?.message ?? 'Could not create signed URL for handoff file')
  }
  return {
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    source: { type: 'signed_url', url: data.signedUrl },
  }
}

/** Create a File from CSV/text when the Import UI only has pasted content. */
export function textToHandoffFile(text: string, fileName = 'import.csv'): File {
  return new File([text], fileName, { type: 'text/csv' })
}

export async function resolveHandoffActor(): Promise<SwitchHandoffActor> {
  const [user_id, organization_id] = await Promise.all([getCurrentUserId(), getOrganizationId()])
  return { user_id, organization_id }
}

/**
 * POST envelope to Katana proxy → Switch. Keeps Switch credentials server-side.
 */
export async function postSwitchHandoff(
  envelope: SwitchHandoffRequest,
): Promise<SwitchHandoffResponse> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch('/api/switch/handoff', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(envelope),
  })

  const body = (await res.json().catch(() => ({}))) as SwitchHandoffResponse | SwitchHandoffError | Record<string, unknown>

  if (!res.ok) {
    const err = body as SwitchHandoffError
    throw new Error(err.error || `Switch handoff failed (${res.status})`)
  }

  if (!body || typeof body !== 'object' || !('ok' in body) || body.ok !== true) {
    throw new Error('Unexpected Switch handoff response — update KATANA_IMPORT_HANDOFF.md with Switch agent')
  }

  const ok = body as SwitchHandoffResponse
  if (!ok.import_id || !ok.import_url) {
    throw new Error('Switch handoff response missing import_id/import_url — update KATANA_IMPORT_HANDOFF.md with Switch agent')
  }
  return ok
}

/**
 * Full divert path: optional upload → envelope → Switch → import URL.
 */
export async function divertImportToSwitch(params: {
  module: SwitchHandoffModule
  entity_type: SwitchHandoffEntityType
  source_label: string
  file?: File | null
  rows?: Record<string, unknown>[] | null
  context?: Record<string, unknown>
  upsert_key?: string | null
  target?: KyiHandoffTarget | null
  parsed?: boolean
}): Promise<SwitchHandoffResponse> {
  const actor = await resolveHandoffActor()
  let fileRef: SwitchHandoffFileRef | null = null
  if (params.file) {
    fileRef = await uploadImportFileForHandoff(params.file, params.module)
  }
  const envelope = buildSwitchHandoffEnvelope({
    module: params.module,
    entity_type: params.entity_type,
    source_label: params.source_label,
    actor,
    file: fileRef,
    rows: params.rows,
    parsed: params.parsed,
    context: params.context,
    upsert_key: params.upsert_key,
    target: params.target,
  })
  return postSwitchHandoff(envelope)
}
