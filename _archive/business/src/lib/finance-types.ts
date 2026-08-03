/**
 * Katana Finance — shared types and display labels
 */

export type EntityType =
  | 'sole_prop'
  | 'llc_disregarded'
  | 'llc_partnership'
  | 'llc_s_corp'
  | 'partnership'
  | 's_corp'
  | 'c_corp'

export type TaxBasis = 'cash' | 'accrual'

export type FinanceUiMode = 'simple' | 'advanced'

export type CoaAccountType =
  | 'bank'
  | 'accounts_receivable'
  | 'other_current_asset'
  | 'fixed_asset'
  | 'accounts_payable'
  | 'credit_card'
  | 'other_current_liability'
  | 'long_term_liability'
  | 'equity'
  | 'income'
  | 'cost_of_goods_sold'
  | 'expense'
  | 'other_income'
  | 'other_expense'

export type FinancialAccountKind = 'checking' | 'savings' | 'credit_card' | 'other'

export type BankTransactionStatus = 'uncategorized' | 'categorized' | 'reconciled' | 'excluded'

export type PeriodStatus = 'open' | 'in_review' | 'closed'

export type JournalEntryStatus = 'draft' | 'posted' | 'void'

export type JournalSourceType = 'manual' | 'bank_transaction' | 'invoice' | 'purchase_order' | 'import'

export interface FinEntitySettings {
  id: string
  organization_id: string
  entity_type: EntityType
  tax_basis: TaxBasis
  fiscal_year_end_month: number
  fiscal_year_end_day: number
  industry_template: string
  ein: string | null
  state_of_formation: string | null
  ui_mode: FinanceUiMode
  setup_completed_at: string | null
  created_at: string
  updated_at: string
}

export interface FinAccount {
  id: string
  organization_id: string
  account_number: string | null
  name: string
  account_type: CoaAccountType
  parent_id: string | null
  description: string | null
  is_system: boolean
  is_active: boolean
  external_system: string | null
  external_id: string | null
  created_at: string
  updated_at: string
}

export interface FinFinancialAccount {
  id: string
  organization_id: string
  name: string
  institution: string | null
  account_kind: FinancialAccountKind
  mask: string | null
  coa_account_id: string | null
  opening_balance: number
  opening_balance_date: string | null
  is_active: boolean
  plaid_item_id: string | null
  plaid_account_id: string | null
  created_at: string
  updated_at: string
}

export interface FinPeriod {
  id: string
  organization_id: string
  year: number
  month: number
  status: PeriodStatus
  closed_at: string | null
  closed_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface FinJournalEntry {
  id: string
  organization_id: string
  entry_date: string
  memo: string | null
  source_type: JournalSourceType
  source_id: string | null
  period_id: string | null
  status: JournalEntryStatus
  external_system: string | null
  external_id: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface FinJournalLine {
  id: string
  organization_id: string
  journal_entry_id: string
  account_id: string
  debit: number
  credit: number
  description: string | null
  financial_account_id: string | null
  project_id: string | null
  client_id: string | null
  created_at: string
}

export interface FinBankTransaction {
  id: string
  organization_id: string
  financial_account_id: string
  transaction_date: string
  description: string
  amount: number
  status: BankTransactionStatus
  category_account_id: string | null
  journal_entry_id: string | null
  statement_id: string | null
  import_batch_id: string | null
  notes: string | null
  linked_source_type: FinanceLinkSourceType | null
  linked_source_id: string | null
  reconciliation_id: string | null
  created_at: string
  updated_at: string
}

export type FinanceLinkSourceType = 'invoice' | 'purchase_order'

export type StatementParseStatus = 'pending' | 'parsed' | 'failed' | 'reviewed'

export type ReconciliationStatus = 'in_progress' | 'balanced' | 'closed'

export interface FinStatement {
  id: string
  organization_id: string
  financial_account_id: string
  period_start: string
  period_end: string
  opening_balance: number | null
  closing_balance: number | null
  file_path: string | null
  file_name: string | null
  parse_status: StatementParseStatus
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface FinReconciliation {
  id: string
  organization_id: string
  financial_account_id: string
  statement_id: string | null
  period_end: string
  statement_balance: number
  cleared_balance: number
  difference: number
  status: ReconciliationStatus
  completed_at: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface FinReconciliationItem {
  id: string
  organization_id: string
  reconciliation_id: string
  bank_transaction_id: string
  is_cleared: boolean
  created_at: string
}

export interface FinReconciliationWorkspace {
  reconciliation: FinReconciliation
  financialAccount: FinFinancialAccount
  transactions: FinBankTransaction[]
  items: FinReconciliationItem[]
  registerBalance: number
}

export interface ProfitLossLine {
  account_id: string
  account_number: string | null
  account_name: string
  account_type: CoaAccountType
  amount: number
}

export interface ProfitLossReport {
  period_start: string
  period_end: string
  income: ProfitLossLine[]
  expenses: ProfitLossLine[]
  total_income: number
  total_expenses: number
  net_income: number
}

export interface BalanceSheetLine {
  account_id: string
  account_number: string | null
  account_name: string
  account_type: CoaAccountType
  balance: number
}

export interface BalanceSheetReport {
  as_of_date: string
  assets: BalanceSheetLine[]
  liabilities: BalanceSheetLine[]
  equity: BalanceSheetLine[]
  total_assets: number
  total_liabilities: number
  total_equity: number
}

export interface CashFlowReport {
  period_start: string
  period_end: string
  operating: number
  investing: number
  financing: number
  net_change: number
  inflows: number
  outflows: number
}

export interface FinVendor {
  id: string
  organization_id: string
  name: string
  email: string | null
  tax_id: string | null
  address: string | null
  is_1099_eligible: boolean
  w9_on_file: boolean
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TaxPacketVendorLine {
  vendor_id: string
  name: string
  tax_id: string | null
  ytd_payments: number
}

export interface TaxPacketData {
  tax_year: number
  generated_at: string
  entity_type: EntityType | string
  entity_label: string
  ein: string | null
  tax_basis: TaxBasis | string
  profit_and_loss: ProfitLossReport
  balance_sheet: BalanceSheetReport
  cash_flow: CashFlowReport
  transaction_count: number
  vendors_1099: TaxPacketVendorLine[]
  disclaimer: string
}

export interface FinDashboardSummary {
  uncategorizedCount: number
  categorizedThisMonth: number
  inflowThisMonth: number
  outflowThisMonth: number
  financialAccountCount: number
  coaAccountCount: number
  setupComplete: boolean
  openReconciliationCount: number
  netIncomeYtd: number
}

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  sole_prop: 'Sole proprietorship',
  llc_disregarded: 'LLC (disregarded entity)',
  llc_partnership: 'LLC (partnership)',
  llc_s_corp: 'LLC (S-Corp election)',
  partnership: 'Partnership',
  s_corp: 'S Corporation',
  c_corp: 'C Corporation',
}

export const TAX_BASIS_LABELS: Record<TaxBasis, string> = {
  cash: 'Cash basis',
  accrual: 'Accrual basis',
}

export const COA_ACCOUNT_TYPE_LABELS: Record<CoaAccountType, string> = {
  bank: 'Bank',
  accounts_receivable: 'Accounts Receivable',
  other_current_asset: 'Other Current Asset',
  fixed_asset: 'Fixed Asset',
  accounts_payable: 'Accounts Payable',
  credit_card: 'Credit Card',
  other_current_liability: 'Other Current Liability',
  long_term_liability: 'Long Term Liability',
  equity: 'Equity',
  income: 'Income',
  cost_of_goods_sold: 'Cost of Goods Sold',
  expense: 'Expense',
  other_income: 'Other Income',
  other_expense: 'Other Expense',
}

export const FINANCIAL_ACCOUNT_KIND_LABELS: Record<FinancialAccountKind, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  other: 'Other',
}

export const BANK_TRANSACTION_STATUS_LABELS: Record<BankTransactionStatus, string> = {
  uncategorized: 'Uncategorized',
  categorized: 'Categorized',
  reconciled: 'Reconciled',
  excluded: 'Excluded',
}

export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  in_progress: 'In progress',
  balanced: 'Balanced',
  closed: 'Closed',
}

export const INDUSTRY_TEMPLATE_OPTIONS = [
  { id: 'services', label: 'Professional services' },
  { id: 'retail', label: 'Retail' },
  { id: 'construction', label: 'Construction' },
  { id: 'saas', label: 'SaaS / software' },
] as const
