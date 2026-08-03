/**
 * KYI private tenant CRM — org-scoped tasks, documents, activity, valuations.
 * Never writes to kyi_global_investors. Additive to existing investor notes/outreach.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCurrentUserId, getOrganizationId } from '@/lib/auth-helpers'
import { getOrganizationUsers } from '@/lib/tenant-context'

export const KYI_FILES_BUCKET = 'kyi-files'

function requireSupabase(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured')
  }
}

async function assertInvestorInOrg(investorId: number): Promise<{
  id: number
  company_id: number | null
  organization_id: string
}> {
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('kyi_investors')
    .select('id, company_id, organization_id')
    .eq('id', investorId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load investor')
  if (!data) throw new Error('Investor not found')
  return {
    id: data.id as number,
    company_id: (data.company_id as number) ?? null,
    organization_id: orgId,
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

export type KyiTaskStatus = 'open' | 'done' | 'cancelled'
export type KyiActivityType = 'note' | 'meeting' | 'email' | 'call' | 'intro' | 'other'

export interface KyiInvestorTask {
  id: number
  investor_id: number
  company_id: number | null
  title: string
  description: string | null
  due_at: string | null
  status: KyiTaskStatus
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface KyiInvestorDocument {
  id: number
  investor_id: number
  company_id: number | null
  title: string
  document_url: string | null
  storage_path: string | null
  mime_type: string | null
  file_size: number | null
  is_nda: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface KyiInvestorActivity {
  id: number
  investor_id: number
  company_id: number | null
  activity_type: KyiActivityType
  summary: string
  occurred_at: string
  created_by: string | null
  created_at: string
}

export interface KyiInvestorValuation {
  id: number
  investor_id: number
  company_id: number | null
  label: string
  pre_money: number | null
  post_money: number | null
  amount_discussed: number | null
  currency: string
  notes: string | null
  discussed_at: string
  created_by: string | null
  created_at: string
  updated_at: string
}

function mapTask(row: Record<string, unknown>): KyiInvestorTask {
  return {
    id: Number(row.id),
    investor_id: Number(row.investor_id),
    company_id: row.company_id != null ? Number(row.company_id) : null,
    title: String(row.title ?? ''),
    description: (row.description as string) ?? null,
    due_at: (row.due_at as string) ?? null,
    status: (row.status as KyiTaskStatus) ?? 'open',
    assigned_to: (row.assigned_to as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function mapDoc(row: Record<string, unknown>): KyiInvestorDocument {
  return {
    id: Number(row.id),
    investor_id: Number(row.investor_id),
    company_id: row.company_id != null ? Number(row.company_id) : null,
    title: String(row.title ?? ''),
    document_url: (row.document_url as string) ?? null,
    storage_path: (row.storage_path as string) ?? null,
    mime_type: (row.mime_type as string) ?? null,
    file_size: row.file_size != null ? Number(row.file_size) : null,
    is_nda: !!(row.is_nda ?? false),
    notes: (row.notes as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function mapActivity(row: Record<string, unknown>): KyiInvestorActivity {
  return {
    id: Number(row.id),
    investor_id: Number(row.investor_id),
    company_id: row.company_id != null ? Number(row.company_id) : null,
    activity_type: (row.activity_type as KyiActivityType) ?? 'note',
    summary: String(row.summary ?? ''),
    occurred_at: String(row.occurred_at ?? ''),
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at ?? ''),
  }
}

function mapValuation(row: Record<string, unknown>): KyiInvestorValuation {
  return {
    id: Number(row.id),
    investor_id: Number(row.investor_id),
    company_id: row.company_id != null ? Number(row.company_id) : null,
    label: String(row.label ?? 'Discussion'),
    pre_money: row.pre_money != null ? Number(row.pre_money) : null,
    post_money: row.post_money != null ? Number(row.post_money) : null,
    amount_discussed: row.amount_discussed != null ? Number(row.amount_discussed) : null,
    currency: String(row.currency ?? 'USD'),
    notes: (row.notes as string) ?? null,
    discussed_at: String(row.discussed_at ?? ''),
    created_by: (row.created_by as string) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export async function listInvestorTasks(investorId: number): Promise<KyiInvestorTask[]> {
  requireSupabase()
  await assertInvestorInOrg(investorId)
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('kyi_investor_tasks')
    .select('*')
    .eq('investor_id', investorId)
    .eq('organization_id', orgId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load tasks')
  return (data ?? []).map((r) => mapTask(r as Record<string, unknown>))
}

export async function createInvestorTask(
  investorId: number,
  input: { title: string; description?: string; due_at?: string | null; assigned_to?: string | null },
): Promise<KyiInvestorTask> {
  requireSupabase()
  const inv = await assertInvestorInOrg(investorId)
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('kyi_investor_tasks')
    .insert({
      organization_id: inv.organization_id,
      investor_id: inv.id,
      company_id: inv.company_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      due_at: input.due_at || null,
      assigned_to: input.assigned_to || null,
      status: 'open',
      created_by: userId,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message || 'Failed to create task')
  return mapTask(data as Record<string, unknown>)
}

export async function updateInvestorTask(
  taskId: number,
  patch: Partial<{ title: string; description: string | null; due_at: string | null; status: KyiTaskStatus; assigned_to: string | null }>,
): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { error } = await supabase
    .from('kyi_investor_tasks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to update task')
}

export async function deleteInvestorTask(taskId: number): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { error } = await supabase
    .from('kyi_investor_tasks')
    .delete()
    .eq('id', taskId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to delete task')
}

// ── Documents ──────────────────────────────────────────────────────────────

export async function listInvestorDocuments(investorId: number): Promise<KyiInvestorDocument[]> {
  requireSupabase()
  await assertInvestorInOrg(investorId)
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('kyi_investor_documents')
    .select('*')
    .eq('investor_id', investorId)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load documents')
  return (data ?? []).map((r) => mapDoc(r as Record<string, unknown>))
}

export async function createInvestorDocument(
  investorId: number,
  input: {
    title: string
    document_url?: string
    is_nda?: boolean
    notes?: string
    storage_path?: string
    mime_type?: string
    file_size?: number
  },
): Promise<KyiInvestorDocument> {
  requireSupabase()
  const inv = await assertInvestorInOrg(investorId)
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    organization_id: inv.organization_id,
    investor_id: inv.id,
    company_id: inv.company_id,
    title: input.title.trim(),
    document_url: input.document_url?.trim() || null,
    is_nda: !!input.is_nda,
    notes: input.notes?.trim() || null,
    created_by: userId,
    created_at: now,
    updated_at: now,
  }
  if (input.storage_path) payload.storage_path = input.storage_path
  if (input.mime_type) payload.mime_type = input.mime_type
  if (input.file_size != null) payload.file_size = input.file_size

  let { data, error } = await supabase
    .from('kyi_investor_documents')
    .insert(payload)
    .select('*')
    .single()

  // Migration not applied yet — retry without storage columns
  if (error && (error.message ?? '').includes('does not exist')) {
    delete payload.storage_path
    delete payload.mime_type
    delete payload.file_size
    ;({ data, error } = await supabase
      .from('kyi_investor_documents')
      .insert(payload)
      .select('*')
      .single())
  }

  if (error || !data) throw new Error(error?.message || 'Failed to create document')
  return mapDoc(data as Record<string, unknown>)
}

/** Upload a private NDA/doc into org-scoped storage, then create the document row. */
export async function uploadInvestorDocumentFile(
  investorId: number,
  file: File,
  opts?: { is_nda?: boolean; title?: string },
): Promise<KyiInvestorDocument> {
  requireSupabase()
  const inv = await assertInvestorInOrg(investorId)
  const orgId = inv.organization_id
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
  const path = `${orgId}/${investorId}/${Date.now()}_${safeName}`

  const { error: upErr } = await supabase.storage.from(KYI_FILES_BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) {
    const msg = upErr.message || 'Upload failed'
    if (msg.toLowerCase().includes('bucket') || msg.includes('not found')) {
      throw new Error(
        'Storage bucket missing. Run supabase-kyi-files-bucket-migration.sql in Supabase.',
      )
    }
    throw new Error(msg)
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(KYI_FILES_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7) // 7 days
  if (signErr) {
    console.warn('[kyi-private-crm] signed URL failed:', signErr.message)
  }

  return createInvestorDocument(investorId, {
    title: opts?.title?.trim() || file.name,
    document_url: signed?.signedUrl,
    storage_path: path,
    mime_type: file.type || undefined,
    file_size: file.size,
    is_nda: opts?.is_nda,
  })
}

export async function getInvestorDocumentDownloadUrl(doc: KyiInvestorDocument): Promise<string | null> {
  requireSupabase()
  if (doc.storage_path) {
    const { data, error } = await supabase.storage
      .from(KYI_FILES_BUCKET)
      .createSignedUrl(doc.storage_path, 60 * 30)
    if (!error && data?.signedUrl) return data.signedUrl
  }
  return doc.document_url
}

export async function deleteInvestorDocument(documentId: number): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { data: row } = await supabase
    .from('kyi_investor_documents')
    .select('id, storage_path')
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (row?.storage_path) {
    await supabase.storage.from(KYI_FILES_BUCKET).remove([String(row.storage_path)])
  }

  const { error } = await supabase
    .from('kyi_investor_documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to delete document')
}

// ── Activity ───────────────────────────────────────────────────────────────

export async function listInvestorActivity(investorId: number): Promise<KyiInvestorActivity[]> {
  requireSupabase()
  await assertInvestorInOrg(investorId)
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('kyi_investor_activity')
    .select('*')
    .eq('investor_id', investorId)
    .eq('organization_id', orgId)
    .order('occurred_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message || 'Failed to load activity')
  return (data ?? []).map((r) => mapActivity(r as Record<string, unknown>))
}

export async function createInvestorActivity(
  investorId: number,
  input: { activity_type: KyiActivityType; summary: string; occurred_at?: string },
): Promise<KyiInvestorActivity> {
  requireSupabase()
  const inv = await assertInvestorInOrg(investorId)
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('kyi_investor_activity')
    .insert({
      organization_id: inv.organization_id,
      investor_id: inv.id,
      company_id: inv.company_id,
      activity_type: input.activity_type,
      summary: input.summary.trim(),
      occurred_at: input.occurred_at || new Date().toISOString(),
      created_by: userId,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message || 'Failed to create activity')
  return mapActivity(data as Record<string, unknown>)
}

export async function deleteInvestorActivity(activityId: number): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { error } = await supabase
    .from('kyi_investor_activity')
    .delete()
    .eq('id', activityId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to delete activity')
}

// ── Valuations ─────────────────────────────────────────────────────────────

export async function listInvestorValuations(investorId: number): Promise<KyiInvestorValuation[]> {
  requireSupabase()
  await assertInvestorInOrg(investorId)
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('kyi_investor_valuations')
    .select('*')
    .eq('investor_id', investorId)
    .eq('organization_id', orgId)
    .order('discussed_at', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load valuations')
  return (data ?? []).map((r) => mapValuation(r as Record<string, unknown>))
}

export async function createInvestorValuation(
  investorId: number,
  input: {
    label?: string
    pre_money?: number | null
    post_money?: number | null
    amount_discussed?: number | null
    currency?: string
    notes?: string
    discussed_at?: string
  },
): Promise<KyiInvestorValuation> {
  requireSupabase()
  const inv = await assertInvestorInOrg(investorId)
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('kyi_investor_valuations')
    .insert({
      organization_id: inv.organization_id,
      investor_id: inv.id,
      company_id: inv.company_id,
      label: input.label?.trim() || 'Discussion',
      pre_money: input.pre_money ?? null,
      post_money: input.post_money ?? null,
      amount_discussed: input.amount_discussed ?? null,
      currency: input.currency?.trim() || 'USD',
      notes: input.notes?.trim() || null,
      discussed_at: input.discussed_at || now,
      created_by: userId,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message || 'Failed to create valuation')
  return mapValuation(data as Record<string, unknown>)
}

export async function deleteInvestorValuation(valuationId: number): Promise<void> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const { error } = await supabase
    .from('kyi_investor_valuations')
    .delete()
    .eq('id', valuationId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to delete valuation')
}

// ── Rating / assignee on investor ──────────────────────────────────────────

export async function updateInvestorPrivateFields(
  investorId: number,
  patch: { internal_rating?: number | null; assigned_team_member?: string | null },
): Promise<void> {
  requireSupabase()
  await assertInvestorInOrg(investorId)
  const orgId = await getOrganizationId()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('internal_rating' in patch) {
    const r = patch.internal_rating
    if (r != null && (r < 1 || r > 5)) throw new Error('Rating must be 1–5')
    payload.internal_rating = r
  }
  if ('assigned_team_member' in patch) {
    payload.assigned_team_member = patch.assigned_team_member
  }
  const { error } = await supabase
    .from('kyi_investors')
    .update(payload)
    .eq('id', investorId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message || 'Failed to update investor')
}

export interface KyiTeamMember {
  id: string
  full_name: string
  email: string | null
}

/** Active org members for assignee pickers (private CRM). */
export async function listOrganizationTeamMembers(): Promise<KyiTeamMember[]> {
  requireSupabase()
  const orgId = await getOrganizationId()
  const users = await getOrganizationUsers(orgId)
  return users.map((u) => ({
    id: String(u.id),
    full_name:
      (typeof u.full_name === 'string' && u.full_name.trim()) ||
      (typeof u.email === 'string' && u.email.trim()) ||
      'Team member',
    email: typeof u.email === 'string' ? u.email : null,
  }))
}
