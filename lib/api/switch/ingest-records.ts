/**
 * Switch record ingest — upsert canonical entities into Katana tables
 * POST /switch/ingest/records
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { authenticateSwitchRequest, getAdminClient } from './switch-auth'
import { resolveSwitchIngestJobId } from './ingest-job'
import { getCanonicalEntity, type SwitchEntityType } from './canonical-entities'
import { SWITCH_MAX_RECORDS_PER_REQUEST } from './switch-config'
import { switchError, switchJson, withCors, corsHeaders } from './switch-errors'

type RecordOperation = 'upsert' | 'delete'

interface IngestRecordInput {
  entity_type: SwitchEntityType
  external_id: string
  operation?: RecordOperation
  payload: Record<string, unknown>
  relationships?: Record<string, string>
}

interface RecordResult {
  external_id: string
  entity_type: string
  status: 'ingested' | 'deleted' | 'failed'
  katana_id?: string
  error_code?: string
  error_message?: string
}

async function resolveMapping(
  admin: SupabaseClient,
  orgId: string,
  entityType: string,
  externalId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('switch_entity_mappings')
    .select('katana_id')
    .eq('organization_id', orgId)
    .eq('entity_type', entityType)
    .eq('external_id', externalId)
    .maybeSingle()

  return (data?.katana_id as string | null) ?? null
}

async function saveMapping(
  admin: SupabaseClient,
  orgId: string,
  entityType: string,
  externalId: string,
  katanaId: string,
  katanaTable: string,
  jobId: string,
): Promise<void> {
  await admin.from('switch_entity_mappings').upsert(
    {
      organization_id: orgId,
      entity_type: entityType,
      external_id: externalId,
      katana_id: katanaId,
      katana_table: katanaTable,
      last_job_id: jobId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,entity_type,external_id' },
  )
}

function todayFallback(): string {
  return new Date().toISOString().slice(0, 10)
}

async function upsertEntity(
  admin: SupabaseClient,
  auth: { organizationId: string; actingUserId: string | null },
  record: IngestRecordInput,
  jobId: string,
): Promise<{ katanaId: string }> {
  const def = getCanonicalEntity(record.entity_type)
  if (!def) throw new Error(`Unsupported entity_type: ${record.entity_type}`)

  const existingId = await resolveMapping(
    admin,
    auth.organizationId,
    record.entity_type,
    record.external_id,
  )

  const payload = { ...record.payload }
  const now = new Date().toISOString()
  const userId = auth.actingUserId

  switch (record.entity_type) {
    case 'project': {
      const row = {
        name: String(payload.name ?? 'Imported project'),
        status: String(payload.status ?? 'active'),
        progress: Number(payload.progress ?? 0),
        deadline: String(payload.deadline ?? todayFallback()),
        starred: Boolean(payload.starred ?? false),
        owner_name: String(payload.owner_name ?? ''),
        created_by_name: String(payload.created_by_name ?? 'Switch'),
        updated_at: now,
        ...(userId ? { user_id: userId } : {}),
      }

      if (existingId) {
        const { error } = await admin.from('projects').update(row).eq('id', existingId)
        if (error) throw new Error(error.message)
        await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, existingId, def.katana_table, jobId)
        return { katanaId: existingId }
      }

      const { data, error } = await admin.from('projects').insert(row).select('id').single()
      if (error || !data) throw new Error(error?.message ?? 'Insert failed')
      const id = data.id as string
      await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, id, def.katana_table, jobId)
      return { katanaId: id }
    }

    case 'task': {
      const projectExtId = record.relationships?.project_external_id
      if (!projectExtId) throw new Error('relationships.project_external_id is required for tasks')

      const projectId = await resolveMapping(admin, auth.organizationId, 'project', projectExtId)
      if (!projectId) throw new Error(`Unknown project external_id: ${projectExtId}`)

      const row = {
        project_id: projectId,
        title: String(payload.title ?? 'Imported task'),
        status: String(payload.status ?? 'todo'),
        priority: String(payload.priority ?? 'medium'),
        assignee_name: String(payload.assignee_name ?? ''),
        assignee_avatar: '',
        deadline: String(payload.deadline ?? todayFallback()),
        progress: Number(payload.progress ?? 0),
        description: payload.description ? String(payload.description) : null,
        start_date: payload.start_date ? String(payload.start_date) : null,
        order_index: Number(payload.order_index ?? 0),
        updated_at: now,
        ...(userId ? { user_id: userId } : {}),
      }

      if (existingId) {
        const { error } = await admin.from('tasks').update(row).eq('id', existingId)
        if (error) throw new Error(error.message)
        await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, existingId, def.katana_table, jobId)
        return { katanaId: existingId }
      }

      const { data, error } = await admin.from('tasks').insert(row).select('id').single()
      if (error || !data) throw new Error(error?.message ?? 'Insert failed')
      const id = data.id as string
      await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, id, def.katana_table, jobId)
      return { katanaId: id }
    }

    case 'milestone': {
      const projectExtId = record.relationships?.project_external_id
      if (!projectExtId) throw new Error('relationships.project_external_id is required for milestones')

      const projectId = await resolveMapping(admin, auth.organizationId, 'project', projectExtId)
      if (!projectId) throw new Error(`Unknown project external_id: ${projectExtId}`)

      const row = {
        project_id: projectId,
        name: String(payload.name ?? 'Imported milestone'),
        date: String(payload.date ?? todayFallback()),
        status: String(payload.status ?? 'upcoming'),
        description: payload.description ? String(payload.description) : null,
        updated_at: now,
        ...(userId ? { user_id: userId } : {}),
      }

      if (existingId) {
        const { error } = await admin.from('milestones').update(row).eq('id', existingId)
        if (error) throw new Error(error.message)
        await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, existingId, def.katana_table, jobId)
        return { katanaId: existingId }
      }

      const { data, error } = await admin.from('milestones').insert(row).select('id').single()
      if (error || !data) throw new Error(error?.message ?? 'Insert failed')
      const id = data.id as string
      await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, id, def.katana_table, jobId)
      return { katanaId: id }
    }

    case 'customer': {
      const row = {
        name: String(payload.name ?? 'Imported customer'),
        industry: String(payload.industry ?? ''),
        status: String(payload.status ?? 'healthy'),
        health_score: Number(payload.health_score ?? 80),
        arr: Number(payload.arr ?? 0),
        renewal_date: String(payload.renewal_date ?? todayFallback()),
        nps_score: Number(payload.nps_score ?? 0),
        engagement_score: Number(payload.engagement_score ?? 0),
        churn_risk: Number(payload.churn_risk ?? 0),
        churn_trend: String(payload.churn_trend ?? 'stable'),
        updated_at: now,
        ...(userId ? { user_id: userId } : {}),
      }

      if (existingId) {
        const { error } = await admin.from('cs_clients').update(row).eq('id', existingId)
        if (error) throw new Error(error.message)
        await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, existingId, def.katana_table, jobId)
        return { katanaId: existingId }
      }

      const { data, error } = await admin.from('cs_clients').insert(row).select('id').single()
      if (error || !data) throw new Error(error?.message ?? 'Insert failed')
      const id = data.id as string
      await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, id, def.katana_table, jobId)
      return { katanaId: id }
    }

    case 'employee': {
      const row = {
        name: String(payload.name ?? 'Imported employee'),
        email: String(payload.email ?? `import-${record.external_id}@switch.local`),
        position: String(payload.position ?? 'Team Member'),
        department: String(payload.department ?? 'General'),
        status: String(payload.status ?? 'Active'),
        phone: payload.phone ? String(payload.phone) : null,
        hire_date: String(payload.hire_date ?? todayFallback()),
        performance_score: payload.performance_score != null ? Number(payload.performance_score) : null,
        updated_at: now,
        ...(userId ? { user_id: userId } : {}),
      }

      if (existingId) {
        const { error } = await admin.from('hr_employees').update(row).eq('id', existingId)
        if (error) throw new Error(error.message)
        await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, existingId, def.katana_table, jobId)
        return { katanaId: existingId }
      }

      const { data, error } = await admin.from('hr_employees').insert(row).select('id').single()
      if (error || !data) throw new Error(error?.message ?? 'Insert failed')
      const id = data.id as string
      await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, id, def.katana_table, jobId)
      return { katanaId: id }
    }

    case 'inventory_item': {
      const row = {
        product_name: String(payload.product_name ?? 'Imported item'),
        sku: String(payload.sku ?? ''),
        on_hand_qty: Number(payload.on_hand_qty ?? 0),
        min_qty: Number(payload.min_qty ?? 0),
        location: payload.location ? String(payload.location) : null,
        category: payload.category ? String(payload.category) : null,
        status: String(payload.status ?? 'in-stock'),
        is_active: payload.is_active !== false,
        updated_at: now,
        organization_id: auth.organizationId,
        ...(userId ? { user_id: userId } : {}),
      }

      if (existingId) {
        const { error } = await admin.from('inventory_items').update(row).eq('id', existingId)
        if (error) throw new Error(error.message)
        await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, existingId, def.katana_table, jobId)
        return { katanaId: existingId }
      }

      const { data, error } = await admin.from('inventory_items').insert(row).select('id').single()
      if (error || !data) throw new Error(error?.message ?? 'Insert failed')
      const id = data.id as string
      await saveMapping(admin, auth.organizationId, record.entity_type, record.external_id, id, def.katana_table, jobId)
      return { katanaId: id }
    }

    default:
      throw new Error(`Unsupported entity_type: ${record.entity_type}`)
  }
}

async function deleteEntity(
  admin: SupabaseClient,
  auth: { organizationId: string },
  record: IngestRecordInput,
): Promise<void> {
  const def = getCanonicalEntity(record.entity_type)
  if (!def) throw new Error(`Unsupported entity_type: ${record.entity_type}`)

  const katanaId = await resolveMapping(
    admin,
    auth.organizationId,
    record.entity_type,
    record.external_id,
  )
  if (!katanaId) return

  const { error } = await admin.from(def.katana_table).delete().eq('id', katanaId)
  if (error) throw new Error(error.message)

  await admin
    .from('switch_entity_mappings')
    .delete()
    .eq('organization_id', auth.organizationId)
    .eq('entity_type', record.entity_type)
    .eq('external_id', record.external_id)
}

export async function handleSwitchIngestRecords(req: Request): Promise<Response> {
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

  const records = body.records as IngestRecordInput[] | undefined
  if (!Array.isArray(records) || records.length === 0) {
    return withCors(
      switchError(400, 'VALIDATION_ERROR', 'records array is required', {
        details: [{ field: 'records', message: 'At least one record required' }],
      }),
    )
  }

  if (records.length > SWITCH_MAX_RECORDS_PER_REQUEST) {
    return withCors(
      switchError(400, 'VALIDATION_ERROR', `Maximum ${SWITCH_MAX_RECORDS_PER_REQUEST} records per request`),
    )
  }

  const sourceSystem = body.source_system ? String(body.source_system) : null
  const requestedJobId = body.job_id ? String(body.job_id) : null

  const resolved = await resolveSwitchIngestJobId(admin, {
    organizationId: auth.organizationId,
    clientRef: auth.clientRef,
    requestedJobId,
    sourceSystem,
    jobType: 'records',
  })
  if ('error' in resolved) {
    return withCors(switchError(500, 'INTERNAL_ERROR', resolved.error))
  }
  const jobId = resolved.jobId

  const results: RecordResult[] = []
  let accepted = 0
  let failed = 0

  for (const record of records) {
    const externalId = String(record.external_id ?? '').trim()
    const entityType = record.entity_type
    const operation: RecordOperation = record.operation ?? 'upsert'

    if (!externalId || !entityType) {
      failed++
      results.push({
        external_id: externalId || '(missing)',
        entity_type: String(entityType ?? ''),
        status: 'failed',
        error_code: 'VALIDATION_ERROR',
        error_message: 'external_id and entity_type are required',
      })
      continue
    }

    if (!getCanonicalEntity(entityType)) {
      failed++
      results.push({
        external_id: externalId,
        entity_type: entityType,
        status: 'failed',
        error_code: 'VALIDATION_ERROR',
        error_message: `Unknown entity_type: ${entityType}`,
      })
      continue
    }

    try {
      if (operation === 'delete') {
        await deleteEntity(admin, auth, record)
        accepted++
        results.push({ external_id: externalId, entity_type: entityType, status: 'deleted' })
      } else {
        const { katanaId } = await upsertEntity(admin, auth, record, jobId)
        accepted++
        results.push({
          external_id: externalId,
          entity_type: entityType,
          status: 'ingested',
          katana_id: katanaId,
        })
      }
    } catch (e) {
      failed++
      const message = e instanceof Error ? e.message : 'Record ingest failed'
      results.push({
        external_id: externalId,
        entity_type: entityType,
        status: 'failed',
        error_code: 'INGEST_FAILED',
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
      error_summary: failed > 0 ? `${failed} record(s) failed` : null,
    })
    .eq('id', jobId)

  const status = failed > 0 && accepted === 0 ? 422 : 200

  return withCors(
    switchJson(
      {
        job_id: jobId,
        accepted,
        failed,
        results,
      },
      status,
    ),
  )
}
