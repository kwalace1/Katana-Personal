/**
 * Account revenue intelligence — explainable commercial context with SaaS metrics when data exists.
 */

import type { Client } from './customer-success-api'
import type { CrmContract, CrmDeal, CrmInvoice } from './customer-crm-api'
import type { ClientIntelligenceResult, KycRiskLevel } from './kyc-client-scoring'
import { computeExpansionEstimate, type ProductModuleRow, type ClientModuleEntitlement } from './kyc-expansion-estimate'
import { computeRevenueMetrics, type KycRevenueMetrics, type MrrSnapshotRow } from './kyc-revenue-metrics'

export interface KatanaProductAdoption {
  id: string
  label: string
  status: 'active' | 'partial' | 'not_detected'
  evidence: string
}

export interface KycExpansionEstimateView {
  available: boolean
  estimated_annual_value: number | null
  expansion_probability: number
  reasons: string[]
}

export interface KycRevenueIntel {
  arr: number
  renewal_date: string | null
  days_until_renewal: number | null
  expansion_likelihood: KycRiskLevel
  expansion_reasons: string[]
  expansion_estimate: KycExpansionEstimateView
  active_contract_value: number
  open_pipeline_value: number
  overdue_invoice_count: number
  products_in_use: KatanaProductAdoption[]
  products_not_purchased: KatanaProductAdoption[]
  portfolio_metrics: KycRevenueMetrics
  metrics_note: string
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const t = new Date(dateStr).getTime()
  if (isNaN(t)) return null
  return Math.floor((t - Date.now()) / (24 * 60 * 60 * 1000))
}

export function inferProductAdoption(
  client: Client,
  intel: ClientIntelligenceResult,
  modules: ProductModuleRow[],
  entitlements: ClientModuleEntitlement[],
): { in_use: KatanaProductAdoption[]; not_purchased: KatanaProductAdoption[] } {
  const s = intel.signals
  const entitled = new Set(
    entitlements.filter((e) => e.status === 'active' || e.status === 'trial').map((e) => e.module_id),
  )

  const catalog: KatanaProductAdoption[] = modules.map((mod) => {
    if (entitled.has(mod.id)) {
      return { id: mod.id, label: mod.label, status: 'active', evidence: 'Module entitlement on file' }
    }
    if (mod.id === 'customers') {
      return { id: mod.id, label: mod.label, status: 'active', evidence: 'Account is tracked in Katana Customers' }
    }
    if (mod.id === 'wfm') {
      const active = Boolean(s.active_wfm_jobs || s.recent_job_completed)
      return {
        id: mod.id,
        label: mod.label,
        status: active ? 'active' : 'not_detected',
        evidence: active ? 'Active field jobs on this account' : 'No recent WFM job activity detected',
      }
    }
    if (mod.id === 'portal') {
      const logins = client.portal_logins ?? 0
      return {
        id: mod.id,
        label: mod.label,
        status: logins >= 5 ? 'active' : logins > 0 ? 'partial' : 'not_detected',
        evidence: `${logins} portal logins on record`,
      }
    }
    if (mod.id === 'projects') {
      const high = client.feature_usage === 'high'
      return {
        id: mod.id,
        label: mod.label,
        status: high ? 'partial' : 'not_detected',
        evidence: high ? 'High feature usage may include PM workflows' : 'No strong PM adoption signal',
      }
    }
    return {
      id: mod.id,
      label: mod.label,
      status: 'not_detected',
      evidence: 'No module usage signal linked to this account yet',
    }
  })

  const in_use = catalog.filter((p) => p.status === 'active' || p.status === 'partial')
  const not_purchased = catalog.filter((p) => p.status === 'not_detected')
  return { in_use, not_purchased }
}

export function buildRevenueIntel(
  client: Client,
  intel: ClientIntelligenceResult,
  contracts: CrmContract[],
  deals: CrmDeal[],
  invoices: CrmInvoice[],
  opts?: {
    modules?: ProductModuleRow[]
    entitlements?: ClientModuleEntitlement[]
    mrrSnapshots?: MrrSnapshotRow[]
  },
): KycRevenueIntel {
  const activeContracts = contracts.filter((c) => c.status === 'active')
  const activeContractValue = activeContracts.reduce((sum, c) => sum + (c.value ?? 0), 0)
  const openDeals = deals.filter((d) => d.status === 'open')
  const openPipelineValue = openDeals.reduce((sum, d) => sum + (d.amount ?? 0), 0)
  const overdueInvoices = invoices.filter(
    (i) => i.status === 'overdue' || (i.status === 'sent' && i.due_date && new Date(i.due_date) < new Date()),
  )

  const modules = opts?.modules ?? []
  const entitlements = opts?.entitlements ?? []
  const { in_use, not_purchased } = inferProductAdoption(client, intel, modules, entitlements)

  const portfolio_metrics = computeRevenueMetrics(opts?.mrrSnapshots ?? [])

  const estimate = computeExpansionEstimate({
    expansion_likelihood: intel.expansion_likelihood,
    expansion_reasons: intel.expansion_reasons,
    modules,
    entitlements,
    has_strong_usage: Boolean(intel.signals.high_feature_usage && !intel.signals.low_feature_adoption),
    has_pricing_data: modules.some((m) => m.monthly_price > 0),
  })

  let metrics_note = portfolio_metrics.note
  if (!portfolio_metrics.available) {
    metrics_note =
      'GRR, NRR, and logo retention require monthly MRR snapshots. Record snapshots via account refresh or billing integration.'
  }

  return {
    arr: client.arr ?? 0,
    renewal_date: client.renewal_date || null,
    days_until_renewal: daysUntil(client.renewal_date),
    expansion_likelihood: intel.expansion_likelihood,
    expansion_reasons: intel.expansion_reasons,
    expansion_estimate: {
      available: estimate.available,
      estimated_annual_value: estimate.estimated_annual_value,
      expansion_probability: estimate.expansion_probability,
      reasons: estimate.reasons,
    },
    active_contract_value: activeContractValue,
    open_pipeline_value: openPipelineValue,
    overdue_invoice_count: overdueInvoices.length,
    products_in_use: in_use,
    products_not_purchased: not_purchased,
    portfolio_metrics,
    metrics_note,
  }
}
