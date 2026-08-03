/**
 * Chart of accounts seed templates — QBO-shaped account types for future sync.
 */

import type { CoaAccountType } from './finance-types'

export interface CoaTemplateAccount {
  account_number: string
  name: string
  account_type: CoaAccountType
  is_system?: boolean
}

const BASE_ACCOUNTS: CoaTemplateAccount[] = [
  { account_number: '1000', name: 'Business Checking', account_type: 'bank', is_system: true },
  { account_number: '1010', name: 'Business Savings', account_type: 'bank' },
  { account_number: '1100', name: 'Accounts Receivable', account_type: 'accounts_receivable', is_system: true },
  { account_number: '1200', name: 'Undeposited Funds', account_type: 'other_current_asset' },
  { account_number: '1500', name: 'Equipment', account_type: 'fixed_asset' },
  { account_number: '2000', name: 'Accounts Payable', account_type: 'accounts_payable', is_system: true },
  { account_number: '2100', name: 'Business Credit Card', account_type: 'credit_card', is_system: true },
  { account_number: '3000', name: 'Owner Equity', account_type: 'equity', is_system: true },
  { account_number: '3100', name: 'Owner Draws', account_type: 'equity' },
  { account_number: '4000', name: 'Service Revenue', account_type: 'income', is_system: true },
  { account_number: '4100', name: 'Product Sales', account_type: 'income' },
  { account_number: '4900', name: 'Other Income', account_type: 'other_income' },
  { account_number: '5000', name: 'Cost of Goods Sold', account_type: 'cost_of_goods_sold' },
  { account_number: '6000', name: 'Advertising & Marketing', account_type: 'expense' },
  { account_number: '6100', name: 'Bank Fees & Charges', account_type: 'expense' },
  { account_number: '6200', name: 'Contract Labor', account_type: 'expense' },
  { account_number: '6300', name: 'Insurance', account_type: 'expense' },
  { account_number: '6400', name: 'Meals & Entertainment', account_type: 'expense' },
  { account_number: '6500', name: 'Office Supplies', account_type: 'expense' },
  { account_number: '6600', name: 'Payroll Expense', account_type: 'expense' },
  { account_number: '6700', name: 'Rent & Lease', account_type: 'expense' },
  { account_number: '6800', name: 'Software & Subscriptions', account_type: 'expense' },
  { account_number: '6900', name: 'Travel', account_type: 'expense' },
  { account_number: '6999', name: 'Uncategorized Expense', account_type: 'expense', is_system: true },
]

const ENTITY_EQUITY_ACCOUNTS: Record<string, CoaTemplateAccount[]> = {
  s_corp: [
    { account_number: '3010', name: 'Shareholder Distributions', account_type: 'equity' },
    { account_number: '3020', name: 'Retained Earnings', account_type: 'equity', is_system: true },
  ],
  c_corp: [
    { account_number: '3010', name: 'Retained Earnings', account_type: 'equity', is_system: true },
    { account_number: '3020', name: 'Dividends', account_type: 'equity' },
  ],
  partnership: [
    { account_number: '3010', name: 'Partner Capital', account_type: 'equity', is_system: true },
  ],
}

const INDUSTRY_EXTRA: Record<string, CoaTemplateAccount[]> = {
  retail: [
    { account_number: '4050', name: 'Retail Sales', account_type: 'income' },
    { account_number: '5100', name: 'Inventory Purchases', account_type: 'cost_of_goods_sold' },
  ],
  construction: [
    { account_number: '4050', name: 'Contract Revenue', account_type: 'income' },
    { account_number: '5100', name: 'Job Materials', account_type: 'cost_of_goods_sold' },
    { account_number: '5110', name: 'Subcontractor Costs', account_type: 'cost_of_goods_sold' },
  ],
  saas: [
    { account_number: '4050', name: 'Subscription Revenue', account_type: 'income' },
    { account_number: '6850', name: 'Hosting & Infrastructure', account_type: 'expense' },
  ],
}

export function getCoaTemplateAccounts(
  industryTemplate: string,
  entityType: string,
): CoaTemplateAccount[] {
  const accounts = [...BASE_ACCOUNTS]

  const entityKey =
    entityType === 's_corp' || entityType === 'llc_s_corp'
      ? 's_corp'
      : entityType === 'c_corp'
        ? 'c_corp'
        : entityType === 'partnership' || entityType === 'llc_partnership'
          ? 'partnership'
          : null

  if (entityKey && ENTITY_EQUITY_ACCOUNTS[entityKey]) {
    accounts.push(...ENTITY_EQUITY_ACCOUNTS[entityKey])
  }

  const extras = INDUSTRY_EXTRA[industryTemplate]
  if (extras) accounts.push(...extras)

  const seen = new Set<string>()
  return accounts.filter((a) => {
    if (seen.has(a.account_number)) return false
    seen.add(a.account_number)
    return true
  })
}

/** Default COA account names for linking new financial accounts */
export function defaultBankCoaName(accountKind: string): string {
  if (accountKind === 'credit_card') return 'Business Credit Card'
  if (accountKind === 'savings') return 'Business Savings'
  return 'Business Checking'
}
