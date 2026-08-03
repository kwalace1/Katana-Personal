/**
 * Balance sheet, cash flow, tax packet, vendors, and estimated tax helpers.
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { getOrganizationId, getCurrentUserId } from './auth-helpers'
import {
  getAccounts,
  getBankTransactions,
  getEntitySettings,
  getProfitAndLossReport,
  formatCurrency,
} from './finance-api'
import type {
  BalanceSheetLine,
  BalanceSheetReport,
  CashFlowReport,
  CoaAccountType,
  EntityType,
  FinVendor,
  ProfitLossReport,
  TaxPacketData,
} from './finance-types'
import { ENTITY_TYPE_LABELS } from './finance-types'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const ASSET_TYPES: CoaAccountType[] = ['bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset']
const LIABILITY_TYPES: CoaAccountType[] = [
  'accounts_payable',
  'credit_card',
  'other_current_liability',
  'long_term_liability',
]
const EQUITY_TYPES: CoaAccountType[] = ['equity']

async function getAccountBalancesThrough(asOfDate: string): Promise<Map<string, number>> {
  const orgId = await getOrganizationId()
  const accounts = await getAccounts()
  const accountById = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const balances = new Map<string, number>()

  const { data: entries } = await supabase
    .from('fin_journal_entries')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'posted')
    .lte('entry_date', asOfDate)

  const entryIds = (entries ?? []).map((e) => e.id)
  if (entryIds.length === 0) return balances

  const { data: lines } = await supabase
    .from('fin_journal_lines')
    .select('*')
    .in('journal_entry_id', entryIds)

  for (const line of lines ?? []) {
    const acct = accountById[line.account_id]
    if (!acct) continue
    const prev = balances.get(line.account_id) ?? 0
    const debit = Number(line.debit) || 0
    const credit = Number(line.credit) || 0

    if (ASSET_TYPES.includes(acct.account_type)) {
      balances.set(line.account_id, prev + debit - credit)
    } else if (LIABILITY_TYPES.includes(acct.account_type) || EQUITY_TYPES.includes(acct.account_type)) {
      balances.set(line.account_id, prev + credit - debit)
    } else if (['income', 'other_income'].includes(acct.account_type)) {
      balances.set(line.account_id, prev + credit - debit)
    } else if (['expense', 'cost_of_goods_sold', 'other_expense'].includes(acct.account_type)) {
      balances.set(line.account_id, prev + debit - credit)
    }
  }

  return balances
}

function linesFromBalances(
  accounts: Awaited<ReturnType<typeof getAccounts>>,
  balances: Map<string, number>,
  types: CoaAccountType[],
): BalanceSheetLine[] {
  return accounts
    .filter((a) => types.includes(a.account_type))
    .map((a) => ({
      account_id: a.id,
      account_number: a.account_number,
      account_name: a.name,
      account_type: a.account_type,
      balance: balances.get(a.id) ?? 0,
    }))
    .filter((l) => Math.abs(l.balance) >= 0.005)
    .sort((a, b) => (a.account_number ?? '').localeCompare(b.account_number ?? ''))
}

export async function getBalanceSheetReport(asOfDate: string): Promise<BalanceSheetReport> {
  if (!isSupabaseConfigured) {
    return {
      as_of_date: asOfDate,
      assets: [],
      liabilities: [],
      equity: [],
      total_assets: 0,
      total_liabilities: 0,
      total_equity: 0,
    }
  }

  const accounts = await getAccounts()
  const balances = await getAccountBalancesThrough(asOfDate)

  const assets = linesFromBalances(accounts, balances, ASSET_TYPES)
  const liabilities = linesFromBalances(accounts, balances, LIABILITY_TYPES)
  const equity = linesFromBalances(accounts, balances, EQUITY_TYPES)

  const total_assets = assets.reduce((s, l) => s + l.balance, 0)
  const total_liabilities = liabilities.reduce((s, l) => s + l.balance, 0)
  const total_equity = equity.reduce((s, l) => s + l.balance, 0)

  return {
    as_of_date: asOfDate,
    assets,
    liabilities,
    equity,
    total_assets,
    total_liabilities,
    total_equity,
  }
}

export async function getCashFlowReport(periodStart: string, periodEnd: string): Promise<CashFlowReport> {
  if (!isSupabaseConfigured) {
    return {
      period_start: periodStart,
      period_end: periodEnd,
      operating: 0,
      investing: 0,
      financing: 0,
      net_change: 0,
      inflows: 0,
      outflows: 0,
    }
  }

  const txns = await getBankTransactions()
  const inPeriod = txns.filter(
    (t) => t.transaction_date >= periodStart && t.transaction_date <= periodEnd && t.status !== 'excluded',
  )

  let inflows = 0
  let outflows = 0
  for (const t of inPeriod) {
    const amt = Number(t.amount)
    if (amt > 0) inflows += amt
    else outflows += Math.abs(amt)
  }

  const net_change = inflows - outflows

  return {
    period_start: periodStart,
    period_end: periodEnd,
    operating: net_change,
    investing: 0,
    financing: 0,
    net_change,
    inflows,
    outflows,
  }
}

// ============================================
// VENDORS (1099)
// ============================================

export async function getVendors(): Promise<FinVendor[]> {
  if (!isSupabaseConfigured) return []
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('fin_vendors')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as FinVendor[]
}

export async function createVendor(input: {
  name: string
  email?: string
  tax_id?: string
  is_1099_eligible?: boolean
}): Promise<FinVendor> {
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('fin_vendors')
    .insert({
      organization_id: orgId,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      tax_id: input.tax_id?.trim() || null,
      is_1099_eligible: input.is_1099_eligible ?? true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as FinVendor
}

export async function getVendorYtdPayments(
  vendorId: string,
  year: number,
): Promise<number> {
  const orgId = await getOrganizationId()
  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const { data } = await supabase
    .from('fin_bank_transactions')
    .select('amount')
    .eq('organization_id', orgId)
    .eq('vendor_id', vendorId)
    .gte('transaction_date', start)
    .lte('transaction_date', end)
  return (data ?? []).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
}

// ============================================
// TAX PACKET
// ============================================

export async function buildTaxPacketData(taxYear: number): Promise<TaxPacketData> {
  const periodStart = `${taxYear}-01-01`
  const periodEnd = `${taxYear}-12-31`
  const settings = await getEntitySettings()
  const entityType = settings?.entity_type ?? 'sole_prop'

  const [pnl, balanceSheet, cashFlow, vendors, transactions] = await Promise.all([
    getProfitAndLossReport(periodStart, periodEnd),
    getBalanceSheetReport(periodEnd),
    getCashFlowReport(periodStart, periodEnd),
    getVendors(),
    getBankTransactions({ limit: 5000 }),
  ])

  const yearTxns = transactions.filter(
    (t) => t.transaction_date >= periodStart && t.transaction_date <= periodEnd,
  )

  const vendorPayments = await Promise.all(
    vendors
      .filter((v) => v.is_1099_eligible)
      .map(async (v) => ({
        vendor_id: v.id,
        name: v.name,
        tax_id: v.tax_id,
        ytd_payments: await getVendorYtdPayments(v.id, taxYear),
      })),
  )

  const needs1099 = vendorPayments.filter((v) => v.ytd_payments >= 600)

  return {
    tax_year: taxYear,
    generated_at: new Date().toISOString(),
    entity_type: entityType,
    entity_label: ENTITY_TYPE_LABELS[entityType as EntityType],
    ein: settings?.ein ?? null,
    tax_basis: settings?.tax_basis ?? 'cash',
    profit_and_loss: pnl,
    balance_sheet: balanceSheet,
    cash_flow: cashFlow,
    transaction_count: yearTxns.length,
    vendors_1099: needs1099,
    disclaimer:
      'This packet is for informational purposes only. Katana does not provide tax advice or file returns. Have a qualified tax professional review before filing.',
  }
}

export async function saveTaxPacketRecord(packet: TaxPacketData): Promise<void> {
  if (!isSupabaseConfigured) return
  const orgId = await getOrganizationId()
  const userId = await getCurrentUserId()
  await supabase.from('fin_tax_packets').insert({
    organization_id: orgId,
    tax_year: packet.tax_year,
    period_start: `${packet.tax_year}-01-01`,
    period_end: `${packet.tax_year}-12-31`,
    entity_type: packet.entity_type,
    packet_json: packet,
    created_by_user_id: userId,
  })
}

export function downloadTaxPacketCsv(packet: TaxPacketData): void {
  const rows: string[][] = [
    ['Katana Finance — Tax Packet', String(packet.tax_year)],
    ['Entity', packet.entity_label],
    ['EIN', packet.ein ?? ''],
    ['Tax basis', packet.tax_basis],
    ['Generated', packet.generated_at],
    [],
    ['PROFIT & LOSS'],
    ['Account', 'Amount'],
    ...packet.profit_and_loss.income.map((l) => [l.account_name, l.amount.toFixed(2)]),
    ['Total Income', packet.profit_and_loss.total_income.toFixed(2)],
    ...packet.profit_and_loss.expenses.map((l) => [l.account_name, l.amount.toFixed(2)]),
    ['Total Expenses', packet.profit_and_loss.total_expenses.toFixed(2)],
    ['Net Income', packet.profit_and_loss.net_income.toFixed(2)],
    [],
    ['1099 VENDORS (>= $600)'],
    ['Name', 'Tax ID', 'YTD Payments'],
    ...packet.vendors_1099.map((v) => [v.name, v.tax_id ?? '', v.ytd_payments.toFixed(2)]),
    [],
    ['DISCLAIMER', packet.disclaimer],
  ]

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `katana-tax-packet-${packet.tax_year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadTaxPacketPdf(packet: TaxPacketData): Promise<void> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([612, 792])
  let y = 750

  const line = (text: string, size = 11, useBold = false) => {
    page.drawText(text.slice(0, 90), {
      x: 50,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    })
    y -= size + 6
  }

  line('Katana Finance — Tax Readiness Packet', 16, true)
  line(`Tax year: ${packet.tax_year}`)
  line(`Entity: ${packet.entity_label}`)
  if (packet.ein) line(`EIN: ${packet.ein}`)
  line(`Net income: ${formatCurrency(packet.profit_and_loss.net_income)}`)
  line(`Total income: ${formatCurrency(packet.profit_and_loss.total_income)}`)
  line(`Total expenses: ${formatCurrency(packet.profit_and_loss.total_expenses)}`)
  line(`Transactions: ${packet.transaction_count}`)
  y -= 8
  line('1099 vendors (>= $600):', 12, true)
  if (packet.vendors_1099.length === 0) line('None flagged')
  for (const v of packet.vendors_1099.slice(0, 12)) {
    line(`${v.name}: ${formatCurrency(v.ytd_payments)}`)
  }
  y -= 8
  line('Disclaimer:', 10, true)
  line(packet.disclaimer, 9)

  const bytes = await pdf.save()
  const blob = new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `katana-tax-packet-${packet.tax_year}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================
// ESTIMATED TAX (informational)
// ============================================

export interface EstimatedTaxReminder {
  quarter: number
  due_date: string
  label: string
  suggested_payment: number
  ytd_net_income: number
  disclaimer: string
}

const QUARTER_DUES = [
  { quarter: 1, due: '04-15', label: 'Q1 estimated tax' },
  { quarter: 2, due: '06-15', label: 'Q2 estimated tax' },
  { quarter: 3, due: '09-15', label: 'Q3 estimated tax' },
  { quarter: 4, due: '01-15', label: 'Q4 estimated tax (following year)' },
]

export async function getEstimatedTaxReminders(taxYear: number): Promise<EstimatedTaxReminder[]> {
  const today = new Date()
  const ytdEnd = today.toISOString().slice(0, 10)
  const pnl = await getProfitAndLossReport(`${taxYear}-01-01`, ytdEnd)
  const ytdNet = Math.max(0, pnl.net_income)

  const federalRate = 0.25
  const annualEstimate = ytdNet * federalRate
  const quarterly = annualEstimate / 4

  const disclaimer =
    'Illustrative only — not tax advice. Actual estimated taxes depend on your entity type, deductions, state obligations, and prior payments. Consult your CPA.'

  return QUARTER_DUES.map((q) => {
    const dueYear = q.quarter === 4 ? taxYear + 1 : taxYear
    return {
      quarter: q.quarter,
      due_date: `${dueYear}-${q.due}`,
      label: q.label,
      suggested_payment: quarterly,
      ytd_net_income: ytdNet,
      disclaimer,
    }
  })
}

export { formatCurrency }
