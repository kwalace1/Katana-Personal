/**
 * Katana Customers – Supabase API Layer
 * All database operations for customer success management
 */

import { supabase } from './supabase'
import { isPastDueDate } from './due-date-utils'
import { reconcileCsTasksOverdue } from './overdue-reconcile'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'

// ==================== TYPE DEFINITIONS ====================

export interface CSMUser {
  id: string
  name: string
  email: string
  avatar?: string
  auth_user_id?: string | null
  created_at: string
  updated_at: string
}

export type AccountType = 'business' | 'individual'
export type LifecycleStage = 'lead' | 'prospect' | 'customer' | 'churned'

export interface Client {
  id: string
  name: string
  industry: string
  health_score: number
  status: 'healthy' | 'moderate' | 'at-risk'
  last_contact_date: string
  churn_risk: number
  churn_trend: 'up' | 'down' | 'stable'
  nps_score: number
  arr: number
  renewal_date: string
  csm_id: string | null
  engagement_score: number
  portal_logins: number
  feature_usage: string
  support_tickets: number
  account_type: AccountType
  lifecycle_stage: LifecycleStage
  outreach_status?: string
  signals?: Record<string, unknown>
  external_signals?: Record<string, unknown>
  external_enrichment?: Record<string, unknown>
  last_external_refresh_at?: string | null
  email: string | null
  phone: string | null
  website: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string
  campaign_id?: string | null
  source_lead_id?: string | null
  lead_source?: string | null
  created_at: string
  updated_at: string
  csm?: CSMUser
}

export interface ClientTask {
  id: string
  client_id: string
  title: string
  status: 'active' | 'completed' | 'overdue'
  due_date: string
  priority: 'low' | 'medium' | 'high'
  assigned_to: string | null
  kyc_action_id?: string | null
  created_at: string
  updated_at: string
  client?: Client
  csm?: CSMUser
}

export interface ClientMilestone {
  id: string
  client_id: string
  title: string
  description?: string
  status: 'completed' | 'in-progress' | 'upcoming'
  target_date: string
  completed_date?: string
  created_at: string
  updated_at: string
  client?: Client
}

export interface ClientInteraction {
  id: string
  client_id: string
  type: 'email' | 'call' | 'meeting' | 'note'
  subject: string
  description: string
  csm_id: string | null
  interaction_date: string
  created_at: string
  client?: Client
  csm?: CSMUser
}

export interface HealthHistory {
  id: string
  client_id: string
  health_score: number
  recorded_at: string
}

// ==================== AUTOMATED CLIENT METRICS ====================
// Health score, status, and churn risk are computed from objective inputs so they stay consistent.

export type ClientStatus = 'healthy' | 'moderate' | 'at-risk'
export type ChurnTrend = 'up' | 'down' | 'stable'

export interface ComputedClientMetrics {
  health_score: number
  status: ClientStatus
  churn_risk: number
}

/**
 * Compute health score (0-100), status, and churn risk from objective client data.
 * Used so status/health/churn are automated and tied to NPS, engagement, support, contact recency, etc.
 */
export function computeClientMetrics(client: {
  nps_score: number
  engagement_score: number
  support_tickets: number
  last_contact_date: string | null
  feature_usage?: string | null
  portal_logins?: number
}): ComputedClientMetrics {
  const nps = Math.min(10, Math.max(0, client.nps_score ?? 0))
  const engagement = Math.min(100, Math.max(0, client.engagement_score ?? 0))
  const tickets = Math.max(0, client.support_tickets ?? 0)
  const usage = (client.feature_usage ?? '').toLowerCase()
  const logins = Math.max(0, client.portal_logins ?? 0)

  // Days since last contact (null or missing = treat as old)
  let daysSinceContact = 90
  if (client.last_contact_date) {
    const last = new Date(client.last_contact_date).getTime()
    if (!isNaN(last)) daysSinceContact = Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000))
  }

  // Component scores (each 0–100 scale, then we weight)
  const npsComponent = (nps / 10) * 100
  const engagementComponent = engagement
  const supportComponent = Math.max(0, 100 - tickets * 15)
  const contactComponent =
    daysSinceContact <= 7 ? 100 : daysSinceContact <= 14 ? 80 : daysSinceContact <= 30 ? 60 : daysSinceContact <= 60 ? 30 : 0
  const usageComponent =
    usage === 'high' ? 100 : usage === 'medium' ? 60 : usage === 'low' ? 25 : 50
  const loginsComponent = Math.min(100, logins * 2)

  const health_score = Math.round(
    Math.min(
      100,
      npsComponent * 0.2 +
        engagementComponent * 0.25 +
        supportComponent * 0.2 +
        contactComponent * 0.2 +
        usageComponent * 0.1 +
        loginsComponent * 0.05
    )
  )
  const clamped = Math.min(100, Math.max(0, health_score))
  const churn_risk = Math.min(100, Math.max(0, 100 - clamped))
  const status: ClientStatus = clamped >= 80 ? 'healthy' : clamped >= 60 ? 'moderate' : 'at-risk'

  return {
    health_score: clamped,
    status,
    churn_risk,
  }
}

async function recordHealthHistory(clientId: string, healthScore: number): Promise<void> {
  try {
    const userId = await getCurrentUserId()
    const orgId = await getOrganizationId()
    await supabase.from('cs_health_history').insert({
      client_id: clientId,
      health_score: healthScore,
      user_id: userId,
      organization_id: orgId,
    })
  } catch {
    // non-blocking
  }
}

function computeChurnTrend(
  previousScore: number | null,
  currentScore: number,
): ChurnTrend {
  if (previousScore == null) return 'stable'
  if (currentScore > previousScore + 3) return 'down'
  if (currentScore < previousScore - 3) return 'up'
  return 'stable'
}

function applyComputedMetrics<T extends Record<string, unknown>>(row: T): T & { health_score: number; status: ClientStatus; churn_risk: number; churn_trend: ChurnTrend } {
  const metrics = computeClientMetrics({
    nps_score: Number(row.nps_score) || 0,
    engagement_score: Number(row.engagement_score) || 0,
    support_tickets: Number(row.support_tickets) || 0,
    last_contact_date: (row.last_contact_date as string) || null,
    feature_usage: (row.feature_usage as string) || null,
    portal_logins: Number(row.portal_logins) || 0,
  })
  const churn_trend = (row.churn_trend as ChurnTrend) || 'stable'
  return { ...row, ...metrics, churn_trend } as T & { health_score: number; status: ClientStatus; churn_risk: number; churn_trend: ChurnTrend }
}

function effectiveLastContactDate(
  stored: string | null | undefined,
  latestInteraction: string | undefined,
): string | null {
  if (!latestInteraction) return stored || null
  if (!stored) return latestInteraction
  const storedMs = new Date(stored).getTime()
  const interactionMs = new Date(latestInteraction).getTime()
  if (isNaN(storedMs)) return latestInteraction
  if (isNaN(interactionMs)) return stored
  return interactionMs > storedMs ? latestInteraction : stored
}

async function fetchLatestInteractionDateByClientId(): Promise<Map<string, string>> {
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('cs_interactions')
    .select('client_id, interaction_date')
    .eq('organization_id', orgId)
    .order('interaction_date', { ascending: false })

  if (error || !data) {
    if (error) console.error('Error fetching interaction dates for last contact:', error)
    return new Map()
  }

  const latestByClient = new Map<string, string>()
  for (const row of data) {
    const clientId = row.client_id as string
    if (!latestByClient.has(clientId)) {
      latestByClient.set(clientId, row.interaction_date as string)
    }
  }
  return latestByClient
}

/** Keep cs_clients.last_contact_date aligned with the most recent logged interaction. */
export async function syncLastContactFromInteractions(clientId: string): Promise<void> {
  const { data: latest, error: latestError } = await supabase
    .from('cs_interactions')
    .select('interaction_date')
    .eq('client_id', clientId)
    .order('interaction_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) {
    console.error('Error fetching latest interaction for last contact sync:', latestError)
    return
  }

  const latestDate = latest?.interaction_date ?? null
  if (!latestDate) return

  const { data: existing, error: fetchError } = await supabase
    .from('cs_clients')
    .select('last_contact_date, nps_score, engagement_score, support_tickets, feature_usage, portal_logins, health_score')
    .eq('id', clientId)
    .maybeSingle()

  if (fetchError || !existing) {
    if (fetchError) console.error('Error fetching client for last contact sync:', fetchError)
    return
  }

  const currentDate = (existing.last_contact_date as string | null) ?? null
  const currentMs = currentDate ? new Date(currentDate).getTime() : NaN
  const latestMs = new Date(latestDate).getTime()
  if (!isNaN(currentMs) && !isNaN(latestMs) && currentMs === latestMs) return

  const metrics = computeClientMetrics({
    nps_score: Number(existing.nps_score) || 0,
    engagement_score: Number(existing.engagement_score) || 0,
    support_tickets: Number(existing.support_tickets) || 0,
    last_contact_date: latestDate,
    feature_usage: (existing.feature_usage as string) || null,
    portal_logins: Number(existing.portal_logins) || 0,
  })
  const churn_trend = computeChurnTrend(
    typeof existing.health_score === 'number' ? existing.health_score : null,
    metrics.health_score,
  )

  const { error: updateError } = await supabase
    .from('cs_clients')
    .update({
      last_contact_date: latestDate,
      health_score: metrics.health_score,
      status: metrics.status,
      churn_risk: metrics.churn_risk,
      churn_trend,
    })
    .eq('id', clientId)

  if (updateError) {
    console.error('Error syncing last contact date from interactions:', updateError)
  }
}

// ==================== CSM USERS ====================

export async function getAllCSMUsers(): Promise<CSMUser[]> {
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('csm_users')
    .select('*')
    .eq('organization_id', orgId)
    .order('name')

  if (error) {
    console.error('Error fetching CSM users:', error)
    throw error
  }

  return data || []
}

export async function getCSMUserById(id: string): Promise<CSMUser | null> {
  const { data, error } = await supabase
    .from('csm_users')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching CSM user:', error)
    return null
  }

  return data
}

export async function createCSMUser(user: Omit<CSMUser, 'id' | 'created_at' | 'updated_at'>): Promise<CSMUser | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { resolveUserIdFromEmail } = await import('@/lib/notification-recipients')
  const authUserId = await resolveUserIdFromEmail(user.email)
  const { data, error } = await supabase
    .from('csm_users')
    .insert({
      ...user,
      user_id: userId,
      organization_id: orgId,
      auth_user_id: authUserId,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Error creating CSM user:', error)
    return null
  }

  return data
}

export async function updateCSMUser(id: string, updates: Partial<CSMUser>): Promise<CSMUser | null> {
  const patch = { ...updates }
  if (updates.email) {
    const { resolveUserIdFromEmail } = await import('@/lib/notification-recipients')
    patch.auth_user_id = await resolveUserIdFromEmail(updates.email)
  }
  const { data, error } = await supabase
    .from('csm_users')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Error updating CSM user:', error)
    return null
  }

  return data
}

export async function deleteCSMUser(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('csm_users')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting CSM user:', error)
    return false
  }

  return true
}

// ==================== CLIENTS ====================

export async function getAllClients(): Promise<Client[]> {
  const orgId = await getOrganizationId()
  const [{ data, error }, latestInteractionByClient] = await Promise.all([
    supabase
      .from('cs_clients')
      .select(`
        *,
        csm:csm_users(*)
      `)
      .eq('organization_id', orgId)
      .order('name'),
    fetchLatestInteractionDateByClientId(),
  ])

  if (error) {
    console.error('Error fetching clients:', error)
    throw error
  }

  const rows = data || []
  return rows.map((row) => {
    const normalized = {
      ...row,
      last_contact_date: effectiveLastContactDate(
        row.last_contact_date as string | null,
        latestInteractionByClient.get(row.id as string),
      ),
      account_type: row.account_type ?? 'business',
      lifecycle_stage: row.lifecycle_stage ?? 'customer',
      email: row.email ?? null,
      phone: row.phone ?? null,
      website: row.website ?? null,
      address_line1: row.address_line1 ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      postal_code: row.postal_code ?? null,
      country: row.country ?? '',
    }
    return applyComputedMetrics(normalized) as Client
  })
}

export async function getClientById(id: string): Promise<Client | null> {
  const [{ data, error }, latestInteraction] = await Promise.all([
    supabase
      .from('cs_clients')
      .select(`
        *,
        csm:csm_users(*)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('cs_interactions')
      .select('interaction_date')
      .eq('client_id', id)
      .order('interaction_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (error) {
    console.error('Error fetching client:', error)
    return null
  }

  if (!data) return null
  const normalized = {
    ...data,
    last_contact_date: effectiveLastContactDate(
      data.last_contact_date as string | null,
      latestInteraction.data?.interaction_date as string | undefined,
    ),
    account_type: data.account_type ?? 'business',
    lifecycle_stage: data.lifecycle_stage ?? 'customer',
    email: data.email ?? null,
    phone: data.phone ?? null,
    website: data.website ?? null,
    address_line1: data.address_line1 ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    postal_code: data.postal_code ?? null,
    country: data.country ?? '',
  }
  return applyComputedMetrics(normalized) as Client
}

export async function createClient(client: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'csm'>): Promise<Client | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const metrics = computeClientMetrics({
    nps_score: client.nps_score ?? 0,
    engagement_score: client.engagement_score ?? 0,
    support_tickets: client.support_tickets ?? 0,
    last_contact_date: client.last_contact_date ?? null,
    feature_usage: client.feature_usage ?? null,
    portal_logins: client.portal_logins ?? 0,
  })
  const crmDefaults = {
    account_type: client.account_type ?? 'business',
    lifecycle_stage: client.lifecycle_stage ?? 'customer',
    email: client.email ?? null,
    phone: client.phone ?? null,
    website: client.website ?? null,
    address_line1: client.address_line1 ?? null,
    city: client.city ?? null,
    state: client.state ?? null,
    postal_code: client.postal_code ?? null,
    country: client.country ?? '',
  }
  const payload = { ...client, ...metrics, ...crmDefaults, churn_trend: 'stable' as ChurnTrend, user_id: userId, organization_id: orgId }

  const { data, error } = await supabase
    .from('cs_clients')
    .insert(payload)
    .select(`
      *,
      csm:csm_users(*)
    `)
    .single()

  if (error) {
    console.error('Error creating client:', error)
    return null
  }

  if (!data) return null
  const created = applyComputedMetrics(data) as Client
  void recordHealthHistory(created.id, created.health_score)
  const { notifyCsNewClientForCsm, notifyCsFollowUpScheduled } = await import('@/lib/notification-modules')
  void notifyCsNewClientForCsm(created)
  void notifyCsFollowUpScheduled({ client: created, previousRenewalDate: null })
  return created
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
  const { data: existing, error: fetchError } = await supabase
    .from('cs_clients')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    console.error('Error fetching client for update:', fetchError)
    return null
  }

  const merged = { ...existing, ...updates }
  const metrics = computeClientMetrics({
    nps_score: merged.nps_score ?? 0,
    engagement_score: merged.engagement_score ?? 0,
    support_tickets: merged.support_tickets ?? 0,
    last_contact_date: merged.last_contact_date ?? null,
    feature_usage: merged.feature_usage ?? null,
    portal_logins: merged.portal_logins ?? 0,
  })
  const churn_trend = computeChurnTrend(
    typeof existing.health_score === 'number' ? existing.health_score : null,
    metrics.health_score,
  )
  const payload = { ...updates, ...metrics, churn_trend }

  const { data, error } = await supabase
    .from('cs_clients')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      csm:csm_users(*)
    `)
    .single()

  if (error) {
    console.error('Error updating client:', error)
    return null
  }

  if (!data) return null
  const updated = applyComputedMetrics(data) as Client
  if (metrics.health_score !== existing.health_score) {
    void recordHealthHistory(updated.id, updated.health_score)
  }
  const { notifyCsClientUpdate } = await import('@/lib/notification-modules')
  void notifyCsClientUpdate({
    client: updated,
    previousCsmId: existing.csm_id as string | null,
    previousStatus: existing.status as string,
    previousHealthScore: existing.health_score as number,
    previousRenewalDate: existing.renewal_date as string | null,
  })
  if (updated.status === 'at-risk' && existing.status !== 'at-risk') {
    const { notifyKycAttentionRequired } = await import('@/lib/cs-integration-notifications')
    void notifyKycAttentionRequired({
      client: updated,
      attentionScore: Math.max(0, 100 - updated.health_score),
      primaryActionLabel: null,
    })
  }
  return updated
}

export async function deleteClient(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('cs_clients')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting client:', error)
    return false
  }

  return true
}

// ==================== CLIENT TASKS ====================

export async function getAllTasks(): Promise<ClientTask[]> {
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('cs_tasks')
    .select(`
      *,
      client:cs_clients(*),
      csm:csm_users(*)
    `)
    .eq('organization_id', orgId)
    .order('due_date')

  if (error) {
    console.error('Error fetching tasks:', error)
    throw error
  }

  return reconcileCsTasksOverdue(data || [])
}

export async function getTasksByClientId(clientId: string): Promise<ClientTask[]> {
  const { data, error } = await supabase
    .from('cs_tasks')
    .select(`
      *,
      client:cs_clients(*),
      csm:csm_users(*)
    `)
    .eq('client_id', clientId)
    .order('due_date')

  if (error) {
    console.error('Error fetching client tasks:', error)
    return []
  }

  return reconcileCsTasksOverdue(data || [])
}

/** CSM on the customer account — used as default task assignee when none is provided. */
export async function getClientCsmId(clientId: string): Promise<string | null> {
  const id = clientId.trim()
  if (!id) return null

  const { data, error } = await supabase
    .from('cs_clients')
    .select('csm_id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching client CSM:', error)
    return null
  }

  const csmId = data?.csm_id
  return typeof csmId === 'string' && csmId.trim() ? csmId : null
}

export async function resolveTaskAssignee(
  clientId: string,
  assignedTo?: string | null,
): Promise<string | null> {
  const explicit = assignedTo?.trim()
  if (explicit) return explicit
  return getClientCsmId(clientId)
}

export async function createTask(task: Omit<ClientTask, 'id' | 'created_at' | 'updated_at' | 'client' | 'csm'>): Promise<ClientTask | null> {
  try {
    const userId = await getCurrentUserId()
    const orgId = await getOrganizationId()
    const assigned_to = await resolveTaskAssignee(task.client_id, task.assigned_to)
    const { data, error } = await supabase
      .from('cs_tasks')
      .insert({ ...task, assigned_to, user_id: userId, organization_id: orgId })
      .select(`
        *,
        client:cs_clients(*),
        csm:csm_users(*)
      `)
      .single()

    if (error) {
      console.error('Error creating task:', error)
      return null
    }

    if (data) {
      const { notifyCsTaskAssigned, notifyCsTaskCreated } = await import('@/lib/notification-modules')
      const createdTask = data as ClientTask
      void notifyCsTaskCreated(createdTask)
      if (createdTask.assigned_to) {
        void notifyCsTaskAssigned(createdTask, null)
      }
    }

    return data
  } catch (error) {
    console.error('Error creating task:', error)
    return null
  }
}

export async function updateTask(id: string, updates: Partial<ClientTask>): Promise<ClientTask | null> {
  const { data: prior } = await supabase
    .from('cs_tasks')
    .select('assigned_to, status, client_id, title, kyc_action_id')
    .eq('id', id)
    .maybeSingle()

  const { data, error } = await supabase
    .from('cs_tasks')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      client:cs_clients(*),
      csm:csm_users(*)
    `)
    .single()

  if (error) {
    console.error('Error updating task:', error)
    return null
  }

  if (data) {
    const { notifyCsTaskAssigned, notifyCsTaskStatusChanged } = await import('@/lib/notification-modules')
    const task = data as ClientTask
    void notifyCsTaskAssigned(task, prior?.assigned_to as string | null)
    void notifyCsTaskStatusChanged(task, prior?.status as string | null)

    if (updates.status === 'completed' && prior?.status !== 'completed') {
      const { resolveKycActionIdFromTask } = await import('@/lib/kyc-action-resolution')
      const { applyKycActionCompletionEffects } = await import('@/lib/kyc-action-completion')
      const actionId = resolveKycActionIdFromTask({
        id: task.id,
        status: task.status,
        title: task.title,
        kyc_action_id: (task.kyc_action_id ?? prior?.kyc_action_id) as string | null | undefined,
      })
      if (actionId) {
        void applyKycActionCompletionEffects(task.client_id, actionId, {
          csmId: task.assigned_to ?? (prior?.assigned_to as string | null),
        })
        const client = task.client as Client | undefined
        if (client) {
          const { notifyKycActionTaskCompleted } = await import('@/lib/cs-integration-notifications')
          void notifyKycActionTaskCompleted({
            client,
            task: {
              id: task.id,
              title: task.title,
              kyc_action_id: actionId,
            },
          })
        }
      }
    }
  }

  return data
}

export async function deleteTask(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('cs_tasks')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting task:', error)
    return false
  }

  return true
}

// ==================== CLIENT MILESTONES ====================

export async function getAllMilestones(): Promise<ClientMilestone[]> {
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('cs_milestones')
    .select(`
      *,
      client:cs_clients(*)
    `)
    .eq('organization_id', orgId)
    .order('target_date')

  if (error) {
    console.error('Error fetching milestones:', error)
    throw error
  }

  return data || []
}

export async function getMilestonesByClientId(clientId: string): Promise<ClientMilestone[]> {
  const { data, error } = await supabase
    .from('cs_milestones')
    .select(`
      *,
      client:cs_clients(*)
    `)
    .eq('client_id', clientId)
    .order('target_date')

  if (error) {
    console.error('Error fetching client milestones:', error)
    return []
  }

  return data || []
}

export async function createMilestone(milestone: Omit<ClientMilestone, 'id' | 'created_at' | 'updated_at' | 'client'>): Promise<ClientMilestone | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('cs_milestones')
    .insert({ ...milestone, user_id: userId, organization_id: orgId })
    .select(`
      *,
      client:cs_clients(*)
    `)
    .single()

  if (error) {
    console.error('Error creating milestone:', error)
    return null
  }

  if (data) {
    const { notifyCsMilestoneCreated } = await import('@/lib/notification-modules')
    void notifyCsMilestoneCreated(data as ClientMilestone)
  }

  return data
}

export async function updateMilestone(id: string, updates: Partial<ClientMilestone>): Promise<ClientMilestone | null> {
  const { data: prior } = await supabase
    .from('cs_milestones')
    .select('status, target_date, title')
    .eq('id', id)
    .maybeSingle()

  const { data, error } = await supabase
    .from('cs_milestones')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      client:cs_clients(*)
    `)
    .single()

  if (error) {
    console.error('Error updating milestone:', error)
    return null
  }

  if (data) {
    const { notifyCsMilestoneUpdated } = await import('@/lib/notification-modules')
    void notifyCsMilestoneUpdated(data as ClientMilestone, prior ?? undefined)
  }

  return data
}

export async function deleteMilestone(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('cs_milestones')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting milestone:', error)
    return false
  }

  return true
}

// ==================== CLIENT INTERACTIONS ====================

export async function getAllInteractions(): Promise<ClientInteraction[]> {
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('cs_interactions')
    .select(`
      *,
      client:cs_clients(*),
      csm:csm_users(*)
    `)
    .eq('organization_id', orgId)
    .order('interaction_date', { ascending: false })

  if (error) {
    console.error('Error fetching interactions:', error)
    throw error
  }

  return data || []
}

export async function getRecentInteractions(limit: number = 20): Promise<ClientInteraction[]> {
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('cs_interactions')
    .select(`
      *,
      client:cs_clients(*),
      csm:csm_users(*)
    `)
    .eq('organization_id', orgId)
    .order('interaction_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent interactions:', error)
    throw error
  }

  return data || []
}

export async function getInteractionsByClientId(clientId: string): Promise<ClientInteraction[]> {
  const { data, error } = await supabase
    .from('cs_interactions')
    .select(`
      *,
      client:cs_clients(*),
      csm:csm_users(*)
    `)
    .eq('client_id', clientId)
    .order('interaction_date', { ascending: false })

  if (error) {
    console.error('Error fetching client interactions:', error)
    return []
  }

  return data || []
}

export async function createInteraction(interaction: Omit<ClientInteraction, 'id' | 'created_at' | 'client' | 'csm'>): Promise<ClientInteraction | null> {
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('cs_interactions')
    .insert({ ...interaction, user_id: userId, organization_id: orgId })
    .select(`
      *,
      client:cs_clients(*),
      csm:csm_users(*)
    `)
    .single()

  if (error) {
    console.error('Error creating interaction:', error)
    return null
  }

  if (data) {
    void syncLastContactFromInteractions(interaction.client_id)
    const { outreachStatusFromInteraction, syncClientOutreachStatus } = await import('@/lib/kyc-outreach-sync')
    const outreach = outreachStatusFromInteraction(interaction.type)
    if (outreach) void syncClientOutreachStatus(interaction.client_id, outreach)
    const { notifyCsInteractionLogged } = await import('@/lib/notification-modules')
    void notifyCsInteractionLogged(data as ClientInteraction)
  }

  return data
}

export async function updateInteraction(id: string, updates: Partial<ClientInteraction>): Promise<ClientInteraction | null> {
  const { data: prior } = await supabase
    .from('cs_interactions')
    .select('type, subject, interaction_date')
    .eq('id', id)
    .maybeSingle()

  // Remove read-only fields from updates
  const { id: _, created_at, client, csm, ...updateData } = updates as Partial<ClientInteraction> & {
    id?: string
    created_at?: string
    client?: Client
    csm?: CSMUser
  }

  const { data, error } = await supabase
    .from('cs_interactions')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      client:cs_clients(*),
      csm:csm_users(*)
    `)
    .single()

  if (error) {
    console.error('Error updating interaction:', error)
    return null
  }

  if (data) {
    void syncLastContactFromInteractions(data.client_id)
    const { notifyCsInteractionUpdated } = await import('@/lib/notification-modules')
    void notifyCsInteractionUpdated(data as ClientInteraction, prior ?? undefined)
  }

  return data
}

export async function deleteInteraction(id: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('cs_interactions')
    .select('client_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase
    .from('cs_interactions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting interaction:', error)
    return false
  }

  if (existing?.client_id) {
    void syncLastContactFromInteractions(existing.client_id as string)
  }

  return true
}

// ==================== HEALTH HISTORY ====================

export async function getHealthHistory(clientId: string, limit: number = 5): Promise<HealthHistory[]> {
  const { data, error } = await supabase
    .from('cs_health_history')
    .select('*')
    .eq('client_id', clientId)
    .order('recorded_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching health history:', error)
    return []
  }

  // Reverse to get oldest to newest for trend display
  return (data || []).reverse()
}

// ==================== UTILITY FUNCTIONS ====================

export async function getClientStats() {
  const [clients, tasks] = await Promise.all([getAllClients(), getAllTasks()])

  const totalClients = clients.length
  const atRiskCount = clients.filter((c) => c.status === 'at-risk').length
  const avgHealthScore = clients.length > 0
    ? Math.round(clients.reduce((sum, c) => sum + c.health_score, 0) / clients.length)
    : 0
  const totalARR = clients.reduce((sum, c) => sum + c.arr, 0)
  const avgNPS = clients.length > 0
    ? Math.round(clients.reduce((sum, c) => sum + c.nps_score, 0) / clients.length)
    : 0
  const highChurnRiskCount = clients.filter((c) => c.health_score < 60).length

  const completedTasks = tasks.filter((t) => t.status === 'completed').length
  const totalTasks = tasks.length
  const overdueTasks = tasks.filter(
    (t) => t.status !== 'completed' && isPastDueDate(t.due_date),
  ).length

  return {
    totalClients,
    atRiskCount,
    avgHealthScore,
    totalARR,
    avgNPS,
    highChurnRiskCount,
    completedTasks,
    totalTasks,
    overdueTasks,
  }
}

export async function updateLastContactDate(clientId: string, contactDate?: string): Promise<void> {
  await updateClient(clientId, {
    last_contact_date: contactDate ?? new Date().toISOString(),
  })
}

/**
 * Wipe CSP data for the current organization only.
 * Deletes org-scoped clients (cascade clears tasks/milestones/interactions/health_history), then CSM users.
 */
export async function wipeAllCSPData(): Promise<{ success: boolean; error?: string }> {
  try {
    const orgId = await getOrganizationId()
    if (!orgId) {
      return { success: false, error: 'No organization found; refusing to wipe CSP data' }
    }

    const { error: clientsError } = await supabase
      .from('cs_clients')
      .delete()
      .eq('organization_id', orgId)

    if (clientsError) {
      console.error('Error wiping org clients:', clientsError)
      return { success: false, error: clientsError.message }
    }

    const { error: csmError } = await supabase
      .from('csm_users')
      .delete()
      .eq('organization_id', orgId)

    if (csmError) {
      console.error('Error wiping org CSM users:', csmError)
      return { success: false, error: csmError.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error wiping CSP data:', err)
    return { success: false, error: message }
  }
}



