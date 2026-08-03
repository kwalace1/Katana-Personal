import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import { MODULE_BUCKETS } from './storage-api'
import { normalizeEsignUploadToPdf } from './esign-convert'
import { emitEsignAutomationEvent } from './esign-automation'
import type {
  CreateEsignDocumentInput,
  EsignDashboardStats,
  EsignDocument,
  EsignDocumentWithRelations,
  EsignField,
  EsignFieldBlueprint,
  EsignFieldType,
  EsignSigner,
  EsignSigningPacket,
  EsignTemplate,
} from './esign-types'
import { ESIGN_FIELD_DEFAULTS } from './esign-types'

const BUCKET = MODULE_BUCKETS.esign

function schemaMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  )
}

export function isEsignSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  return schemaMissing(error as { message?: string; code?: string })
}

async function requireOrg(): Promise<{ orgId: string; userId: string }> {
  const [orgId, userId] = await Promise.all([getOrganizationId(), getCurrentUserId()])
  return { orgId, userId }
}

export async function listEsignDocuments(): Promise<EsignDocumentWithRelations[]> {
  if (!isSupabaseConfigured) return []
  const { orgId } = await requireOrg()

  const { data, error } = await supabase
    .from('esign_documents')
    .select('*, esign_signers(*), esign_fields(*)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    if (schemaMissing(error)) throw Object.assign(new Error('ESIGN_SCHEMA_MISSING'), { cause: error })
    throw error
  }

  return (data ?? []).map((row) => {
    const { esign_signers, esign_fields, ...doc } = row as EsignDocument & {
      esign_signers: EsignSigner[]
      esign_fields: EsignField[]
    }
    return {
      ...(doc as EsignDocument),
      signers: (esign_signers ?? []).sort((a, b) => a.signing_order - b.signing_order),
      fields: esign_fields ?? [],
    }
  })
}

export async function getEsignDocument(id: string): Promise<EsignDocumentWithRelations | null> {
  if (!isSupabaseConfigured) return null
  const { orgId } = await requireOrg()

  const { data, error } = await supabase
    .from('esign_documents')
    .select('*, esign_signers(*), esign_fields(*)')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    if (schemaMissing(error)) throw Object.assign(new Error('ESIGN_SCHEMA_MISSING'), { cause: error })
    throw error
  }
  if (!data) return null

  const { esign_signers, esign_fields, ...doc } = data as EsignDocument & {
    esign_signers: EsignSigner[]
    esign_fields: EsignField[]
  }
  return {
    ...(doc as EsignDocument),
    signers: (esign_signers ?? []).sort((a, b) => a.signing_order - b.signing_order),
    fields: esign_fields ?? [],
  }
}

export function computeEsignStats(docs: EsignDocument[]): EsignDashboardStats {
  return {
    total: docs.length,
    draft: docs.filter((d) => d.status === 'draft').length,
    pending: docs.filter((d) => d.status === 'pending').length,
    partiallySigned: docs.filter((d) => d.status === 'partially_signed').length,
    signed: docs.filter((d) => d.status === 'signed').length,
  }
}

export async function createEsignDocument(
  input: CreateEsignDocumentInput,
): Promise<EsignDocumentWithRelations> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured')
  const { orgId, userId } = await requireOrg()

  if (!input.title.trim()) throw new Error('Title is required')
  if (!input.file) throw new Error('A document file is required')
  if (!input.signers.some((s) => s.name.trim())) throw new Error('At least one signer is required')

  const pdfFile = await normalizeEsignUploadToPdf(input.file)
  const storagePath = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, pdfFile, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'application/pdf',
    })

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86400000).toISOString()
      : null

  const { data: doc, error: docError } = await supabase
    .from('esign_documents')
    .insert({
      organization_id: orgId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status: 'draft',
      file_path: storagePath,
      file_name: pdfFile.name,
      mime_type: 'application/pdf',
      expires_at: expiresAt,
      created_by: userId,
      client_id: input.clientId || null,
      project_id: input.projectId || null,
      template_id: input.templateId || null,
      reminder_every_days: input.reminderEveryDays || null,
    })
    .select('*')
    .single()

  if (docError || !doc) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    if (schemaMissing(docError)) throw Object.assign(new Error('ESIGN_SCHEMA_MISSING'), { cause: docError })
    throw docError ?? new Error('Failed to create document')
  }

  const signerRows = input.signers
    .filter((s) => s.name.trim())
    .map((s, index) => ({
      organization_id: orgId,
      document_id: doc.id,
      name: s.name.trim(),
      email: s.email?.trim() || null,
      signing_order: index + 1,
    }))

  const { data: signers, error: signerError } = await supabase
    .from('esign_signers')
    .insert(signerRows)
    .select('*')

  if (signerError || !signers?.length) {
    await supabase.from('esign_documents').delete().eq('id', doc.id)
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw signerError ?? new Error('Failed to create signers')
  }

  let fields: EsignField[] = []
  if (input.templateId) {
    const template = await getEsignTemplate(input.templateId)
    if (template?.field_blueprint?.length) {
      const fieldRows = template.field_blueprint.map((bp) => {
        const order = bp.signer_order ?? 1
        const signer = signers.find((s) => s.signing_order === order) ?? signers[0]
        return {
          organization_id: orgId,
          document_id: doc.id,
          signer_id: signer?.id ?? null,
          field_type: bp.field_type,
          page_index: bp.page_index,
          x_pct: bp.x_pct,
          y_pct: bp.y_pct,
          width_pct: bp.width_pct,
          height_pct: bp.height_pct,
        }
      })
      const { data: inserted } = await supabase.from('esign_fields').insert(fieldRows).select('*')
      fields = (inserted as EsignField[]) ?? []
    }
  }

  if (fields.length === 0) {
    const fieldRows: Array<Record<string, unknown>> = []
    signers.forEach((signer, index) => {
      const baseY = 72 - index * 18
      const y = Math.max(8, baseY)
      ;(['signature', 'name', 'date'] as EsignFieldType[]).forEach((fieldType, fi) => {
        const defaults = ESIGN_FIELD_DEFAULTS[fieldType]
        fieldRows.push({
          organization_id: orgId,
          document_id: doc.id,
          signer_id: signer.id,
          field_type: fieldType,
          page_index: 0,
          x_pct: 12 + fi * 2,
          y_pct: y + fi * 5,
          width_pct: defaults.width_pct,
          height_pct: defaults.height_pct,
        })
      })
    })
    const { data: inserted, error: fieldError } = await supabase
      .from('esign_fields')
      .insert(fieldRows)
      .select('*')
    if (fieldError) console.warn('Default field placement failed:', fieldError)
    fields = (inserted as EsignField[]) ?? []
  }

  void emitEsignAutomationEvent('document_created', {
    document_id: doc.id,
    title: doc.title,
    client_id: doc.client_id,
    project_id: doc.project_id,
  })

  return {
    ...(doc as EsignDocument),
    signers: signers as EsignSigner[],
    fields,
  }
}

export async function replaceEsignFields(
  documentId: string,
  fields: Array<Omit<EsignField, 'id' | 'organization_id' | 'document_id' | 'created_at'>>,
): Promise<EsignField[]> {
  const { orgId } = await requireOrg()

  const { error: delError } = await supabase
    .from('esign_fields')
    .delete()
    .eq('document_id', documentId)
    .eq('organization_id', orgId)

  if (delError) throw delError

  if (fields.length === 0) return []

  const { data, error } = await supabase
    .from('esign_fields')
    .insert(
      fields.map((f) => ({
        organization_id: orgId,
        document_id: documentId,
        signer_id: f.signer_id,
        field_type: f.field_type,
        page_index: f.page_index,
        x_pct: f.x_pct,
        y_pct: f.y_pct,
        width_pct: f.width_pct,
        height_pct: f.height_pct,
      })),
    )
    .select('*')

  if (error) throw error
  return (data as EsignField[]) ?? []
}

export async function sendEsignDocument(documentId: string): Promise<EsignDocument> {
  const { orgId } = await requireOrg()
  const { data, error } = await supabase
    .from('esign_documents')
    .update({ status: 'pending' })
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .select('*')
    .single()

  if (error) throw error
  void emitEsignAutomationEvent('document_sent', { document_id: documentId, title: data.title })
  return data as EsignDocument
}

export async function cancelEsignDocument(documentId: string): Promise<void> {
  const { orgId } = await requireOrg()
  const { error } = await supabase
    .from('esign_documents')
    .update({ status: 'cancelled' })
    .eq('id', documentId)
    .eq('organization_id', orgId)
  if (error) throw error
  void emitEsignAutomationEvent('document_cancelled', { document_id: documentId })
}

export async function bulkCancelEsignDocuments(ids: string[]): Promise<number> {
  if (!ids.length) return 0
  const { orgId } = await requireOrg()
  const { data, error } = await supabase
    .from('esign_documents')
    .update({ status: 'cancelled' })
    .eq('organization_id', orgId)
    .in('id', ids)
    .select('id')
  if (error) throw error
  for (const row of data ?? []) {
    void emitEsignAutomationEvent('document_cancelled', { document_id: row.id })
  }
  return data?.length ?? 0
}

export async function bulkDeleteEsignDocuments(ids: string[]): Promise<number> {
  let deleted = 0
  for (const id of ids) {
    await deleteEsignDocument(id)
    deleted += 1
  }
  return deleted
}

export async function deleteEsignDocument(documentId: string): Promise<void> {
  const { orgId } = await requireOrg()
  const doc = await getEsignDocument(documentId)
  if (!doc) return

  const paths = [doc.file_path, doc.signed_file_path].filter(Boolean) as string[]
  for (const signer of doc.signers) {
    if (signer.signature_image_path) paths.push(signer.signature_image_path)
  }

  const { error } = await supabase
    .from('esign_documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', orgId)

  if (error) throw error
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

export async function markEsignReminded(documentId: string): Promise<void> {
  const { orgId } = await requireOrg()
  const { error } = await supabase
    .from('esign_documents')
    .update({ last_reminded_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('organization_id', orgId)
  if (error) throw error
  void emitEsignAutomationEvent('document_reminded', { document_id: documentId })
}

export async function listEsignTemplates(): Promise<EsignTemplate[]> {
  if (!isSupabaseConfigured) return []
  const { orgId } = await requireOrg()
  const { data, error } = await supabase
    .from('esign_templates')
    .select('*')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false })
  if (error) {
    if (schemaMissing(error)) return []
    throw error
  }
  return ((data ?? []) as EsignTemplate[]).map((t) => ({
    ...t,
    field_blueprint: Array.isArray(t.field_blueprint) ? t.field_blueprint : [],
  }))
}

export async function getEsignTemplate(id: string): Promise<EsignTemplate | null> {
  const { orgId } = await requireOrg()
  const { data, error } = await supabase
    .from('esign_templates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle()
  if (error) {
    if (schemaMissing(error)) return null
    throw error
  }
  if (!data) return null
  const t = data as EsignTemplate
  return {
    ...t,
    field_blueprint: Array.isArray(t.field_blueprint) ? t.field_blueprint : [],
  }
}

export async function createEsignTemplate(input: {
  name: string
  description?: string
  defaultTitle?: string
  fieldBlueprint?: EsignFieldBlueprint[]
  defaultSignerCount: number
}): Promise<EsignTemplate> {
  const { orgId, userId } = await requireOrg()
  const { data, error } = await supabase
    .from('esign_templates')
    .insert({
      organization_id: orgId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      default_title: input.defaultTitle?.trim() || null,
      field_blueprint: input.fieldBlueprint ?? [],
      default_signer_count: input.defaultSignerCount,
      created_by: userId,
    })
    .select('*')
    .single()
  if (error) {
    if (schemaMissing(error)) {
      throw new Error('Templates table missing. Run supabase-esign-v2-migration.sql in Supabase.')
    }
    throw error
  }
  return data as EsignTemplate
}

export async function updateEsignTemplateBlueprint(
  templateId: string,
  fieldBlueprint: EsignFieldBlueprint[],
): Promise<EsignTemplate> {
  const { orgId } = await requireOrg()
  const { data, error } = await supabase
    .from('esign_templates')
    .update({
      field_blueprint: fieldBlueprint,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .eq('organization_id', orgId)
    .select('*')
    .single()
  if (error) throw error
  return data as EsignTemplate
}

export async function deleteEsignTemplate(id: string): Promise<void> {
  const { orgId } = await requireOrg()
  const { error } = await supabase
    .from('esign_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw error
}

export async function saveDocumentAsTemplate(
  doc: EsignDocumentWithRelations,
  name: string,
  description?: string,
): Promise<EsignTemplate> {
  const signerOrderById = new Map(doc.signers.map((s) => [s.id, s.signing_order]))
  const blueprint: EsignFieldBlueprint[] = doc.fields.map((f) => ({
    field_type: f.field_type,
    page_index: f.page_index,
    x_pct: f.x_pct,
    y_pct: f.y_pct,
    width_pct: f.width_pct,
    height_pct: f.height_pct,
    signer_order: f.signer_id ? signerOrderById.get(f.signer_id) : 1,
  }))

  // If this request was started from a template, update that template's layout
  if (doc.template_id) {
    const { orgId } = await requireOrg()
    const { data, error } = await supabase
      .from('esign_templates')
      .update({
        name: name.trim(),
        description: description ?? doc.description ?? null,
        default_title: doc.title,
        field_blueprint: blueprint,
        default_signer_count: Math.max(1, doc.signers.length),
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.template_id)
      .eq('organization_id', orgId)
      .select('*')
      .single()
    if (!error && data) return data as EsignTemplate
  }

  return createEsignTemplate({
    name,
    description: description ?? doc.description ?? undefined,
    defaultTitle: doc.title,
    fieldBlueprint: blueprint,
    defaultSignerCount: Math.max(1, doc.signers.length),
  })
}

export async function updateEsignSignerEmail(
  signerId: string,
  email: string | null,
): Promise<EsignSigner> {
  const { orgId } = await requireOrg()
  const { data, error } = await supabase
    .from('esign_signers')
    .update({ email: email?.trim() || null })
    .eq('id', signerId)
    .eq('organization_id', orgId)
    .select('*')
    .single()
  if (error) throw error
  return data as EsignSigner
}

export async function updateEsignDocumentMeta(
  documentId: string,
  patch: { title?: string; description?: string | null },
): Promise<EsignDocument> {
  const { orgId } = await requireOrg()
  const { data, error } = await supabase
    .from('esign_documents')
    .update({
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .select('*')
    .single()
  if (error) throw error
  return data as EsignDocument
}

export async function getEsignFileSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) throw error ?? new Error('Could not create signed URL')
  return data.signedUrl
}

export function buildSigningUrl(token: string): string {
  if (typeof window === 'undefined') return `/sign/${token}`
  return `${window.location.origin}/sign/${token}`
}

export async function fetchSigningPacket(token: string): Promise<EsignSigningPacket> {
  const res = await fetch(`/api/esign?action=packet&token=${encodeURIComponent(token)}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Unable to load signing request')
  const packet = body as EsignSigningPacket
  return {
    ...packet,
    organization: packet.organization ?? {
      name: 'Secure signature request',
      logoUrl: null,
    },
    fields: Array.isArray(packet.fields) ? packet.fields : [],
  }
}

export async function fetchSigningFile(token: string): Promise<ArrayBuffer> {
  const res = await fetch(`/api/esign?action=file&token=${encodeURIComponent(token)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Unable to load document')
  }
  return res.arrayBuffer()
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function submitSignature(input: {
  token: string
  signatureText?: string | null
  signatureImageDataUrl?: string | null
  signedPdfBytes?: Uint8Array | null
}): Promise<{ ok: true }> {
  const res = await fetch('/api/esign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sign',
      token: input.token,
      signatureText: input.signatureText ?? null,
      signatureImageDataUrl: input.signatureImageDataUrl ?? null,
      signedPdfBase64: input.signedPdfBytes ? bytesToBase64(input.signedPdfBytes) : null,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Signing failed')
  return { ok: true }
}
