/**
 * Katana Finance freeform (v2) widget catalogs.
 * Surfaces: every main tab (overview, transactions, accounts, reconcile, reports, tax, coa, settings).
 */

import type { Layout } from 'react-grid-layout'
import {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  normalizeModuleWidgetLayout,
  removeWidgetFromLayout,
  type ModuleWidgetItem,
  type ModuleWidgetLayout,
  type WidgetCatalogEntry,
} from '@/lib/module-widget-layout'

/** Shared freeform layout props passed from FinancePage into each tab panel. */
export interface FinanceTabLayoutProps {
  widgets: ModuleWidgetItem[]
  catalog: readonly WidgetCatalogEntry[]
  customizeMode: boolean
  onLayoutChange: (layout: Layout[]) => void
  onRemoveWidget: (widgetId: string) => void
}

export const FINANCE_MODULE_ID = 'finance'

export type FinanceTabSurfaceId =
  | 'overview'
  | 'transactions'
  | 'accounts'
  | 'reconcile'
  | 'reports'
  | 'tax'
  | 'coa'
  | 'settings'

export const FINANCE_TAB_SURFACE_IDS: FinanceTabSurfaceId[] = [
  'overview',
  'transactions',
  'accounts',
  'reconcile',
  'reports',
  'tax',
  'coa',
  'settings',
]

function entry(
  id: string,
  label: string,
  description: string,
  defaultW: number,
  defaultH: number,
  minW = 2,
  minH = 2
): WidgetCatalogEntry {
  return { id, label, description, defaultW, defaultH, minW, minH }
}

function item(
  i: string,
  x: number,
  y: number,
  w: number,
  h: number,
  minW?: number,
  minH?: number
): ModuleWidgetItem {
  return { i, x, y, w, h, minW, minH }
}

function makeSurface(catalog: WidgetCatalogEntry[], defaults: ModuleWidgetItem[]) {
  const normalize = (raw: unknown) =>
    normalizeModuleWidgetLayout(raw, catalog, defaults, {})
  const toBase = (layout: ModuleWidgetLayout): ModuleWidgetLayout => ({
    version: 2,
    widgets: layout.widgets,
    extras: layout.extras ?? {},
  })
  return { catalog, defaults, normalize, toBase }
}

// --- Overview ---

export const FINANCE_OVERVIEW_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('entity_badges', 'Entity context', 'Entity type, tax basis, and fiscal year end', 12, 3, 4, 2),
  entry('stats', 'KPI strip', 'Inflow, outflow, to categorize, and net income YTD', 12, 4, 6, 3),
  entry('metric_inflow', 'Inflow', 'Single metric: inflow this month', 3, 3),
  entry('metric_outflow', 'Outflow', 'Single metric: outflow this month', 3, 3),
  entry('metric_uncategorized', 'To categorize', 'Single metric: uncategorized count', 3, 3),
  entry('metric_net_income_ytd', 'Net income YTD', 'Single metric: net income year-to-date', 3, 3),
  entry('close_checklist', 'Monthly close checklist', 'Close steps with links into other Finance tabs', 6, 8, 3, 4),
  entry('integrations_blurb', 'Connected to Katana', 'Cross-module matching blurb and quick actions', 6, 8, 3, 4),
]

export const DEFAULT_FINANCE_OVERVIEW_WIDGETS: ModuleWidgetItem[] = [
  item('entity_badges', 0, 0, 12, 3, 4, 2),
  item('stats', 0, 3, 12, 4, 6, 3),
  item('close_checklist', 0, 7, 6, 8, 3, 4),
  item('integrations_blurb', 6, 7, 6, 8, 3, 4),
]

const overviewSurface = makeSurface(
  FINANCE_OVERVIEW_WIDGET_CATALOG,
  DEFAULT_FINANCE_OVERVIEW_WIDGETS
)
export const normalizeFinanceOverviewWidgetLayout = overviewSurface.normalize
export const financeOverviewWidgetLayoutToBase = overviewSurface.toBase

// --- Transactions ---

export const FINANCE_TRANSACTIONS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('statement_import', 'Import bank statement', 'CSV/PDF statement upload and import', 12, 8, 4, 4),
  entry('transactions_header', 'Transactions header', 'Title and add-transaction action', 12, 3, 4, 2),
  entry('add_transaction_form', 'Add transaction', 'Manual transaction create form', 12, 8, 4, 4),
  entry('match_suggestions', 'Katana match suggestions', 'Cross-module invoice/PO match cards', 12, 6, 4, 3),
  entry('empty_no_accounts', 'Need bank account', 'Empty state when no financial accounts', 12, 4, 4, 2),
  entry('transaction_list', 'Transaction register', 'Full transaction table with categorize/match', 12, 16, 6, 8),
  entry('metric_uncategorized', 'Uncategorized count', 'Uncategorized transaction count', 4, 3),
  entry('metric_txn_count', 'Transaction count', 'Total transactions in view', 4, 3),
]

export const DEFAULT_FINANCE_TRANSACTIONS_WIDGETS: ModuleWidgetItem[] = [
  item('statement_import', 0, 0, 12, 8, 4, 4),
  item('transactions_header', 0, 8, 12, 3, 4, 2),
  item('match_suggestions', 0, 11, 12, 6, 4, 3),
  item('transaction_list', 0, 17, 12, 16, 6, 8),
]

const transactionsSurface = makeSurface(
  FINANCE_TRANSACTIONS_WIDGET_CATALOG,
  DEFAULT_FINANCE_TRANSACTIONS_WIDGETS
)
export const normalizeFinanceTransactionsWidgetLayout = transactionsSurface.normalize
export const financeTransactionsWidgetLayoutToBase = transactionsSurface.toBase

// --- Bank accounts ---

export const FINANCE_ACCOUNTS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('plaid_feeds', 'Live bank feeds (Plaid)', 'Connect, sync, and manage Plaid institutions', 12, 8, 4, 4),
  entry('accounts_header', 'Accounts header', 'Title and add-account action', 12, 3, 4, 2),
  entry('add_account_form', 'New financial account', 'Manual bank/credit account create form', 12, 10, 4, 5),
  entry('account_cards', 'Account list', 'Grid of bank and credit card accounts', 12, 10, 4, 5),
  entry('empty_accounts', 'Empty accounts', 'No-accounts empty state', 12, 5, 4, 3),
  entry('metric_account_count', 'Account count', 'Total financial accounts', 4, 3),
]

export const DEFAULT_FINANCE_ACCOUNTS_WIDGETS: ModuleWidgetItem[] = [
  item('plaid_feeds', 0, 0, 12, 8, 4, 4),
  item('accounts_header', 0, 8, 12, 3, 4, 2),
  item('account_cards', 0, 11, 12, 10, 4, 5),
]

const accountsSurface = makeSurface(
  FINANCE_ACCOUNTS_WIDGET_CATALOG,
  DEFAULT_FINANCE_ACCOUNTS_WIDGETS
)
export const normalizeFinanceAccountsWidgetLayout = accountsSurface.normalize
export const financeAccountsWidgetLayoutToBase = accountsSurface.toBase

// --- Reconcile ---

export const FINANCE_RECONCILE_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('reconcile_header', 'Reconciliation intro', 'Title and match-register copy', 12, 3, 4, 2),
  entry('start_reconciliation', 'Start new reconciliation', 'Account, statement date, ending balance', 12, 8, 4, 4),
  entry('recon_session_picker', 'Reconciliation sessions', 'Past and in-progress reconciliation chips', 12, 3, 4, 2),
  entry('recon_workspace', 'Active workspace', 'Statement vs cleared vs difference plus clear table', 12, 16, 6, 8),
  entry('empty_need_account', 'Need bank account', 'Gate when no financial accounts exist', 12, 5, 4, 3),
]

export const DEFAULT_FINANCE_RECONCILE_WIDGETS: ModuleWidgetItem[] = [
  item('reconcile_header', 0, 0, 12, 3, 4, 2),
  item('start_reconciliation', 0, 3, 12, 8, 4, 4),
  item('recon_session_picker', 0, 11, 12, 3, 4, 2),
  item('recon_workspace', 0, 14, 12, 16, 6, 8),
]

const reconcileSurface = makeSurface(
  FINANCE_RECONCILE_WIDGET_CATALOG,
  DEFAULT_FINANCE_RECONCILE_WIDGETS
)
export const normalizeFinanceReconcileWidgetLayout = reconcileSurface.normalize
export const financeReconcileWidgetLayoutToBase = reconcileSurface.toBase

// --- Reports ---

export const FINANCE_REPORTS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('reports_header', 'Reports intro', 'Title and description', 12, 3, 4, 2),
  entry('report_date_controls', 'Report period', 'From / To / BS as-of / YTD / Refresh', 12, 4, 4, 3),
  entry('report_viewer', 'Report viewer', 'Bundled P&L, balance sheet, and cash flow tabs', 12, 16, 6, 8),
  entry('pnl_income', 'P&L income', 'Income lines and total', 6, 8, 3, 4),
  entry('pnl_expenses', 'P&L expenses', 'Expense lines and total', 6, 8, 3, 4),
  entry('pnl_net', 'Net income', 'Big net income number', 12, 4, 4, 3),
  entry('bs_assets', 'Balance sheet — assets', 'Asset lines and total', 4, 8, 3, 4),
  entry('bs_liabilities', 'Balance sheet — liabilities', 'Liability lines and total', 4, 8, 3, 4),
  entry('bs_equity', 'Balance sheet — equity', 'Equity lines and total', 4, 8, 3, 4),
  entry('cash_flow_summary', 'Cash flow summary', 'Inflows, outflows, and net change', 12, 5, 4, 3),
]

export const DEFAULT_FINANCE_REPORTS_WIDGETS: ModuleWidgetItem[] = [
  item('reports_header', 0, 0, 12, 3, 4, 2),
  item('report_date_controls', 0, 3, 12, 4, 4, 3),
  item('report_viewer', 0, 7, 12, 16, 6, 8),
]

const reportsSurface = makeSurface(
  FINANCE_REPORTS_WIDGET_CATALOG,
  DEFAULT_FINANCE_REPORTS_WIDGETS
)
export const normalizeFinanceReportsWidgetLayout = reportsSurface.normalize
export const financeReportsWidgetLayoutToBase = reportsSurface.toBase

// --- Tax readiness ---

export const FINANCE_TAX_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('tax_header', 'Tax readiness intro', 'Title and CPA / 1099 / estimates copy', 12, 3, 4, 2),
  entry('tax_disclaimer', 'Tax disclaimer', 'Not tax advice disclaimer card', 12, 3, 4, 2),
  entry('tax_packet_actions', 'Generate tax packet', 'Year selector, build, and CSV/PDF export', 12, 5, 4, 3),
  entry('tax_packet_summary', 'Packet summary', 'Entity, net income, txn count, 1099 vendors', 12, 5, 4, 3),
  entry('vendors_1099', '1099 vendors', 'Add vendor form and vendor list', 12, 10, 4, 5),
  entry('estimated_tax', 'Estimated tax reminders', 'Quarterly illustrative reminders', 12, 8, 4, 4),
]

export const DEFAULT_FINANCE_TAX_WIDGETS: ModuleWidgetItem[] = [
  item('tax_header', 0, 0, 12, 3, 4, 2),
  item('tax_disclaimer', 0, 3, 12, 3, 4, 2),
  item('tax_packet_actions', 0, 6, 12, 5, 4, 3),
  item('tax_packet_summary', 0, 11, 12, 5, 4, 3),
  item('vendors_1099', 0, 16, 12, 10, 4, 5),
  item('estimated_tax', 0, 26, 12, 8, 4, 4),
]

const taxSurface = makeSurface(FINANCE_TAX_WIDGET_CATALOG, DEFAULT_FINANCE_TAX_WIDGETS)
export const normalizeFinanceTaxWidgetLayout = taxSurface.normalize
export const financeTaxWidgetLayoutToBase = taxSurface.toBase

// --- Chart of accounts ---

export const FINANCE_COA_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('coa_header', 'COA intro', 'Title and QuickBooks-compat note', 12, 3, 4, 2),
  entry('coa_ledger', 'Chart of accounts', 'Grouped-by-type account tables', 12, 18, 6, 8),
]

export const DEFAULT_FINANCE_COA_WIDGETS: ModuleWidgetItem[] = [
  item('coa_header', 0, 0, 12, 3, 4, 2),
  item('coa_ledger', 0, 3, 12, 18, 6, 8),
]

const coaSurface = makeSurface(FINANCE_COA_WIDGET_CATALOG, DEFAULT_FINANCE_COA_WIDGETS)
export const normalizeFinanceCoaWidgetLayout = coaSurface.normalize
export const financeCoaWidgetLayoutToBase = coaSurface.toBase

// --- Settings ---

export const FINANCE_SETTINGS_WIDGET_CATALOG: WidgetCatalogEntry[] = [
  entry('entity_settings', 'Entity settings', 'Legal structure, method, industry, FYE, EIN, state', 12, 10, 4, 5),
  entry('setup_actions', 'Setup actions', 'Re-run setup and pointers to Plaid / tax export', 12, 5, 4, 3),
  entry('settings_empty', 'Not configured', 'Empty state with run setup wizard', 12, 6, 4, 3),
]

export const DEFAULT_FINANCE_SETTINGS_WIDGETS: ModuleWidgetItem[] = [
  item('entity_settings', 0, 0, 12, 10, 4, 5),
  item('setup_actions', 0, 10, 12, 5, 4, 3),
]

const settingsSurface = makeSurface(
  FINANCE_SETTINGS_WIDGET_CATALOG,
  DEFAULT_FINANCE_SETTINGS_WIDGETS
)
export const normalizeFinanceSettingsWidgetLayout = settingsSurface.normalize
export const financeSettingsWidgetLayoutToBase = settingsSurface.toBase

// --- Registry ---

export interface FinanceSurfaceConfig {
  id: FinanceTabSurfaceId
  label: string
  catalog: WidgetCatalogEntry[]
  normalize: (raw: unknown) => ModuleWidgetLayout
  toBase: (layout: ModuleWidgetLayout) => ModuleWidgetLayout
}

export const FINANCE_TAB_SURFACE_REGISTRY: Record<
  FinanceTabSurfaceId,
  FinanceSurfaceConfig
> = {
  overview: {
    id: 'overview',
    label: 'Overview',
    catalog: FINANCE_OVERVIEW_WIDGET_CATALOG,
    normalize: normalizeFinanceOverviewWidgetLayout,
    toBase: financeOverviewWidgetLayoutToBase,
  },
  transactions: {
    id: 'transactions',
    label: 'Transactions',
    catalog: FINANCE_TRANSACTIONS_WIDGET_CATALOG,
    normalize: normalizeFinanceTransactionsWidgetLayout,
    toBase: financeTransactionsWidgetLayoutToBase,
  },
  accounts: {
    id: 'accounts',
    label: 'Bank accounts',
    catalog: FINANCE_ACCOUNTS_WIDGET_CATALOG,
    normalize: normalizeFinanceAccountsWidgetLayout,
    toBase: financeAccountsWidgetLayoutToBase,
  },
  reconcile: {
    id: 'reconcile',
    label: 'Reconcile',
    catalog: FINANCE_RECONCILE_WIDGET_CATALOG,
    normalize: normalizeFinanceReconcileWidgetLayout,
    toBase: financeReconcileWidgetLayoutToBase,
  },
  reports: {
    id: 'reports',
    label: 'Reports',
    catalog: FINANCE_REPORTS_WIDGET_CATALOG,
    normalize: normalizeFinanceReportsWidgetLayout,
    toBase: financeReportsWidgetLayoutToBase,
  },
  tax: {
    id: 'tax',
    label: 'Tax readiness',
    catalog: FINANCE_TAX_WIDGET_CATALOG,
    normalize: normalizeFinanceTaxWidgetLayout,
    toBase: financeTaxWidgetLayoutToBase,
  },
  coa: {
    id: 'coa',
    label: 'Chart of accounts',
    catalog: FINANCE_COA_WIDGET_CATALOG,
    normalize: normalizeFinanceCoaWidgetLayout,
    toBase: financeCoaWidgetLayoutToBase,
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    catalog: FINANCE_SETTINGS_WIDGET_CATALOG,
    normalize: normalizeFinanceSettingsWidgetLayout,
    toBase: financeSettingsWidgetLayoutToBase,
  },
}

export function isFinanceTabSurfaceId(value: string): value is FinanceTabSurfaceId {
  return (FINANCE_TAB_SURFACE_IDS as string[]).includes(value)
}

export function getFinanceTabSurfaceConfig(tab: string): FinanceSurfaceConfig {
  if (isFinanceTabSurfaceId(tab)) return FINANCE_TAB_SURFACE_REGISTRY[tab]
  return FINANCE_TAB_SURFACE_REGISTRY.overview
}

export {
  addWidgetToLayout,
  applyGridLayoutChange,
  availableCatalogEntries,
  removeWidgetFromLayout,
}
