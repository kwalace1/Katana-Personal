/**
 * Know Your Customer (KYC) — API layer for intelligence, ICP profiles, portfolio summary
 */

import { supabase } from './supabase'
import { getOrganizationId, getCurrentUserId } from './auth-helpers'
import { isPastDueDate } from './due-date-utils'
import type { Client, ClientInteraction } from './customer-success-api'
import {
  getInteractionsByClientId,
  getTasksByClientId,
  getMilestonesByClientId,
  getHealthHistory,
} from './customer-success-api'
import {
  buildClientIntelligence,
  buildSuggestedActions,
  applyAccountOverviewFields,
  computeLeadFitFromInput,
  computeAttentionScore,
  getTopSignals,
  DEFAULT_ICP_PROFILE,
  type KycIcpProfile,
  type KycClientSignalInput,
  type ClientIntelligenceResult,
  type KycSuggestedAction,
  type KycClientSignals,
  type KycRiskLevel,
} from './kyc-client-scoring'
import { buildHealthReasoning } from './kyc-health-reasoning'
import { partitionKycActionTasks } from './kyc-action-resolution'
import { buildSignalPlays } from './kyc-signal-plays'
import { buildCsmBriefing, type KycCsmBriefing } from './kyc-csm-briefing'
import { buildRevenueIntel, type KycRevenueIntel } from './kyc-revenue-intel'
import { getContactsByClientId } from './customer-crm-api'
import type { CrmContact, CrmContract, CrmDeal, CrmInvoice } from './customer-crm-api'
import {
  mergeSignalLayers,
  KYC_EXTERNAL_ATTENTION_WEIGHTS,
  KYC_EXTERNAL_SIGNAL_LABELS,
  type KycExternalSignals,
} from './kyc-enrichment'
import {
  buildClientTimeline,
  type KycTimelineEvent,
  type KycTimelineContractRow,
  type KycTimelineDealRow,
  type KycTimelineInvoiceRow,
  type KycTimelineSupportTicketRow,
  type KycTimelineUsageSnapshotRow,
} from './kyc-timeline'
import { computeUsageTrendFlags, type UsageSnapshot } from './kyc-usage-trends'
import { summarizeContactIntel, relationshipStrengthScore } from './kyc-contact-intel'
import { computeRenewalForecast } from './kyc-renewal-forecast'
import type { MrrSnapshotRow } from './kyc-revenue-metrics'
import type { ProductModuleRow, ClientModuleEntitlement } from './kyc-expansion-estimate'

export type KycLeadOutreachStatus = 'new' | 'contacted' | 'meeting' | 'qualified' | 'passed'

export type KycOutreachStatus = 'none' | 'planned' | 'contacted' | 'meeting' | 'completed' | 'at_risk'

export interface KycRelationshipContact {
  id: string
  name: string
  job_title: string | null
  is_primary: boolean
  is_decision_maker: boolean
}

export interface KycExternalMapNode {
  id: string
  label: string
  category: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface KycRelationshipMapData {
  client_id: string
  client_name: string
  contacts: KycRelationshipContact[]
  suggested_actions: KycSuggestedAction[]
  external_nodes: KycExternalMapNode[]
}

export interface LeadFitResult {
  lead_id: string
  fit_percent: number
  fit_score: number
  signals: Record<string, unknown>
  top_signals: string[]
}

export interface KycClientIntel {
  id?: string
  client_id: string
  motivations: string | null
  decision_drivers: string[]
  red_flags: string[]
  green_flags: string[]
  ideal_messaging_approach: string | null
  notes_next_steps: string | null
}

export interface KycPortfolioSummary {
  total_customers: number
  b2b_count: number
  b2c_count: number
  b2b_at_risk: number
  b2c_at_risk: number
  at_risk_count: number
  moderate_count: number
  healthy_count: number
  renewals_within_90d: number
  renewals_within_30d: number
  missing_primary_contact: number
  missing_decision_maker: number
  stale_contact_30d: number
  arr_at_risk: number
  avg_health_score: number
  outreach_by_status: Record<KycOutreachStatus, number>
  high_attention_count: number
  renewal_risk_high_count: number
  expansion_high_count: number
}

export interface KycAccountAttentionRow {
  client_id: string
  client_name: string
  account_type: string
  industry: string
  health_score: number
  status: string
  attention_score: number
  renewal_date: string
  arr: number
  top_signals: string[]
  outreach_status: KycOutreachStatus
  renewal_risk: KycRiskLevel
  expansion_likelihood: KycRiskLevel
  primary_action: KycSuggestedAction | null
}

export interface KycPortfolioPlaybookGroup {
  action_id: string
  action_label: string
  count: number
  client_ids: string[]
  sample_clients: string[]
  priority: 'high' | 'medium' | 'low'
}

export function groupPortfolioPlaybooks(rows: KycAccountAttentionRow[]): KycPortfolioPlaybookGroup[] {
  const map = new Map<string, KycPortfolioPlaybookGroup>()
  for (const row of rows) {
    if (!row.primary_action) continue
    const key = row.primary_action.id
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
      existing.client_ids.push(row.client_id)
      if (existing.sample_clients.length < 3) existing.sample_clients.push(row.client_name)
    } else {
      map.set(key, {
        action_id: key,
        action_label: row.primary_action.label,
        count: 1,
        client_ids: [row.client_id],
        sample_clients: [row.client_name],
        priority: row.primary_action.priority,
      })
    }
  }
  const order = { high: 0, medium: 1, low: 2 }
  return [...map.values()].sort((a, b) => order[a.priority] - order[b.priority] || b.count - a.count)
}

function mapIcpRow(row: Record<string, unknown>): KycIcpProfile {
  return {
    target_industries: Array.isArray(row.target_industries) ? (row.target_industries as string[]) : [],
    target_states: Array.isArray(row.target_states) ? (row.target_states as string[]) : [],
    target_countries: Array.isArray(row.target_countries) ? (row.target_countries as string[]) : [],
    preferred_account_types: Array.isArray(row.preferred_account_types)
      ? (row.preferred_account_types as string[])
      : ['business', 'individual'],
    min_deal_size: Number(row.min_deal_size) || 0,
    sector_tags: Array.isArray(row.sector_tags) ? (row.sector_tags as string[]) : [],
    description: (row.description as string) ?? '',
  }
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return null
  return Math.floor((t - Date.now()) / (24 * 60 * 60 * 1000))
}

function clientToSignalInput(
  client: Client,
  extras: Partial<KycClientSignalInput> = {},
): KycClientSignalInput {
  return {
    nps_score: client.nps_score,
    engagement_score: client.engagement_score,
    support_tickets: client.support_tickets,
    last_contact_date: client.last_contact_date || null,
    feature_usage: client.feature_usage,
    portal_logins: client.portal_logins,
    renewal_date: client.renewal_date || null,
    industry: client.industry,
    state: client.state,
    country: client.country,
    account_type: client.account_type,
    arr: client.arr,
    ...extras,
  }
}

async function fetchClientSignalExtras(clientId: string): Promise<Partial<KycClientSignalInput>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [tasksRes, jobsRes, dealsRes, contractsRes, invoicesRes, contactsRes, interactionsRes, usageRes] =
    await Promise.all([
    fetchClientKycTasks(clientId),
    supabase.from('wfm_jobs').select('id, status, updated_at').eq('client_id', clientId),
    supabase.from('cs_deals').select('id, status').eq('client_id', clientId).eq('status', 'open'),
    supabase.from('cs_contracts').select('id, end_date, status').eq('client_id', clientId),
    supabase.from('cs_invoices').select('id, status, due_date').eq('client_id', clientId),
    supabase
      .from('cs_contacts')
      .select('id, is_primary, is_decision_maker, contact_role, sentiment, relationship_strength, last_contact_date'),
    supabase
      .from('cs_interactions')
      .select('id, type, interaction_date')
      .eq('client_id', clientId)
      .gte('interaction_date', thirtyDaysAgo),
    supabase
      .from('cs_client_usage_snapshots')
      .select('portal_logins, engagement_score, feature_usage, support_tickets, active_users, meetings_30d, emails_30d, health_score, recorded_at')
      .eq('client_id', clientId)
      .order('recorded_at', { ascending: false })
      .limit(2),
  ])

  const tasks = tasksRes
  const kycTasks = partitionKycActionTasks(tasks)
  const jobs = jobsRes.data ?? []
  const contacts = contactsRes.data ?? []
  const interactions = interactionsRes.data ?? []
  const now = Date.now()
  const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000

  const overdue_task_count = tasks.filter(
    (t) => t.status !== 'completed' && isPastDueDate(String(t.due_date ?? '')),
  ).length

  const active_wfm_job_count = jobs.filter((j) =>
    ['assigned', 'in-progress'].includes(String(j.status ?? '')),
  ).length

  const completed_wfm_job_count_30d = jobs.filter((j) => {
    if (String(j.status ?? '') !== 'completed') return false
    const updated = new Date(String(j.updated_at ?? '')).getTime()
    return !isNaN(updated) && updated >= thirtyDaysAgoMs
  }).length

  const meetings_30d = interactions.filter((i) => ['meeting', 'call'].includes(String(i.type ?? ''))).length
  const emails_30d = interactions.filter((i) => String(i.type ?? '') === 'email').length

  const contactIntel = summarizeContactIntel(contacts as Parameters<typeof summarizeContactIntel>[0])
  const usageRows = (usageRes.error ? [] : (usageRes.data ?? [])) as UsageSnapshot[]

  const trendFlags =
    usageRows.length >= 1
      ? computeUsageTrendFlags(
          {
            portal_logins: usageRows[0]!.portal_logins,
            engagement_score: usageRows[0]!.engagement_score,
            active_users: usageRows[0]!.active_users,
            meetings_30d,
            emails_30d,
          },
          usageRows[1] ?? null,
        )
      : computeUsageTrendFlags(
          {
            portal_logins: 0,
            engagement_score: 0,
            active_users: 0,
            meetings_30d,
            emails_30d,
          },
          null,
        )

  trendFlags.meeting_activity_low = meetings_30d === 0
  trendFlags.email_engagement_low = emails_30d === 0

  const open_deal_count = (dealsRes.data ?? []).length

  const contract_expiring_90d = (contractsRes.data ?? []).some((c) => {
    if (String(c.status ?? '') !== 'active') return false
    const d = daysUntil(String(c.end_date ?? ''))
    return d != null && d >= 0 && d <= 90
  })

  const invoice_overdue = (invoicesRes.data ?? []).some((inv) => {
    if (String(inv.status ?? '') === 'overdue') return true
    if (String(inv.status ?? '') !== 'sent') return false
    return isPastDueDate(String(inv.due_date ?? ''))
  })

  const has_primary_contact = contacts.some((c) => c.is_primary === true)
  const has_decision_maker = contacts.some((c) => c.is_decision_maker === true)

  return {
    overdue_task_count,
    active_wfm_job_count,
    completed_wfm_job_count_30d,
    open_deal_count,
    contract_expiring_90d,
    invoice_overdue,
    has_primary_contact: contacts.length === 0 ? undefined : has_primary_contact,
    has_decision_maker: contacts.length === 0 ? undefined : has_decision_maker,
    declining_portal_usage: trendFlags.declining_portal_usage,
    improving_engagement: trendFlags.improving_engagement,
    user_growth: trendFlags.user_growth,
    meeting_activity_low: trendFlags.meeting_activity_low,
    email_engagement_low: trendFlags.email_engagement_low,
    negative_contact_sentiment: contactIntel.has_negative_sentiment,
    blocker_contact_present: contactIntel.has_blocker,
    no_executive_touchpoint: contactIntel.no_executive_touchpoint_60d,
    relationship_strength_score: relationshipStrengthScore(contactIntel),
    completed_kyc_action_ids: kycTasks.completed_kyc_action_ids,
    open_kyc_action_ids: kycTasks.open_kyc_action_ids,
  }
}

async function fetchClientKycTasks(
  clientId: string,
): Promise<{ id: string; status: string; due_date?: string; title?: string; kyc_action_id?: string | null }[]> {
  const withAction = await supabase
    .from('cs_tasks')
    .select('id, status, due_date, title, kyc_action_id')
    .eq('client_id', clientId)

  if (!withAction.error) return withAction.data ?? []

  const isMissingColumn =
    withAction.error.code === '42703' ||
    withAction.error.message?.includes('kyc_action_id') ||
    withAction.error.message?.includes('does not exist')

  if (!isMissingColumn) {
    console.error('fetchClientKycTasks:', withAction.error)
    return []
  }

  const fallback = await supabase
    .from('cs_tasks')
    .select('id, status, due_date, title')
    .eq('client_id', clientId)

  if (fallback.error) {
    console.error('fetchClientKycTasks fallback:', fallback.error)
    return []
  }

  return fallback.data ?? []
}

async function recordClientUsageSnapshot(
  client: Client,
  opts?: { meetings_30d?: number; emails_30d?: number },
): Promise<void> {
  const orgId = await getOrganizationId()
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)

  const { data: recent } = await supabase
    .from('cs_client_usage_snapshots')
    .select('id')
    .eq('client_id', client.id)
    .gte('recorded_at', dayStart.toISOString())
    .limit(1)

  if ((recent ?? []).length > 0) return

  const { error } = await supabase.from('cs_client_usage_snapshots').insert({
    client_id: client.id,
    organization_id: orgId,
    portal_logins: client.portal_logins ?? 0,
    engagement_score: client.engagement_score ?? 0,
    feature_usage: (client.feature_usage ?? 'low').toLowerCase(),
    support_tickets: client.support_tickets ?? 0,
    active_users: client.portal_logins ?? 0,
    meetings_30d: opts?.meetings_30d ?? 0,
    emails_30d: opts?.emails_30d ?? 0,
    health_score: client.health_score,
  })
  if (error && error.code !== '42P01' && !error.message?.includes('does not exist')) {
    console.error('recordClientUsageSnapshot:', error)
  }
}

async function recordClientMrrSnapshot(client: Client): Promise<void> {
  const orgId = await getOrganizationId()
  const now = new Date()
  const snapshot_month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const mrr = (client.arr ?? 0) / 12
  const { error } = await supabase.from('cs_mrr_snapshots').upsert(
    {
      client_id: client.id,
      organization_id: orgId,
      snapshot_month,
      mrr,
      arr: client.arr ?? 0,
      is_active: (client.lifecycle_stage ?? 'customer') !== 'churned',
    },
    { onConflict: 'client_id,snapshot_month' },
  )
  if (error && error.code !== '42P01' && !error.message?.includes('does not exist')) {
    console.error('recordClientMrrSnapshot:', error)
  }
}

async function fetchProductModules(): Promise<ProductModuleRow[]> {
  const { data, error } = await supabase.from('cs_katana_product_modules').select('id, label, monthly_price')
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) return []
    console.error('fetchProductModules:', error)
    return []
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    label: String(row.label),
    monthly_price: Number(row.monthly_price) || 0,
  }))
}

async function fetchClientEntitlements(clientId: string): Promise<ClientModuleEntitlement[]> {
  const { data, error } = await supabase
    .from('cs_client_module_entitlements')
    .select('module_id, status')
    .eq('client_id', clientId)
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) return []
    console.error('fetchClientEntitlements:', error)
    return []
  }
  return (data ?? []).map((row) => ({
    module_id: String(row.module_id),
    status: String(row.status) as ClientModuleEntitlement['status'],
  }))
}

async function fetchOrgMrrSnapshots(): Promise<MrrSnapshotRow[]> {
  const orgId = await getOrganizationId()
  if (!orgId) return []
  const { data, error } = await supabase
    .from('cs_mrr_snapshots')
    .select('client_id, snapshot_month, mrr, arr, is_active')
    .eq('organization_id', orgId)
    .order('snapshot_month', { ascending: true })
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) return []
    console.error('fetchOrgMrrSnapshots:', error)
    return []
  }
  return (data ?? []).map((row) => ({
    client_id: String(row.client_id),
    snapshot_month: String(row.snapshot_month),
    mrr: Number(row.mrr) || 0,
    arr: Number(row.arr) || 0,
    is_active: Boolean(row.is_active),
  }))
}

async function fetchSupportTicketEvents(clientId: string): Promise<KycTimelineSupportTicketRow[]> {
  const { data, error } = await supabase
    .from('cs_support_ticket_events')
    .select('id, subject, status, opened_at, closed_at')
    .eq('client_id', clientId)
    .order('opened_at', { ascending: false })
    .limit(50)
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) return []
    return []
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    subject: String(row.subject ?? 'Support ticket'),
    status: String(row.status ?? 'open'),
    opened_at: String(row.opened_at),
    closed_at: (row.closed_at as string | null) ?? null,
  }))
}

async function fetchUsageSnapshotTimeline(clientId: string): Promise<KycTimelineUsageSnapshotRow[]> {
  const { data, error } = await supabase
    .from('cs_client_usage_snapshots')
    .select('id, portal_logins, engagement_score, feature_usage, support_tickets, recorded_at')
    .eq('client_id', clientId)
    .order('recorded_at', { ascending: false })
    .limit(24)
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) return []
    return []
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    portal_logins: Number(row.portal_logins) || 0,
    engagement_score: Number(row.engagement_score) || 0,
    feature_usage: String(row.feature_usage ?? 'low'),
    support_tickets: Number(row.support_tickets) || 0,
    recorded_at: String(row.recorded_at),
  }))
}

export async function getIcpProfile(): Promise<KycIcpProfile> {
  const orgId = await getOrganizationId()
  if (!orgId) return DEFAULT_ICP_PROFILE

  const { data, error } = await supabase
    .from('cs_icp_profiles')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) return DEFAULT_ICP_PROFILE
    console.error('getIcpProfile:', error)
    return DEFAULT_ICP_PROFILE
  }

  return data ? mapIcpRow(data as Record<string, unknown>) : DEFAULT_ICP_PROFILE
}

export async function upsertIcpProfile(profile: Partial<KycIcpProfile>): Promise<KycIcpProfile | null> {
  const orgId = await getOrganizationId()
  const userId = await getCurrentUserId()
  if (!orgId) return null

  const payload = {
    organization_id: orgId,
    user_id: userId,
    target_industries: profile.target_industries ?? [],
    target_states: profile.target_states ?? [],
    target_countries: profile.target_countries ?? [],
    preferred_account_types: profile.preferred_account_types ?? ['business'],
    min_deal_size: profile.min_deal_size ?? 0,
    sector_tags: profile.sector_tags ?? [],
    description: profile.description ?? '',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('cs_icp_profiles')
    .upsert(payload, { onConflict: 'organization_id' })
    .select('*')
    .single()

  if (error) {
    console.error('upsertIcpProfile:', error)
    return null
  }

  return mapIcpRow(data as Record<string, unknown>)
}

function finalizeIntelligence(intel: Omit<ClientIntelligenceResult, 'health_reasoning' | 'signal_plays'>): ClientIntelligenceResult {
  return {
    ...intel,
    health_reasoning: buildHealthReasoning(intel.signals, intel.health_breakdown),
    signal_plays: buildSignalPlays(intel.signals),
  }
}

function applyExternalSignals(
  intel: ClientIntelligenceResult,
  external: KycExternalSignals | null | undefined,
  accountType?: string | null,
): ClientIntelligenceResult {
  if (!external || Object.keys(external).length === 0) return intel
  const signals = mergeSignalLayers(intel.signals, external) as KycClientSignals
  let attention_score = computeAttentionScore(signals)
  for (const [key, weight] of Object.entries(KYC_EXTERNAL_ATTENTION_WEIGHTS)) {
    if (signals[key]) attention_score = Math.min(100, attention_score + weight)
  }

  const completedActionIds = Object.entries(intel.kyc_action_task_status ?? {})
    .filter(([, status]) => status === 'completed')
    .map(([id]) => id)

  return finalizeIntelligence(
    applyAccountOverviewFields(
      {
        ...intel,
        signals,
        attention_score,
        top_signals: getTopSignals(signals, 6),
      },
      accountType,
      {
        completedActionIds,
        openActionIds: Object.entries(intel.kyc_action_task_status ?? {})
          .filter(([, status]) => status === 'open')
          .map(([id]) => id),
        actionTaskStatus: intel.kyc_action_task_status,
      },
    ),
  )
}

function externalNodesFromSignals(signals: KycClientSignals): KycExternalMapNode[] {
  return Object.entries(signals)
    .filter(([key, val]) => val === true && key in KYC_EXTERNAL_SIGNAL_LABELS)
    .map(([key]) => ({
      id: key,
      label: KYC_EXTERNAL_SIGNAL_LABELS[key].label,
      category: KYC_EXTERNAL_SIGNAL_LABELS[key].category,
      sentiment: KYC_EXTERNAL_SIGNAL_LABELS[key].sentiment,
    }))
}

export async function getClientIntelligence(client: Client): Promise<ClientIntelligenceResult> {
  const [icp, extras, contacts] = await Promise.all([
    getIcpProfile(),
    fetchClientSignalExtras(client.id),
    getContactsByClientId(client.id),
  ])
  const base = buildClientIntelligence(clientToSignalInput(client, extras), icp)
  const external = (client.external_signals ?? {}) as KycExternalSignals
  const intel = applyExternalSignals(base, external, client.account_type)
  const contactIntel = summarizeContactIntel(contacts)
  return {
    ...intel,
    renewal_forecast: computeRenewalForecast({
      renewal_risk: intel.renewal_risk,
      renewal_risk_reasons: intel.renewal_risk_reasons,
      health_score: intel.health_score,
      days_until_renewal: daysUntil(client.renewal_date),
      trends: {
        declining_portal_usage: Boolean(extras.declining_portal_usage),
        improving_engagement: Boolean(extras.improving_engagement),
        user_growth: Boolean(extras.user_growth),
        meeting_activity_low: Boolean(extras.meeting_activity_low),
        email_engagement_low: Boolean(extras.email_engagement_low),
      },
      contacts: contactIntel,
    }),
  }
}

export interface KycAccountWorkspaceData {
  intel: ClientIntelligenceResult
  contacts: CrmContact[]
  briefing: KycCsmBriefing
  revenue: KycRevenueIntel
}

export async function getAccountWorkspaceData(client: Client): Promise<KycAccountWorkspaceData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [intel, contacts, contractsRes, dealsRes, invoicesRes, modules, entitlements, mrrSnapshots, meetingsRes] =
    await Promise.all([
      getClientIntelligence(client),
      getContactsByClientId(client.id),
      supabase.from('cs_contracts').select('*').eq('client_id', client.id),
      supabase.from('cs_deals').select('*').eq('client_id', client.id),
      supabase.from('cs_invoices').select('*').eq('client_id', client.id),
      fetchProductModules(),
      fetchClientEntitlements(client.id),
      fetchOrgMrrSnapshots(),
      supabase
        .from('cs_interactions')
        .select('id, type')
        .eq('client_id', client.id)
        .gte('interaction_date', thirtyDaysAgo),
    ])

  const interactions = meetingsRes.data ?? []
  const meetings_30d = interactions.filter((i) => ['meeting', 'call'].includes(String(i.type ?? ''))).length
  const emails_30d = interactions.filter((i) => String(i.type ?? '') === 'email').length
  void recordClientUsageSnapshot(client, { meetings_30d, emails_30d })
  void recordClientMrrSnapshot(client)
  void syncInferredModuleEntitlements(client.id, intel, client)

  const contracts = (contractsRes.data ?? []) as CrmContract[]
  const deals = (dealsRes.data ?? []) as CrmDeal[]
  const invoices = (invoicesRes.data ?? []) as CrmInvoice[]
  const revenue = buildRevenueIntel(client, intel, contracts, deals, invoices, {
    modules,
    entitlements,
    mrrSnapshots,
  })
  const briefing = buildCsmBriefing(client.name, intel, contacts, intel.signal_plays)

  return { intel, contacts, briefing, revenue }
}

export async function refreshClientSignals(client: Client): Promise<ClientIntelligenceResult> {
  const intel = await getClientIntelligence(client)

  const { error } = await supabase
    .from('cs_clients')
    .update({
      signals: intel.signals,
      last_signal_refresh_at: new Date().toISOString(),
    })
    .eq('id', client.id)

  if (error && error.code !== '42703' && !error.message?.includes('signals')) {
    console.error('refreshClientSignals:', error)
  }

  return intel
}

export async function getClientIntel(clientId: string): Promise<KycClientIntel | null> {
  const { data, error } = await supabase
    .from('cs_client_intel')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) return null
    console.error('getClientIntel:', error)
    return null
  }

  if (!data) return null

  return {
    id: data.id as string,
    client_id: data.client_id as string,
    motivations: (data.motivations as string | null) ?? null,
    decision_drivers: Array.isArray(data.decision_drivers) ? (data.decision_drivers as string[]) : [],
    red_flags: Array.isArray(data.red_flags) ? (data.red_flags as string[]) : [],
    green_flags: Array.isArray(data.green_flags) ? (data.green_flags as string[]) : [],
    ideal_messaging_approach: (data.ideal_messaging_approach as string | null) ?? null,
    notes_next_steps: (data.notes_next_steps as string | null) ?? null,
  }
}

export async function upsertClientIntel(
  clientId: string,
  patch: Partial<Omit<KycClientIntel, 'id' | 'client_id'>>,
): Promise<KycClientIntel | null> {
  const orgId = await getOrganizationId()
  const userId = await getCurrentUserId()

  const { data, error } = await supabase
    .from('cs_client_intel')
    .upsert(
      {
        client_id: clientId,
        organization_id: orgId,
        user_id: userId,
        motivations: patch.motivations ?? null,
        decision_drivers: patch.decision_drivers ?? [],
        red_flags: patch.red_flags ?? [],
        green_flags: patch.green_flags ?? [],
        ideal_messaging_approach: patch.ideal_messaging_approach ?? null,
        notes_next_steps: patch.notes_next_steps ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' },
    )
    .select('*')
    .single()

  if (error) {
    console.error('upsertClientIntel:', error)
    return null
  }

  return {
    id: data.id as string,
    client_id: data.client_id as string,
    motivations: (data.motivations as string | null) ?? null,
    decision_drivers: Array.isArray(data.decision_drivers) ? (data.decision_drivers as string[]) : [],
    red_flags: Array.isArray(data.red_flags) ? (data.red_flags as string[]) : [],
    green_flags: Array.isArray(data.green_flags) ? (data.green_flags as string[]) : [],
    ideal_messaging_approach: (data.ideal_messaging_approach as string | null) ?? null,
    notes_next_steps: (data.notes_next_steps as string | null) ?? null,
  }
}

export async function updateClientOutreachStatus(
  clientId: string,
  outreach_status: KycOutreachStatus,
): Promise<boolean> {
  const { error } = await supabase
    .from('cs_clients')
    .update({ outreach_status, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  if (error) {
    if (error.code === '42703') return false
    console.error('updateClientOutreachStatus:', error)
    return false
  }
  return true
}

export async function computeLeadFit(
  lead: {
    industry?: string | null
    state?: string | null
    country?: string | null
    account_type?: string | null
    company_name?: string | null
    score?: number
  },
  icp?: KycIcpProfile | null,
): Promise<{ signals: Record<string, unknown>; fit_score: number; fit_percent: number }> {
  const profile = icp ?? (await getIcpProfile())
  return computeLeadFitFromInput(
    {
      industry: lead.industry,
      state: lead.state,
      country: lead.country,
      account_type: lead.account_type,
      company_name: lead.company_name,
      estimated_deal_size: lead.score,
    },
    profile,
  )
}

export function computeLeadsFit(
  leads: Array<{
    id: string
    industry?: string | null
    state?: string | null
    country?: string | null
    account_type?: string | null
    company_name?: string | null
    score?: number
  }>,
  icp: KycIcpProfile,
): LeadFitResult[] {
  return leads.map((lead) => {
    const { signals, fit_score, fit_percent } = computeLeadFitFromInput(
      {
        industry: lead.industry,
        state: lead.state,
        country: lead.country,
        account_type: lead.account_type,
        company_name: lead.company_name,
        estimated_deal_size: lead.score,
      },
      icp,
    )
    const top_signals = Object.entries(signals)
      .filter(([k, v]) => v === true && k.startsWith('icp_'))
      .map(([k]) => k)
    return { lead_id: lead.id, fit_percent, fit_score, signals, top_signals }
  })
}

export async function updateLeadOutreachStatus(
  leadId: string,
  outreach_status: KycLeadOutreachStatus,
): Promise<boolean> {
  const { error } = await supabase
    .from('cs_leads')
    .update({ outreach_status, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) {
    if (error.code === '42703') return false
    console.error('updateLeadOutreachStatus:', error)
    return false
  }
  return true
}

export async function getClientRelationshipMap(client: Client): Promise<KycRelationshipMapData> {
  const [intel, contactsRes] = await Promise.all([
    getClientIntelligence(client),
    supabase
      .from('cs_contacts')
      .select('id, first_name, last_name, job_title, is_primary, is_decision_maker')
      .eq('client_id', client.id)
      .order('is_primary', { ascending: false }),
  ])

  const contacts: KycRelationshipContact[] = (contactsRes.data ?? []).map((c) => ({
    id: c.id as string,
    name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Contact',
    job_title: (c.job_title as string | null) ?? null,
    is_primary: Boolean(c.is_primary),
    is_decision_maker: Boolean(c.is_decision_maker),
  }))

  return {
    client_id: client.id,
    client_name: client.name,
    contacts,
    suggested_actions: buildSuggestedActions(intel.signals, client.account_type),
    external_nodes: externalNodesFromSignals(intel.signals),
  }
}

export async function getClientTimelineEvents(client: Client): Promise<KycTimelineEvent[]> {
  const [interactions, tasks, milestones, contractsRes, dealsRes, invoicesRes, quotesRes, healthHistory, supportTickets, usageSnapshots] =
    await Promise.all([
      getInteractionsByClientId(client.id),
      getTasksByClientId(client.id),
      getMilestonesByClientId(client.id),
      supabase
        .from('cs_contracts')
        .select('id, title, status, start_date, end_date, created_at, updated_at')
        .eq('client_id', client.id),
      supabase
        .from('cs_deals')
        .select('id, title, status, expected_close_date, created_at, updated_at')
        .eq('client_id', client.id),
      supabase
        .from('cs_invoices')
        .select('id, invoice_number, status, due_date, paid_date, created_at')
        .eq('client_id', client.id),
      supabase
        .from('cs_quotes')
        .select('id, quote_number, status, created_at, updated_at')
        .eq('client_id', client.id),
      getHealthHistory(client.id, 25),
      fetchSupportTicketEvents(client.id),
      fetchUsageSnapshotTimeline(client.id),
    ])

  const contracts: KycTimelineContractRow[] = (contractsRes.data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? 'Contract'),
    status: String(row.status ?? 'draft'),
    start_date: (row.start_date as string | null) ?? null,
    end_date: (row.end_date as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
  }))

  const deals: KycTimelineDealRow[] = (dealsRes.data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? 'Deal'),
    status: String(row.status ?? 'open'),
    expected_close_date: (row.expected_close_date as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
  }))

  const invoices: KycTimelineInvoiceRow[] = (invoicesRes.data ?? []).map((row) => ({
    id: String(row.id),
    invoice_number: String(row.invoice_number ?? 'Invoice'),
    status: String(row.status ?? 'draft'),
    due_date: (row.due_date as string | null) ?? null,
    paid_date: (row.paid_date as string | null) ?? null,
    created_at: String(row.created_at),
  }))

  const quotes = (quotesRes.data ?? []).map((row) => ({
    id: String(row.id),
    quote_number: String(row.quote_number ?? 'Quote'),
    status: String(row.status ?? 'draft'),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
  }))

  return buildClientTimeline({
    interactions,
    tasks,
    milestones,
    contracts,
    deals,
    invoices,
    quotes,
    healthHistory,
    supportTickets,
    usageSnapshots,
    client: {
      id: client.id,
      name: client.name,
      renewal_date: client.renewal_date,
      created_at: client.created_at,
      last_contact_date: client.last_contact_date,
      portal_logins: client.portal_logins,
      support_tickets: client.support_tickets,
      feature_usage: client.feature_usage,
    },
  })
}

const EMPTY_OUTREACH: Record<KycOutreachStatus, number> = {
  none: 0,
  planned: 0,
  contacted: 0,
  meeting: 0,
  completed: 0,
  at_risk: 0,
}

export async function getPortfolioSummary(clients: Client[]): Promise<KycPortfolioSummary> {
  const icp = await getIcpProfile()
  const customerClients = clients.filter(
    (c) => (c.lifecycle_stage ?? 'customer') === 'customer' || !c.lifecycle_stage,
  )

  const outreach_by_status = { ...EMPTY_OUTREACH }
  let renewals_within_90d = 0
  let renewals_within_30d = 0
  let missing_primary_contact = 0
  let missing_decision_maker = 0
  let stale_contact_30d = 0
  let arr_at_risk = 0
  let high_attention_count = 0
  let healthSum = 0
  let renewal_risk_high_count = 0
  let expansion_high_count = 0

  const intelRows = await Promise.all(
    customerClients.map(async (client) => {
      const extras = await fetchClientSignalExtras(client.id)
      const base = buildClientIntelligence(clientToSignalInput(client, extras), icp)
      return applyExternalSignals(
        base,
        (client.external_signals ?? {}) as KycExternalSignals,
        client.account_type,
      )
    }),
  )

  let b2b_count = 0
  let b2c_count = 0
  let b2b_at_risk = 0
  let b2c_at_risk = 0

  customerClients.forEach((client, idx) => {
    const intel = intelRows[idx]
    healthSum += intel.health_score

    const isB2c = (client.account_type ?? 'business').toLowerCase() === 'individual'
    if (isB2c) b2c_count += 1
    else b2b_count += 1
    if (intel.status === 'at-risk') {
      if (isB2c) b2c_at_risk += 1
      else b2b_at_risk += 1
    }

    const outreach = ((client as Client & { outreach_status?: KycOutreachStatus }).outreach_status ??
      'none') as KycOutreachStatus
    if (outreach in outreach_by_status) outreach_by_status[outreach] += 1
    else outreach_by_status.none += 1

    const renewalDays = daysUntil(client.renewal_date)
    if (renewalDays != null && renewalDays >= 0 && renewalDays <= 90) renewals_within_90d += 1
    if (renewalDays != null && renewalDays >= 0 && renewalDays <= 30) renewals_within_30d += 1

    if (intel.signals.missing_primary_contact) missing_primary_contact += 1
    if (!isB2c && intel.signals.missing_decision_maker) missing_decision_maker += 1
    if (intel.signals.no_contact_30d) stale_contact_30d += 1
    if (intel.status === 'at-risk') arr_at_risk += client.arr ?? 0
    if (intel.attention_score >= 20) high_attention_count += 1
    if (intel.renewal_risk === 'high') renewal_risk_high_count += 1
    if (intel.expansion_likelihood === 'high') expansion_high_count += 1
  })

  const at_risk_count = intelRows.filter((i) => i.status === 'at-risk').length
  const moderate_count = intelRows.filter((i) => i.status === 'moderate').length
  const healthy_count = intelRows.filter((i) => i.status === 'healthy').length

  return {
    total_customers: customerClients.length,
    b2b_count,
    b2c_count,
    b2b_at_risk,
    b2c_at_risk,
    at_risk_count,
    moderate_count,
    healthy_count,
    renewals_within_90d,
    renewals_within_30d,
    missing_primary_contact,
    missing_decision_maker,
    stale_contact_30d,
    arr_at_risk,
    avg_health_score:
      customerClients.length > 0 ? Math.round(healthSum / customerClients.length) : 0,
    outreach_by_status,
    high_attention_count,
    renewal_risk_high_count,
    expansion_high_count,
  }
}

export async function getPortfolioAccountRows(
  clients: Client[],
  options?: { attentionOnly?: boolean },
): Promise<KycAccountAttentionRow[]> {
  const icp = await getIcpProfile()
  const customerClients = clients.filter(
    (c) => (c.lifecycle_stage ?? 'customer') === 'customer' || !c.lifecycle_stage,
  )

  const rows: KycAccountAttentionRow[] = []

  for (const client of customerClients) {
    const extras = await fetchClientSignalExtras(client.id)
    const intel = applyExternalSignals(
      buildClientIntelligence(clientToSignalInput(client, extras), icp),
      (client.external_signals ?? {}) as KycExternalSignals,
      client.account_type,
    )
    if (options?.attentionOnly && intel.attention_score < 8 && intel.status === 'healthy') continue

    rows.push({
      client_id: client.id,
      client_name: client.name,
      account_type: client.account_type ?? 'business',
      industry: client.industry,
      health_score: intel.health_score,
      status: intel.status,
      attention_score: intel.attention_score,
      renewal_date: client.renewal_date,
      arr: client.arr,
      top_signals: intel.top_signals,
      outreach_status: ((client as Client & { outreach_status?: KycOutreachStatus }).outreach_status ??
        'none') as KycOutreachStatus,
      renewal_risk: intel.renewal_risk,
      expansion_likelihood: intel.expansion_likelihood,
      primary_action: intel.primary_action,
    })
  }

  return rows.sort(
    (a, b) => b.attention_score - a.attention_score || a.health_score - b.health_score,
  )
}

/** @deprecated Use getPortfolioAccountRows with { attentionOnly: true } */
export async function getAccountsNeedingAttention(
  clients: Client[],
  limit = 20,
): Promise<KycAccountAttentionRow[]> {
  const rows = await getPortfolioAccountRows(clients, { attentionOnly: true })
  return rows.slice(0, limit)
}

export async function listProductModules(): Promise<ProductModuleRow[]> {
  return fetchProductModules()
}

export async function getClientModuleEntitlements(
  clientId: string,
): Promise<ClientModuleEntitlement[]> {
  return fetchClientEntitlements(clientId)
}

export async function setClientModuleEntitlement(
  clientId: string,
  moduleId: string,
  status: ClientModuleEntitlement['status'],
): Promise<boolean> {
  const orgId = await getOrganizationId()
  const { error } = await supabase.from('cs_client_module_entitlements').upsert(
    {
      client_id: clientId,
      organization_id: orgId,
      module_id: moduleId,
      status,
      purchased_at: new Date().toISOString(),
    },
    { onConflict: 'client_id,module_id' },
  )
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) return false
    console.error('setClientModuleEntitlement:', error)
    return false
  }
  return true
}

export async function syncInferredModuleEntitlements(
  clientId: string,
  intel: ClientIntelligenceResult,
  client?: Client,
): Promise<number> {
  let clientRow = client
  if (!clientRow) {
    const { data } = await supabase.from('cs_clients').select('*').eq('id', clientId).maybeSingle()
    if (!data) return 0
    clientRow = data as Client
  }
  const modules = await fetchProductModules()
  const existing = await fetchClientEntitlements(clientId)
  const { inferProductAdoption } = await import('./kyc-revenue-intel')
  const adoption = inferProductAdoption(clientRow, intel, modules, existing)
  let updated = 0
  for (const mod of adoption.in_use) {
    if (mod.status === 'not_detected') continue
    const already = existing.find((e) => e.module_id === mod.id && (e.status === 'active' || e.status === 'trial'))
    if (already) continue
    const ok = await setClientModuleEntitlement(clientId, mod.id, mod.status === 'partial' ? 'trial' : 'active')
    if (ok) updated += 1
  }
  return updated
}

export type { KycIcpProfile, ClientIntelligenceResult, KycSuggestedAction, KycTimelineEvent }
