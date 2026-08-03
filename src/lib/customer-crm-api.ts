/**
 * Katana Customers — CRM API layer
 * Pipeline, contacts, leads, quotes, invoices, contracts, campaigns
 */

import { supabase } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import type { CommerceDocType, CommerceDocumentSettings, CommerceTemplateSettings, CrmCommerceTemplate } from './crm-commerce-templates'
import {
  defaultTemplateName as getDefaultTemplateName,
  defaultTemplateSettings as getDefaultTemplateSettings,
} from './crm-commerce-templates'

// ==================== TYPES ====================

export type AccountType = 'business' | 'individual'
export type LifecycleStage = 'lead' | 'prospect' | 'customer' | 'churned'
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted'
export type LeadSource = 'web' | 'referral' | 'campaign' | 'cold_outreach' | 'event' | 'phone' | 'other'
export type DealStatus = 'open' | 'won' | 'lost'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void'
export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated'
export type CampaignType = 'email' | 'social' | 'event' | 'ads' | 'referral' | 'other'
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed'

export interface LineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

export type ContactRole = 'contact' | 'decision_maker' | 'champion' | 'influencer' | 'blocker'
export type ContactSentiment = 'positive' | 'neutral' | 'negative'

export interface CrmContact {
  id: string
  client_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  job_title: string | null
  is_primary: boolean
  is_decision_maker: boolean
  contact_role?: ContactRole
  sentiment?: ContactSentiment
  relationship_strength?: number
  last_contact_date?: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CrmCampaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  start_date: string | null
  end_date: string | null
  budget: number
  description: string
  created_at: string
  updated_at: string
}

export interface CrmLead {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  company_name: string | null
  account_type: AccountType
  source: LeadSource
  campaign_id: string | null
  status: LeadStatus
  score: number
  notes: string
  industry?: string | null
  state?: string | null
  country?: string
  signals?: Record<string, unknown>
  outreach_status?: string
  converted_client_id: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  campaign?: CrmCampaign
}

export interface PipelineStage {
  id: string
  organization_id: string | null
  name: string
  position: number
  probability_default: number
  is_won: boolean
  is_lost: boolean
  created_at: string
}

export interface CrmDeal {
  id: string
  title: string
  client_id: string | null
  contact_id: string | null
  lead_id: string | null
  stage_id: string | null
  amount: number
  currency: string
  probability: number
  expected_close_date: string | null
  status: DealStatus
  lost_reason: string | null
  assigned_to: string | null
  notes: string
  created_at: string
  updated_at: string
  stage?: PipelineStage
}

export interface CrmQuote {
  id: string
  quote_number: string
  deal_id: string | null
  client_id: string | null
  contact_id: string | null
  status: QuoteStatus
  subtotal: number
  tax: number
  total: number
  valid_until: string | null
  line_items: LineItem[]
  notes: string
  template_id?: string | null
  document_settings?: CommerceDocumentSettings
  created_at: string
  updated_at: string
}

export interface CrmInvoice {
  id: string
  invoice_number: string
  quote_id: string | null
  client_id: string | null
  status: InvoiceStatus
  subtotal: number
  tax: number
  total: number
  due_date: string | null
  paid_date: string | null
  line_items: LineItem[]
  notes: string
  template_id?: string | null
  document_settings?: CommerceDocumentSettings
  created_at: string
  updated_at: string
}

export interface CrmContract {
  id: string
  title: string
  client_id: string | null
  deal_id: string | null
  status: ContractStatus
  start_date: string | null
  end_date: string | null
  value: number
  terms: string
  template_id?: string | null
  document_settings?: CommerceDocumentSettings
  created_at: string
  updated_at: string
}

export interface CrmIntegrationSettings {
  id: string
  organization_id: string
  email_provider: 'gmail' | 'outlook' | 'none' | null
  email_connected: boolean
  calendar_provider: 'google' | 'outlook' | 'none' | null
  calendar_connected: boolean
  settings: Record<string, unknown>
  updated_at: string
}

export interface CrmStats {
  openDeals: number
  pipelineValue: number
  newLeads: number
  activeCampaigns: number
  openQuotes: number
  unpaidInvoices: number
}

const DEFAULT_PIPELINE_STAGES: Omit<PipelineStage, 'id' | 'organization_id' | 'created_at'>[] = [
  { name: 'Qualification', position: 0, probability_default: 10, is_won: false, is_lost: false },
  { name: 'Discovery', position: 1, probability_default: 25, is_won: false, is_lost: false },
  { name: 'Proposal', position: 2, probability_default: 50, is_won: false, is_lost: false },
  { name: 'Negotiation', position: 3, probability_default: 75, is_won: false, is_lost: false },
  { name: 'Closed Won', position: 4, probability_default: 100, is_won: true, is_lost: false },
  { name: 'Closed Lost', position: 5, probability_default: 0, is_won: false, is_lost: true },
]

/** Serialize seeding per org — parallel getAllDeals + getPipelineStages used to double-insert defaults. */
const pipelineStagesSeedLocks = new Map<string, Promise<PipelineStage[]>>()

function normalizeStageName(name: string): string {
  return name.trim().toLowerCase()
}

function sortPipelineStages(stages: PipelineStage[]): PipelineStage[] {
  return [...stages].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
}

async function dedupePipelineStages(stages: PipelineStage[]): Promise<PipelineStage[]> {
  const byName = new Map<string, PipelineStage[]>()
  for (const stage of stages) {
    const key = normalizeStageName(stage.name)
    const group = byName.get(key) ?? []
    group.push(stage)
    byName.set(key, group)
  }

  if (byName.size === stages.length) return sortPipelineStages(stages)

  const keepers: PipelineStage[] = []
  const duplicateIds: string[] = []

  for (const group of byName.values()) {
    const sorted = sortPipelineStages(group)
    const canonical = sorted[0]
    keepers.push(canonical)
    for (const duplicate of sorted.slice(1)) {
      duplicateIds.push(duplicate.id)
      await supabase.from('cs_deals').update({ stage_id: canonical.id }).eq('stage_id', duplicate.id)
    }
  }

  if (duplicateIds.length > 0) {
    await supabase.from('cs_pipeline_stages').delete().in('id', duplicateIds)
  }

  return sortPipelineStages(keepers)
}

async function seedPipelineStagesForOrg(orgId: string): Promise<PipelineStage[]> {
  const { data: existing, error } = await supabase
    .from('cs_pipeline_stages')
    .select('*')
    .eq('organization_id', orgId)
    .order('position')

  if (error) {
    console.error('Error loading pipeline stages:', error)
    return []
  }

  let stages = await dedupePipelineStages((existing ?? []) as PipelineStage[])

  const existingNames = new Set(stages.map((s) => normalizeStageName(s.name)))
  const missing = DEFAULT_PIPELINE_STAGES.filter((s) => !existingNames.has(normalizeStageName(s.name)))

  if (missing.length === 0) return stages

  const rows = missing.map((s) => ({ ...s, organization_id: orgId }))
  const { data: inserted, error: insertError } = await supabase.from('cs_pipeline_stages').insert(rows).select('*')
  if (insertError) {
    console.error('Error seeding pipeline stages:', insertError)
    return stages
  }

  stages = sortPipelineStages([...stages, ...((inserted ?? []) as PipelineStage[])])
  return dedupePipelineStages(stages)
}

async function orgContext() {
  const [userId, orgId] = await Promise.all([getCurrentUserId(), getOrganizationId()])
  return { userId, orgId }
}

function parseLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const o = item as Record<string, unknown>
    const qty = Number(o.quantity) || 0
    const price = Number(o.unit_price) || 0
    return {
      description: String(o.description ?? ''),
      quantity: qty,
      unit_price: price,
      total: Number(o.total) || qty * price,
    }
  })
}

function parseDocumentSettings(raw: unknown): CommerceDocumentSettings {
  if (!raw || typeof raw !== 'object') return {}
  return raw as CommerceDocumentSettings
}

function parseTemplateSettings(raw: unknown): CommerceTemplateSettings {
  if (!raw || typeof raw !== 'object') return getDefaultTemplateSettings('quote')
  return raw as CommerceTemplateSettings
}

function mapCommerceRow<T extends { line_items?: unknown; document_settings?: unknown }>(
  row: T,
): T & { line_items?: LineItem[]; document_settings?: CommerceDocumentSettings } {
  return {
    ...row,
    ...(row.line_items !== undefined ? { line_items: parseLineItems(row.line_items) } : {}),
    ...(row.document_settings !== undefined
      ? { document_settings: parseDocumentSettings(row.document_settings) }
      : {}),
  }
}

function nextDocNumber(prefix: string, count: number): string {
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`
}

// ==================== PIPELINE STAGES ====================

export async function ensureDefaultPipelineStages(): Promise<PipelineStage[]> {
  const { orgId } = await orgContext()
  const inFlight = pipelineStagesSeedLocks.get(orgId)
  if (inFlight) return inFlight

  const promise = seedPipelineStagesForOrg(orgId).finally(() => {
    if (pipelineStagesSeedLocks.get(orgId) === promise) {
      pipelineStagesSeedLocks.delete(orgId)
    }
  })
  pipelineStagesSeedLocks.set(orgId, promise)
  return promise
}

export async function getPipelineStages(): Promise<PipelineStage[]> {
  try {
    return await ensureDefaultPipelineStages()
  } catch {
    return []
  }
}

// ==================== CONTACTS ====================

export async function getAllContacts(): Promise<CrmContact[]> {
  const { orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_contacts')
    .select('*')
    .eq('organization_id', orgId)
    .order('last_name')
  if (error) {
    console.error('Error fetching contacts:', error)
    throw error
  }
  return (data ?? []) as CrmContact[]
}

export async function getContactsByClientId(clientId: string): Promise<CrmContact[]> {
  const { data, error } = await supabase
    .from('cs_contacts')
    .select('*')
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
  if (error) return []
  return (data ?? []) as CrmContact[]
}

export async function createContact(
  contact: Omit<CrmContact, 'id' | 'created_at' | 'updated_at'>,
): Promise<CrmContact | null> {
  const { userId, orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_contacts')
    .insert({ ...contact, user_id: userId, organization_id: orgId })
    .select('*')
    .single()
  if (error) {
    console.error('Error creating contact:', error)
    return null
  }
  return data as CrmContact
}

export async function updateContact(id: string, updates: Partial<CrmContact>): Promise<CrmContact | null> {
  const { data, error } = await supabase.from('cs_contacts').update(updates).eq('id', id).select('*').single()
  if (error) return null
  return data as CrmContact
}

export async function deleteContact(id: string): Promise<boolean> {
  const { error } = await supabase.from('cs_contacts').delete().eq('id', id)
  return !error
}

// ==================== CAMPAIGNS ====================

export async function getAllCampaigns(): Promise<CrmCampaign[]> {
  const { orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_campaigns')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Error fetching campaigns:', error)
    throw error
  }
  return (data ?? []) as CrmCampaign[]
}

export async function createCampaign(
  campaign: Omit<CrmCampaign, 'id' | 'created_at' | 'updated_at'>,
): Promise<CrmCampaign | null> {
  const { userId, orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_campaigns')
    .insert({ ...campaign, user_id: userId, organization_id: orgId })
    .select('*')
    .single()
  if (error) {
    console.error('Error creating campaign:', error)
    return null
  }
  return data as CrmCampaign
}

export async function updateCampaign(id: string, updates: Partial<CrmCampaign>): Promise<CrmCampaign | null> {
  const { data, error } = await supabase.from('cs_campaigns').update(updates).eq('id', id).select('*').single()
  if (error) return null
  return data as CrmCampaign
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const { error } = await supabase.from('cs_campaigns').delete().eq('id', id)
  return !error
}

// ==================== LEADS ====================

export async function getAllLeads(): Promise<CrmLead[]> {
  const { orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_leads')
    .select('*, campaign:cs_campaigns(*)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Error fetching leads:', error)
    throw error
  }
  return (data ?? []) as CrmLead[]
}

export async function createLead(
  lead: Omit<CrmLead, 'id' | 'created_at' | 'updated_at' | 'campaign' | 'converted_client_id'>,
): Promise<CrmLead | null> {
  const { userId, orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_leads')
    .insert({ ...lead, user_id: userId, organization_id: orgId })
    .select('*, campaign:cs_campaigns(*)')
    .single()
  if (error) {
    console.error('Error creating lead:', error)
    return null
  }
  const created = data as CrmLead
  const { notifyCrmLeadCreated } = await import('@/lib/cs-integration-notifications')
  void notifyCrmLeadCreated({ lead: created })
  return created
}

export async function updateLead(id: string, updates: Partial<CrmLead>): Promise<CrmLead | null> {
  const { data, error } = await supabase
    .from('cs_leads')
    .update(updates)
    .eq('id', id)
    .select('*, campaign:cs_campaigns(*)')
    .single()
  if (error) return null
  return data as CrmLead
}

export async function deleteLead(id: string): Promise<boolean> {
  const { error } = await supabase.from('cs_leads').delete().eq('id', id)
  return !error
}

// ==================== DEALS ====================

export async function getAllDeals(): Promise<CrmDeal[]> {
  await ensureDefaultPipelineStages()
  const { orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_deals')
    .select('*, stage:cs_pipeline_stages(*)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Error fetching deals:', error)
    throw error
  }
  return (data ?? []) as CrmDeal[]
}

export async function createDeal(
  deal: Omit<CrmDeal, 'id' | 'created_at' | 'updated_at' | 'stage'>,
): Promise<CrmDeal | null> {
  const { userId, orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_deals')
    .insert({ ...deal, user_id: userId, organization_id: orgId })
    .select('*, stage:cs_pipeline_stages(*)')
    .single()
  if (error) {
    console.error('Error creating deal:', error)
    return null
  }
  return data as CrmDeal
}

export async function updateDeal(id: string, updates: Partial<CrmDeal>): Promise<CrmDeal | null> {
  const { data: prior } = await supabase.from('cs_deals').select('status, stage_id').eq('id', id).maybeSingle()

  let patch = { ...updates }
  if (updates.stage_id && !updates.status) {
    const { data: stage } = await supabase
      .from('cs_pipeline_stages')
      .select('is_won, is_lost, probability_default')
      .eq('id', updates.stage_id)
      .maybeSingle()
    if (stage?.is_won) patch = { ...patch, status: 'won', probability: 100 }
    if (stage?.is_lost) patch = { ...patch, status: 'lost', probability: 0 }
    if (stage && !stage.is_won && !stage.is_lost && updates.probability === undefined) {
      patch = { ...patch, probability: stage.probability_default }
    }
  }

  const { data, error } = await supabase
    .from('cs_deals')
    .update(patch)
    .eq('id', id)
    .select('*, stage:cs_pipeline_stages(*)')
    .single()
  if (error) return null
  const deal = data as CrmDeal

  if (deal.status === 'won' && prior?.status !== 'won') {
    const { runDealWonWorkflow } = await import('./crm-workflows')
    void runDealWonWorkflow(deal)
  }
  if (deal.status === 'lost' && prior?.status !== 'lost') {
    const { runDealLostWorkflow } = await import('./crm-workflows')
    void runDealLostWorkflow(deal)
  }

  return deal
}

export async function deleteDeal(id: string): Promise<boolean> {
  const { error } = await supabase.from('cs_deals').delete().eq('id', id)
  return !error
}

// ==================== QUOTES ====================

export async function getAllQuotes(): Promise<CrmQuote[]> {
  const { orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_quotes')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Error fetching quotes:', error)
    throw error
  }
  return (data ?? []).map((row) => mapCommerceRow(row)) as CrmQuote[]
}

export async function createQuote(
  quote: Omit<CrmQuote, 'id' | 'created_at' | 'updated_at' | 'quote_number'> & { quote_number?: string },
): Promise<CrmQuote | null> {
  const { userId, orgId } = await orgContext()
  const { count } = await supabase.from('cs_quotes').select('id', { count: 'exact', head: true })
  const quote_number = quote.quote_number || nextDocNumber('QTE', count ?? 0)
  const { data, error } = await supabase
    .from('cs_quotes')
    .insert({ ...quote, quote_number, user_id: userId, organization_id: orgId })
    .select('*')
    .single()
  if (error) {
    console.error('Error creating quote:', error)
    return null
  }
  return mapCommerceRow(data) as CrmQuote
}

export async function updateQuote(id: string, updates: Partial<CrmQuote>): Promise<CrmQuote | null> {
  const { data, error } = await supabase.from('cs_quotes').update(updates).eq('id', id).select('*').single()
  if (error) return null
  return mapCommerceRow(data) as CrmQuote
}

export async function deleteQuote(id: string): Promise<boolean> {
  const { error } = await supabase.from('cs_quotes').delete().eq('id', id)
  return !error
}

// ==================== INVOICES ====================

export async function getAllInvoices(): Promise<CrmInvoice[]> {
  const { orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_invoices')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Error fetching invoices:', error)
    throw error
  }
  return (data ?? []).map((row) => mapCommerceRow(row)) as CrmInvoice[]
}

export async function createInvoice(
  invoice: Omit<CrmInvoice, 'id' | 'created_at' | 'updated_at' | 'invoice_number'> & {
    invoice_number?: string
  },
): Promise<CrmInvoice | null> {
  const { userId, orgId } = await orgContext()
  const { count } = await supabase.from('cs_invoices').select('id', { count: 'exact', head: true })
  const invoice_number = invoice.invoice_number || nextDocNumber('INV', count ?? 0)
  const { data, error } = await supabase
    .from('cs_invoices')
    .insert({ ...invoice, invoice_number, user_id: userId, organization_id: orgId })
    .select('*')
    .single()
  if (error) {
    console.error('Error creating invoice:', error)
    return null
  }
  return mapCommerceRow(data) as CrmInvoice
}

export async function updateInvoice(id: string, updates: Partial<CrmInvoice>): Promise<CrmInvoice | null> {
  const { data: prior } = await supabase
    .from('cs_invoices')
    .select('status, client_id, invoice_number')
    .eq('id', id)
    .maybeSingle()

  const { data, error } = await supabase.from('cs_invoices').update(updates).eq('id', id).select('*').single()
  if (error) return null
  const invoice = mapCommerceRow(data) as CrmInvoice

  const becameOverdue =
    invoice.status === 'overdue' ||
    (invoice.status === 'sent' &&
      invoice.due_date &&
      new Date(invoice.due_date).getTime() < Date.now())
  const wasOverdue = prior?.status === 'overdue'
  if (becameOverdue && !wasOverdue && invoice.client_id) {
    const { data: clientRow } = await supabase
      .from('cs_clients')
      .select('name')
      .eq('id', invoice.client_id)
      .maybeSingle()
    const { notifyCrmInvoiceOverdue } = await import('@/lib/cs-integration-notifications')
    void notifyCrmInvoiceOverdue({
      invoice,
      clientName: (clientRow?.name as string) ?? 'Customer',
    })
  }

  return invoice
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const { error } = await supabase.from('cs_invoices').delete().eq('id', id)
  return !error
}

// ==================== CONTRACTS ====================

export async function getAllContracts(): Promise<CrmContract[]> {
  const { orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_contracts')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Error fetching contracts:', error)
    throw error
  }
  return (data ?? []).map((row) => mapCommerceRow(row)) as CrmContract[]
}

export async function createContract(
  contract: Omit<CrmContract, 'id' | 'created_at' | 'updated_at'>,
): Promise<CrmContract | null> {
  const { userId, orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_contracts')
    .insert({ ...contract, user_id: userId, organization_id: orgId })
    .select('*')
    .single()
  if (error) {
    console.error('Error creating contract:', error)
    return null
  }
  return mapCommerceRow(data) as CrmContract
}

export async function updateContract(id: string, updates: Partial<CrmContract>): Promise<CrmContract | null> {
  const { data, error } = await supabase.from('cs_contracts').update(updates).eq('id', id).select('*').single()
  if (error) return null
  return mapCommerceRow(data) as CrmContract
}

export async function deleteContract(id: string): Promise<boolean> {
  const { error } = await supabase.from('cs_contracts').delete().eq('id', id)
  return !error
}

// ==================== INTEGRATIONS (placeholder state) ====================

export async function getIntegrationSettings(): Promise<CrmIntegrationSettings | null> {
  try {
    const { orgId } = await orgContext()
    const { data, error } = await supabase
      .from('cs_integration_settings')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle()
    if (error) return null
    return data as CrmIntegrationSettings | null
  } catch {
    return null
  }
}

export async function upsertIntegrationSettings(
  updates: Partial<Omit<CrmIntegrationSettings, 'id' | 'organization_id'>>,
): Promise<CrmIntegrationSettings | null> {
  const { orgId } = await orgContext()
  const { data, error } = await supabase
    .from('cs_integration_settings')
    .upsert(
      { organization_id: orgId, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'organization_id' },
    )
    .select('*')
    .single()
  if (error) {
    console.error('Error upserting integration settings:', error)
    return null
  }
  return data as CrmIntegrationSettings
}

// ==================== STATS ====================

export async function getCrmStats(): Promise<CrmStats> {
  const [deals, leads, campaigns, quotes, invoices] = await Promise.all([
    getAllDeals(),
    getAllLeads(),
    getAllCampaigns(),
    getAllQuotes(),
    getAllInvoices(),
  ])
  const openDeals = deals.filter((d) => d.status === 'open')
  return {
    openDeals: openDeals.length,
    pipelineValue: openDeals.reduce((sum, d) => sum + (d.amount || 0), 0),
    newLeads: leads.filter((l) => l.status === 'new').length,
    activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
    openQuotes: quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length,
    unpaidInvoices: invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').length,
  }
}

/** Convert a qualified lead into a customer account + optional deal */
export async function convertLeadToCustomer(
  leadId: string,
  options: { createDeal?: boolean; dealAmount?: number; stageId?: string },
): Promise<{ clientId: string | null; dealId: string | null }> {
  const { createClient, updateClient } = await import('./customer-success-api')
  const leads = await getAllLeads()
  const lead = leads.find((l) => l.id === leadId)
  if (!lead || lead.status === 'converted') return { clientId: null, dealId: null }

  const isIndividual = lead.account_type === 'individual'
  const displayName = isIndividual
    ? `${lead.first_name} ${lead.last_name}`.trim() || lead.email || 'Customer'
    : lead.company_name || `${lead.first_name} ${lead.last_name}`.trim() || 'Customer'

  const client = await createClient({
    name: displayName,
    industry: lead.industry ?? '',
    health_score: 0,
    status: 'healthy',
    last_contact_date: new Date().toISOString(),
    churn_risk: 0,
    churn_trend: 'stable',
    nps_score: 0,
    arr: options.dealAmount ?? 0,
    renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    csm_id: lead.assigned_to,
    engagement_score: 50,
    portal_logins: 0,
    feature_usage: 'Low',
    support_tickets: 0,
    account_type: lead.account_type,
    lifecycle_stage: 'prospect',
    email: lead.email,
    phone: lead.phone,
    website: null,
    address_line1: null,
    city: null,
    state: lead.state ?? null,
    postal_code: null,
    country: lead.country ?? '',
    campaign_id: lead.campaign_id,
    source_lead_id: leadId,
    lead_source: lead.source,
  })

  if (!client) return { clientId: null, dealId: null }

  if (lead.first_name || lead.last_name) {
    await createContact({
      client_id: client.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      job_title: null,
      is_primary: true,
      is_decision_maker: true,
      notes: null,
    })
  }

  let dealId: string | null = null
  if (options.createDeal) {
    const stages = await getPipelineStages()
    const stageId = options.stageId ?? stages.find((s) => !s.is_won && !s.is_lost)?.id ?? null
    const deal = await createDeal({
      title: `${displayName} — New opportunity`,
      client_id: client.id,
      contact_id: null,
      lead_id: leadId,
      stage_id: stageId,
      amount: options.dealAmount ?? 0,
      currency: 'USD',
      probability: stages.find((s) => s.id === stageId)?.probability_default ?? 10,
      expected_close_date: null,
      status: 'open',
      lost_reason: null,
      assigned_to: lead.assigned_to,
      notes: lead.notes,
    })
    dealId = deal?.id ?? null
  }

  await updateLead(leadId, { status: 'converted', converted_client_id: client.id })
  await updateClient(client.id, { lifecycle_stage: 'prospect' })

  const { runLeadConvertedWorkflow } = await import('./crm-workflows')
  const { syncClientOutreachStatus } = await import('./kyc-outreach-sync')
  void runLeadConvertedWorkflow({ clientId: client.id, lead })
  void syncClientOutreachStatus(client.id, 'planned')

  const { notifyCrmLeadConverted } = await import('@/lib/cs-integration-notifications')
  void notifyCrmLeadConverted({ lead, clientId: client.id, clientName: displayName })

  return { clientId: client.id, dealId }
}

export function computeLineItemTotal(
  items: LineItem[],
  taxRate = 0.08,
): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const tax = Math.round(subtotal * taxRate * 100) / 100
  return { subtotal, tax, total: subtotal + tax }
}

export function leadDisplayName(lead: CrmLead): string {
  const person = `${lead.first_name} ${lead.last_name}`.trim()
  if (lead.account_type === 'individual') return person || lead.email || 'Individual lead'
  return lead.company_name || person || lead.email || 'Business lead'
}

export function contactDisplayName(contact: CrmContact): string {
  return `${contact.first_name} ${contact.last_name}`.trim() || contact.email || 'Contact'
}

// ==================== COMMERCE TEMPLATES ====================

function mapTemplateRow(row: Record<string, unknown>): CrmCommerceTemplate {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    doc_type: row.doc_type as CommerceDocType,
    name: String(row.name ?? ''),
    is_default: Boolean(row.is_default),
    settings: parseTemplateSettings(row.settings),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function getCommerceTemplates(docType?: CommerceDocType): Promise<CrmCommerceTemplate[]> {
  const { orgId } = await orgContext()
  let query = supabase
    .from('cs_commerce_templates')
    .select('*')
    .eq('organization_id', orgId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
  if (docType) query = query.eq('doc_type', docType)
  const { data, error } = await query
  if (error) {
    console.error('Error fetching commerce templates:', error)
    throw error
  }
  return (data ?? []).map((row) => mapTemplateRow(row as Record<string, unknown>))
}

export async function ensureDefaultCommerceTemplates(orgName?: string | null): Promise<CrmCommerceTemplate[]> {
  const existing = await getCommerceTemplates()
  if (existing.length > 0) return existing

  const { orgId } = await orgContext()
  const types: CommerceDocType[] = ['quote', 'invoice', 'contract']
  const created: CrmCommerceTemplate[] = []

  for (const docType of types) {
    const settings = getDefaultTemplateSettings(docType)
    if ('branding' in settings && orgName) {
      settings.branding.company_name = orgName
    }
    const { data, error } = await supabase
      .from('cs_commerce_templates')
      .insert({
        organization_id: orgId,
        doc_type: docType,
        name: getDefaultTemplateName(docType),
        is_default: true,
        settings,
      })
      .select('*')
      .single()
    if (!error && data) {
      created.push(mapTemplateRow(data as Record<string, unknown>))
    }
  }

  return created.length > 0 ? created : existing
}

export async function createCommerceTemplate(input: {
  doc_type: CommerceDocType
  name: string
  is_default?: boolean
  settings: CommerceTemplateSettings
}): Promise<CrmCommerceTemplate | null> {
  const { orgId } = await orgContext()
  if (input.is_default) {
    await supabase
      .from('cs_commerce_templates')
      .update({ is_default: false })
      .eq('organization_id', orgId)
      .eq('doc_type', input.doc_type)
  }
  const { data, error } = await supabase
    .from('cs_commerce_templates')
    .insert({
      organization_id: orgId,
      doc_type: input.doc_type,
      name: input.name,
      is_default: input.is_default ?? false,
      settings: input.settings,
    })
    .select('*')
    .single()
  if (error) {
    console.error('Error creating commerce template:', error)
    return null
  }
  return mapTemplateRow(data as Record<string, unknown>)
}

export async function updateCommerceTemplate(
  id: string,
  updates: Partial<Pick<CrmCommerceTemplate, 'name' | 'is_default' | 'settings'>>,
): Promise<CrmCommerceTemplate | null> {
  const { orgId } = await orgContext()
  if (updates.is_default) {
    const { data: current } = await supabase
      .from('cs_commerce_templates')
      .select('doc_type')
      .eq('id', id)
      .maybeSingle()
    if (current?.doc_type) {
      await supabase
        .from('cs_commerce_templates')
        .update({ is_default: false })
        .eq('organization_id', orgId)
        .eq('doc_type', current.doc_type)
    }
  }
  const { data, error } = await supabase
    .from('cs_commerce_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) return null
  return mapTemplateRow(data as Record<string, unknown>)
}

export async function deleteCommerceTemplate(id: string): Promise<boolean> {
  const { error } = await supabase.from('cs_commerce_templates').delete().eq('id', id)
  return !error
}
