import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'
import { getCoaTemplateAccounts, defaultBankCoaName } from './finance-coa-templates'
import type {
  FinAccount,
  FinBankTransaction,
  FinDashboardSummary,
  FinEntitySettings,
  FinFinancialAccount,
  FinPeriod,
  FinStatement,
  FinReconciliation,
  FinReconciliationItem,
  FinReconciliationWorkspace,
  ProfitLossReport,
  ProfitLossLine,
  EntityType,
  TaxBasis,
  FinanceUiMode,
  FinancialAccountKind,
  BankTransactionStatus,
  FinanceLinkSourceType,
} from './finance-types'
import type { ParsedStatementRow } from './finance-statement-parser'

// ============================================
// ENTITY SETTINGS
// ============================================

export async function getEntitySettings(): Promise<FinEntitySettings | null> {
  if (!isSupabaseConfigured) return null
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('fin_entity_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle()
  if (error) {
    console.error('Error fetching finance entity settings:', error)
    throw error
  }
  return data as FinEntitySettings | null
}

export interface UpsertEntitySettingsInput {
  entity_type: EntityType
  tax_basis: TaxBasis
  fiscal_year_end_month?: number
  fiscal_year_end_day?: number
  industry_template?: string
  ein?: string | null
  state_of_formation?: string | null
  ui_mode?: FinanceUiMode
  complete_setup?: boolean
}

export async function upsertEntitySettings(
  input: UpsertEntitySettingsInput,
): Promise<FinEntitySettings> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()
  const existing = await getEntitySettings()

  const payload = {
    organization_id: orgId,
    entity_type: input.entity_type,
    tax_basis: input.tax_basis,
    fiscal_year_end_month: input.fiscal_year_end_month ?? 12,
    fiscal_year_end_day: input.fiscal_year_end_day ?? 31,
    industry_template: input.industry_template ?? 'services',
    ein: input.ein ?? null,
    state_of_formation: input.state_of_formation ?? null,
    ui_mode: input.ui_mode ?? 'simple',
    setup_completed_at: input.complete_setup ? new Date().toISOString() : existing?.setup_completed_at ?? null,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { data, error } = await supabase
      .from('fin_entity_settings')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data as FinEntitySettings
  }

  const { data, error } = await supabase
    .from('fin_entity_settings')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as FinEntitySettings
}

// ============================================
// CHART OF ACCOUNTS
// ============================================

export async function getAccounts(): Promise<FinAccount[]> {
  if (!isSupabaseConfigured) return []
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('fin_accounts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('account_number')
  if (error) throw error
  return (data ?? []) as FinAccount[]
}

export async function seedChartOfAccounts(
  industryTemplate: string,
  entityType: string,
): Promise<FinAccount[]> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()
  const existing = await getAccounts()
  if (existing.length > 0) return existing

  const template = getCoaTemplateAccounts(industryTemplate, entityType)
  const rows = template.map((a) => ({
    organization_id: orgId,
    account_number: a.account_number,
    name: a.name,
    account_type: a.account_type,
    is_system: a.is_system ?? false,
    is_active: true,
  }))

  const { data, error } = await supabase.from('fin_accounts').insert(rows).select('*')
  if (error) throw error
  return (data ?? []) as FinAccount[]
}

export async function findAccountByName(name: string): Promise<FinAccount | null> {
  const accounts = await getAccounts()
  return accounts.find((a) => a.name.toLowerCase() === name.toLowerCase()) ?? null
}

// ============================================
// FINANCIAL ACCOUNTS (bank / CC)
// ============================================

export async function getFinancialAccounts(): Promise<FinFinancialAccount[]> {
  if (!isSupabaseConfigured) return []
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('fin_financial_accounts')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as FinFinancialAccount[]
}

export interface CreateFinancialAccountInput {
  name: string
  institution?: string
  account_kind?: FinancialAccountKind
  mask?: string
  opening_balance?: number
  opening_balance_date?: string
}

export async function createFinancialAccount(
  input: CreateFinancialAccountInput,
): Promise<FinFinancialAccount> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()
  const kind = input.account_kind ?? 'checking'

  let coaAccount = await findAccountByName(defaultBankCoaName(kind))
  if (!coaAccount) {
    const accounts = await getAccounts()
    coaAccount = accounts.find((a) => a.account_type === 'bank' || a.account_type === 'credit_card') ?? null
  }

  const { data, error } = await supabase
    .from('fin_financial_accounts')
    .insert({
      organization_id: orgId,
      name: input.name.trim(),
      institution: input.institution?.trim() || null,
      account_kind: kind,
      mask: input.mask?.trim() || null,
      coa_account_id: coaAccount?.id ?? null,
      opening_balance: input.opening_balance ?? 0,
      opening_balance_date: input.opening_balance_date ?? null,
      is_active: true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as FinFinancialAccount
}

// ============================================
// PERIODS
// ============================================

export async function ensureCurrentPeriod(): Promise<FinPeriod> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const { data: existing } = await supabase
    .from('fin_periods')
    .select('*')
    .eq('organization_id', orgId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (existing) return existing as FinPeriod

  const { data, error } = await supabase
    .from('fin_periods')
    .insert({ organization_id: orgId, year, month, status: 'open' })
    .select('*')
    .single()
  if (error) throw error
  return data as FinPeriod
}

// ============================================
// BANK TRANSACTIONS
// ============================================

export async function getBankTransactions(options?: {
  status?: BankTransactionStatus
  financialAccountId?: string
  limit?: number
}): Promise<FinBankTransaction[]> {
  if (!isSupabaseConfigured) return []
  const orgId = await getOrganizationId()
  let query = supabase
    .from('fin_bank_transactions')
    .select('*')
    .eq('organization_id', orgId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (options?.status) query = query.eq('status', options.status)
  if (options?.financialAccountId) query = query.eq('financial_account_id', options.financialAccountId)
  if (options?.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as FinBankTransaction[]
}

export interface CreateBankTransactionInput {
  financial_account_id: string
  transaction_date: string
  description: string
  amount: number
}

export async function createBankTransaction(
  input: CreateBankTransactionInput,
): Promise<FinBankTransaction> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('fin_bank_transactions')
    .insert({
      organization_id: orgId,
      financial_account_id: input.financial_account_id,
      transaction_date: input.transaction_date,
      description: input.description.trim(),
      amount: input.amount,
      status: 'uncategorized',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as FinBankTransaction
}

export async function categorizeBankTransaction(
  transactionId: string,
  categoryAccountId: string,
): Promise<FinBankTransaction> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()
  const userId = await getCurrentUserId()

  const { data: txn, error: fetchError } = await supabase
    .from('fin_bank_transactions')
    .select('*')
    .eq('id', transactionId)
    .eq('organization_id', orgId)
    .single()
  if (fetchError || !txn) throw fetchError ?? new Error('Transaction not found')

  const { data: finAccount } = await supabase
    .from('fin_financial_accounts')
    .select('*, coa_account_id')
    .eq('id', txn.financial_account_id)
    .single()

  if (!finAccount?.coa_account_id) {
    throw new Error('Financial account is not linked to a chart of accounts entry')
  }

  const period = await ensureCurrentPeriod()
  const amount = Number(txn.amount)
  const isInflow = amount > 0
  const absAmount = Math.abs(amount)

  const { data: entry, error: entryError } = await supabase
    .from('fin_journal_entries')
    .insert({
      organization_id: orgId,
      entry_date: txn.transaction_date,
      memo: txn.description,
      source_type: 'bank_transaction',
      source_id: txn.id,
      period_id: period.id,
      status: 'posted',
      created_by_user_id: userId,
    })
    .select('*')
    .single()
  if (entryError) throw entryError

  const bankLine = {
    organization_id: orgId,
    journal_entry_id: entry.id,
    account_id: finAccount.coa_account_id,
    debit: isInflow ? absAmount : 0,
    credit: isInflow ? 0 : absAmount,
    description: txn.description,
    financial_account_id: txn.financial_account_id,
  }
  const categoryLine = {
    organization_id: orgId,
    journal_entry_id: entry.id,
    account_id: categoryAccountId,
    debit: isInflow ? 0 : absAmount,
    credit: isInflow ? absAmount : 0,
    description: txn.description,
    financial_account_id: txn.financial_account_id,
  }

  const { error: linesError } = await supabase
    .from('fin_journal_lines')
    .insert([bankLine, categoryLine])
  if (linesError) throw linesError

  const { data: updated, error: updateError } = await supabase
    .from('fin_bank_transactions')
    .update({
      status: 'categorized',
      category_account_id: categoryAccountId,
      journal_entry_id: entry.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .select('*')
    .single()
  if (updateError) throw updateError
  return updated as FinBankTransaction
}

export async function linkBankTransactionToSource(
  transactionId: string,
  sourceType: FinanceLinkSourceType,
  sourceId: string,
  categoryAccountId: string,
): Promise<FinBankTransaction> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()

  const { error: linkError } = await supabase
    .from('fin_bank_transactions')
    .update({
      linked_source_type: sourceType,
      linked_source_id: sourceId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .eq('organization_id', orgId)
  if (linkError) throw linkError

  return categorizeBankTransaction(transactionId, categoryAccountId)
}

// ============================================
// STATEMENT IMPORT
// ============================================

export async function uploadStatementFile(
  file: File,
  financialAccountId: string,
  periodStart: string,
  periodEnd: string,
  closingBalance?: number,
): Promise<FinStatement> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()
  const userId = await getCurrentUserId()
  const batchId = crypto.randomUUID()
  const ext = file.name.split('.').pop() ?? 'csv'
  const path = `${orgId}/${financialAccountId}/${batchId}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('finance-statements')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('fin_statements')
    .insert({
      organization_id: orgId,
      financial_account_id: financialAccountId,
      period_start: periodStart,
      period_end: periodEnd,
      closing_balance: closingBalance ?? null,
      file_path: path,
      file_name: file.name,
      parse_status: 'pending',
      created_by_user_id: userId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as FinStatement
}

export async function importStatementTransactions(
  financialAccountId: string,
  rows: ParsedStatementRow[],
  statementId?: string,
): Promise<{ imported: number; skipped: number }> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()
  const importBatchId = crypto.randomUUID()

  const existing = await getBankTransactions({ financialAccountId })
  const existingKeys = new Set(
    existing.map(
      (e) =>
        `${e.transaction_date}|${Number(e.amount).toFixed(2)}|${e.description.trim().toLowerCase().slice(0, 40)}`,
    ),
  )

  const toInsert: Record<string, unknown>[] = []
  let skipped = 0

  for (const row of rows) {
    const key = `${row.transaction_date}|${row.amount.toFixed(2)}|${row.description.trim().toLowerCase().slice(0, 40)}`
    if (existingKeys.has(key)) {
      skipped += 1
      continue
    }
    existingKeys.add(key)
    toInsert.push({
      organization_id: orgId,
      financial_account_id: financialAccountId,
      transaction_date: row.transaction_date,
      description: row.description,
      amount: row.amount,
      status: 'uncategorized',
      statement_id: statementId ?? null,
      import_batch_id: importBatchId,
    })
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('fin_bank_transactions').insert(toInsert)
    if (error) throw error
  }

  if (statementId) {
    await supabase
      .from('fin_statements')
      .update({ parse_status: 'reviewed', updated_at: new Date().toISOString() })
      .eq('id', statementId)
  }

  return { imported: toInsert.length, skipped }
}

export async function getStatements(): Promise<FinStatement[]> {
  if (!isSupabaseConfigured) return []
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('fin_statements')
    .select('*')
    .eq('organization_id', orgId)
    .order('period_end', { ascending: false })
  if (error) throw error
  return (data ?? []) as FinStatement[]
}

// ============================================
// RECONCILIATION
// ============================================

export async function getReconciliations(): Promise<FinReconciliation[]> {
  if (!isSupabaseConfigured) return []
  const orgId = await getOrganizationId()
  const { data, error } = await supabase
    .from('fin_reconciliations')
    .select('*')
    .eq('organization_id', orgId)
    .order('period_end', { ascending: false })
  if (error) throw error
  return (data ?? []) as FinReconciliation[]
}

export async function createReconciliation(input: {
  financial_account_id: string
  period_end: string
  statement_balance: number
  statement_id?: string
}): Promise<FinReconciliation> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()
  const userId = await getCurrentUserId()

  const { data: finAccount, error: faError } = await supabase
    .from('fin_financial_accounts')
    .select('*')
    .eq('id', input.financial_account_id)
    .eq('organization_id', orgId)
    .single()
  if (faError || !finAccount) throw faError ?? new Error('Financial account not found')

  const { data, error } = await supabase
    .from('fin_reconciliations')
    .insert({
      organization_id: orgId,
      financial_account_id: input.financial_account_id,
      statement_id: input.statement_id ?? null,
      period_end: input.period_end,
      statement_balance: input.statement_balance,
      cleared_balance: Number(finAccount.opening_balance) || 0,
      difference: input.statement_balance - (Number(finAccount.opening_balance) || 0),
      status: 'in_progress',
      created_by_user_id: userId,
    })
    .select('*')
    .single()
  if (error) throw error

  const transactions = await getBankTransactions({
    financialAccountId: input.financial_account_id,
  })
  const eligible = transactions.filter(
    (t) =>
      t.status !== 'excluded' &&
      t.transaction_date <= input.period_end,
  )

  if (eligible.length > 0) {
    const items = eligible.map((t) => ({
      organization_id: orgId,
      reconciliation_id: data.id,
      bank_transaction_id: t.id,
      is_cleared: false,
    }))
    await supabase.from('fin_reconciliation_items').insert(items)
  }

  return data as FinReconciliation
}

function computeClearedBalance(
  openingBalance: number,
  transactions: FinBankTransaction[],
  clearedIds: Set<string>,
): number {
  let balance = openingBalance
  for (const t of transactions) {
    if (clearedIds.has(t.id)) balance += Number(t.amount)
  }
  return balance
}

export async function getReconciliationWorkspace(
  reconciliationId: string,
): Promise<FinReconciliationWorkspace> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()

  const { data: reconciliation, error: reconError } = await supabase
    .from('fin_reconciliations')
    .select('*')
    .eq('id', reconciliationId)
    .eq('organization_id', orgId)
    .single()
  if (reconError || !reconciliation) throw reconError ?? new Error('Reconciliation not found')

  const { data: finAccount, error: faError } = await supabase
    .from('fin_financial_accounts')
    .select('*')
    .eq('id', reconciliation.financial_account_id)
    .single()
  if (faError || !finAccount) throw faError ?? new Error('Financial account not found')

  const { data: items, error: itemsError } = await supabase
    .from('fin_reconciliation_items')
    .select('*')
    .eq('reconciliation_id', reconciliationId)
  if (itemsError) throw itemsError

  const itemList = (items ?? []) as FinReconciliationItem[]
  const txnIds = itemList.map((i) => i.bank_transaction_id)

  let transactions: FinBankTransaction[] = []
  if (txnIds.length > 0) {
    const { data: txns, error: txnError } = await supabase
      .from('fin_bank_transactions')
      .select('*')
      .in('id', txnIds)
      .order('transaction_date', { ascending: true })
    if (txnError) throw txnError
    transactions = (txns ?? []) as FinBankTransaction[]
  }

  const clearedIds = new Set(itemList.filter((i) => i.is_cleared).map((i) => i.bank_transaction_id))
  const registerBalance = computeClearedBalance(
    Number(finAccount.opening_balance) || 0,
    transactions,
    clearedIds,
  )

  return {
    reconciliation: reconciliation as FinReconciliation,
    financialAccount: finAccount as FinFinancialAccount,
    transactions,
    items: itemList,
    registerBalance,
  }
}

export async function setReconciliationItemCleared(
  reconciliationId: string,
  bankTransactionId: string,
  isCleared: boolean,
): Promise<FinReconciliation> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()

  await supabase
    .from('fin_reconciliation_items')
    .update({ is_cleared: isCleared })
    .eq('reconciliation_id', reconciliationId)
    .eq('bank_transaction_id', bankTransactionId)
    .eq('organization_id', orgId)

  const workspace = await getReconciliationWorkspace(reconciliationId)
  const clearedIds = new Set(
    workspace.items.filter((i) => i.is_cleared).map((i) => i.bank_transaction_id),
  )

  const clearedBalance = computeClearedBalance(
    Number(workspace.financialAccount.opening_balance) || 0,
    workspace.transactions,
    clearedIds,
  )
  const difference = Number(workspace.reconciliation.statement_balance) - clearedBalance
  const status = Math.abs(difference) < 0.01 ? 'balanced' : 'in_progress'

  const { data, error } = await supabase
    .from('fin_reconciliations')
    .update({
      cleared_balance: clearedBalance,
      difference,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reconciliationId)
    .select('*')
    .single()
  if (error) throw error
  return data as FinReconciliation
}

export async function completeReconciliation(reconciliationId: string): Promise<FinReconciliation> {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured')
  const orgId = await getOrganizationId()
  const workspace = await getReconciliationWorkspace(reconciliationId)

  if (Math.abs(workspace.reconciliation.difference) >= 0.01) {
    throw new Error('Reconciliation is not balanced. Cleared balance must match statement balance.')
  }

  const clearedIds = workspace.items.filter((i) => i.is_cleared).map((i) => i.bank_transaction_id)
  if (clearedIds.length > 0) {
    await supabase
      .from('fin_bank_transactions')
      .update({
        status: 'reconciled',
        reconciliation_id: reconciliationId,
        updated_at: new Date().toISOString(),
      })
      .in('id', clearedIds)
      .eq('organization_id', orgId)
  }

  const { data, error } = await supabase
    .from('fin_reconciliations')
    .update({
      status: 'closed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', reconciliationId)
    .select('*')
    .single()
  if (error) throw error
  return data as FinReconciliation
}

// ============================================
// REPORTS — Profit & Loss
// ============================================

export async function getProfitAndLossReport(
  periodStart: string,
  periodEnd: string,
): Promise<ProfitLossReport> {
  if (!isSupabaseConfigured) {
    return {
      period_start: periodStart,
      period_end: periodEnd,
      income: [],
      expenses: [],
      total_income: 0,
      total_expenses: 0,
      net_income: 0,
    }
  }

  const orgId = await getOrganizationId()
  const accounts = await getAccounts()
  const accountById = Object.fromEntries(accounts.map((a) => [a.id, a]))

  const { data: entries, error: entriesError } = await supabase
    .from('fin_journal_entries')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'posted')
    .gte('entry_date', periodStart)
    .lte('entry_date', periodEnd)
  if (entriesError) throw entriesError

  const entryIds = (entries ?? []).map((e) => e.id)
  if (entryIds.length === 0) {
    return {
      period_start: periodStart,
      period_end: periodEnd,
      income: [],
      expenses: [],
      total_income: 0,
      total_expenses: 0,
      net_income: 0,
    }
  }

  const { data: lines, error: linesError } = await supabase
    .from('fin_journal_lines')
    .select('*')
    .in('journal_entry_id', entryIds)
  if (linesError) throw linesError

  const totals = new Map<string, number>()
  for (const line of lines ?? []) {
    const acct = accountById[line.account_id]
    if (!acct) continue
    const prev = totals.get(line.account_id) ?? 0
    const debit = Number(line.debit) || 0
    const credit = Number(line.credit) || 0

    if (['income', 'other_income'].includes(acct.account_type)) {
      totals.set(line.account_id, prev + credit - debit)
    } else if (['expense', 'cost_of_goods_sold', 'other_expense'].includes(acct.account_type)) {
      totals.set(line.account_id, prev + debit - credit)
    }
  }

  const income: ProfitLossLine[] = []
  const expenses: ProfitLossLine[] = []

  for (const [accountId, amount] of totals) {
    if (Math.abs(amount) < 0.005) continue
    const acct = accountById[accountId]
    if (!acct) continue
    const row: ProfitLossLine = {
      account_id: accountId,
      account_number: acct.account_number,
      account_name: acct.name,
      account_type: acct.account_type,
      amount,
    }
    if (['income', 'other_income'].includes(acct.account_type)) income.push(row)
    else expenses.push(row)
  }

  income.sort((a, b) => (a.account_number ?? '').localeCompare(b.account_number ?? ''))
  expenses.sort((a, b) => (a.account_number ?? '').localeCompare(b.account_number ?? ''))

  const total_income = income.reduce((s, l) => s + l.amount, 0)
  const total_expenses = expenses.reduce((s, l) => s + l.amount, 0)

  return {
    period_start: periodStart,
    period_end: periodEnd,
    income,
    expenses,
    total_income,
    total_expenses,
    net_income: total_income - total_expenses,
  }
}

// ============================================
// SETUP ORCHESTRATION
// ============================================

export async function completeFinanceSetup(
  input: UpsertEntitySettingsInput,
): Promise<{ settings: FinEntitySettings; accounts: FinAccount[] }> {
  const settings = await upsertEntitySettings({ ...input, complete_setup: true })
  const accounts = await seedChartOfAccounts(
    settings.industry_template,
    settings.entity_type,
  )
  await ensureCurrentPeriod()
  return { settings, accounts }
}

// ============================================
// DASHBOARD
// ============================================

export async function getDashboardSummary(): Promise<FinDashboardSummary> {
  if (!isSupabaseConfigured) {
    return {
      uncategorizedCount: 0,
      categorizedThisMonth: 0,
      inflowThisMonth: 0,
      outflowThisMonth: 0,
      financialAccountCount: 0,
      coaAccountCount: 0,
      setupComplete: false,
      openReconciliationCount: 0,
      netIncomeYtd: 0,
    }
  }

  const orgId = await getOrganizationId()
  const settings = await getEntitySettings()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const yearStart = `${now.getFullYear()}-01-01`
  const today = now.toISOString().slice(0, 10)

  const [uncategorizedRes, monthTxRes, finAccountsRes, coaRes, openReconRes, pnl] = await Promise.all([
    supabase
      .from('fin_bank_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'uncategorized'),
    supabase
      .from('fin_bank_transactions')
      .select('amount, status')
      .eq('organization_id', orgId)
      .gte('transaction_date', monthStart),
    supabase
      .from('fin_financial_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true),
    supabase
      .from('fin_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('is_active', true),
    supabase
      .from('fin_reconciliations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'in_progress'),
    getProfitAndLossReport(yearStart, today).catch(() => null),
  ])

  const monthTx = (monthTxRes.data ?? []) as { amount: number; status: string }[]
  let inflow = 0
  let outflow = 0
  let categorizedThisMonth = 0
  for (const t of monthTx) {
    const amt = Number(t.amount)
    if (amt > 0) inflow += amt
    else outflow += Math.abs(amt)
    if (t.status === 'categorized' || t.status === 'reconciled') categorizedThisMonth += 1
  }

  return {
    uncategorizedCount: uncategorizedRes.count ?? 0,
    categorizedThisMonth,
    inflowThisMonth: inflow,
    outflowThisMonth: outflow,
    financialAccountCount: finAccountsRes.count ?? 0,
    coaAccountCount: coaRes.count ?? 0,
    setupComplete: Boolean(settings?.setup_completed_at),
    openReconciliationCount: openReconRes.count ?? 0,
    netIncomeYtd: pnl?.net_income ?? 0,
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
