/**
 * Cross-module match suggestions for bank transactions.
 */

import { getAllInvoices } from './customer-crm-api'
import { getPurchaseOrders } from './inventory-api'
import type { FinBankTransaction } from './finance-types'

export type FinanceLinkSourceType = 'invoice' | 'purchase_order'

export interface FinanceMatchSuggestion {
  transaction_id: string
  source_type: FinanceLinkSourceType
  source_id: string
  label: string
  amount: number
  confidence: 'high' | 'medium'
  reason: string
}

const AMOUNT_TOLERANCE = 0.02

function amountsMatch(a: number, b: number): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) <= AMOUNT_TOLERANCE
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime())
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export async function getTransactionMatchSuggestions(
  transactions: FinBankTransaction[],
): Promise<FinanceMatchSuggestion[]> {
  const uncategorized = transactions.filter(
    (t) => t.status === 'uncategorized' && !t.linked_source_id,
  )
  if (uncategorized.length === 0) return []

  const [invoices, purchaseOrders] = await Promise.all([
    getAllInvoices().catch(() => []),
    getPurchaseOrders().catch(() => []),
  ])

  const suggestions: FinanceMatchSuggestion[] = []

  for (const txn of uncategorized) {
    const amount = Number(txn.amount)
    const isInflow = amount > 0

    if (isInflow) {
      for (const inv of invoices) {
        if (inv.status === 'void') continue
        const invTotal = Number(inv.total)
        if (!amountsMatch(amount, invTotal)) continue
        const refDate = inv.paid_date ?? inv.due_date ?? inv.created_at.slice(0, 10)
        const dayDiff = daysBetween(txn.transaction_date, refDate)
        if (dayDiff > 45) continue

        suggestions.push({
          transaction_id: txn.id,
          source_type: 'invoice',
          source_id: inv.id,
          label: `Invoice ${inv.invoice_number}`,
          amount: invTotal,
          confidence: inv.status === 'paid' && dayDiff <= 7 ? 'high' : 'medium',
          reason:
            inv.status === 'paid'
              ? `Paid invoice ${inv.invoice_number} matches deposit amount`
              : `Invoice ${inv.invoice_number} total matches deposit (status: ${inv.status})`,
        })
        break
      }
    } else {
      for (const po of purchaseOrders) {
        if (po.status === 'cancelled') continue
        const poTotal = Number(po.total)
        if (!amountsMatch(amount, -poTotal)) continue
        const refDate = po.received_date ?? po.expected_date ?? po.created_date
        if (!refDate) continue
        const dayDiff = daysBetween(txn.transaction_date, refDate)
        if (dayDiff > 60) continue

        suggestions.push({
          transaction_id: txn.id,
          source_type: 'purchase_order',
          source_id: po.id,
          label: `PO ${po.po_number}`,
          amount: poTotal,
          confidence: po.status === 'received' && dayDiff <= 14 ? 'high' : 'medium',
          reason: `Purchase order ${po.po_number} (${po.supplier_name}) matches payment amount`,
        })
        break
      }
    }
  }

  return suggestions
}
