import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Link2, Plus, Sparkles } from 'lucide-react'
import {
  categorizeBankTransaction,
  createBankTransaction,
  formatCurrency,
  linkBankTransactionToSource,
} from '@/lib/finance-api'
import { getTransactionMatchSuggestions, type FinanceMatchSuggestion } from '@/lib/finance-match-suggestions'
import { FinanceStatementImport } from '@/components/finance/finance-statement-import'
import {
  BANK_TRANSACTION_STATUS_LABELS,
  type FinAccount,
  type FinBankTransaction,
  type FinFinancialAccount,
} from '@/lib/finance-types'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { FinanceTabLayoutProps } from '@/lib/finance/finance-widget-layout'

interface FinanceTransactionsPanelProps {
  transactions: FinBankTransaction[]
  financialAccounts: FinFinancialAccount[]
  expenseAccounts: FinAccount[]
  onRefresh: () => void
  layout: FinanceTabLayoutProps
}

function defaultCategoryForMatch(
  accounts: FinAccount[],
  sourceType: FinanceMatchSuggestion['source_type'],
): string | null {
  if (sourceType === 'invoice') {
    return (
      accounts.find((a) => a.account_type === 'income')?.id ??
      accounts.find((a) => a.account_type === 'other_income')?.id ??
      null
    )
  }
  return (
    accounts.find((a) => a.account_type === 'cost_of_goods_sold')?.id ??
    accounts.find((a) => a.account_type === 'expense')?.id ??
    null
  )
}

export function FinanceTransactionsPanel({
  transactions,
  financialAccounts,
  expenseAccounts,
  onRefresh,
  layout,
}: FinanceTransactionsPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categorizingId, setCategorizingId] = useState<string | null>(null)
  const [categoryByTxn, setCategoryByTxn] = useState<Record<string, string>>({})
  const [suggestions, setSuggestions] = useState<FinanceMatchSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  const [financialAccountId, setFinancialAccountId] = useState('')
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')

  const accountNameById = Object.fromEntries(financialAccounts.map((a) => [a.id, a.name]))
  const categoryNameById = Object.fromEntries(expenseAccounts.map((a) => [a.id, a.name]))

  const suggestionByTxnId = useMemo(
    () => Object.fromEntries(suggestions.map((s) => [s.transaction_id, s])),
    [suggestions],
  )

  const uncategorizedCount = useMemo(
    () => transactions.filter((t) => t.status === 'uncategorized').length,
    [transactions],
  )

  useEffect(() => {
    let cancelled = false
    setLoadingSuggestions(true)
    getTransactionMatchSuggestions(transactions)
      .then((data) => {
        if (!cancelled) setSuggestions(data)
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setLoadingSuggestions(false)
      })
    return () => {
      cancelled = true
    }
  }, [transactions])

  const handleCreate = async () => {
    if (!financialAccountId || !description.trim() || !amount) {
      toast.error('Fill in account, description, and amount')
      return
    }
    setSaving(true)
    try {
      await createBankTransaction({
        financial_account_id: financialAccountId,
        transaction_date: transactionDate,
        description: description.trim(),
        amount: parseFloat(amount),
      })
      toast.success('Transaction added')
      setDescription('')
      setAmount('')
      setShowForm(false)
      onRefresh()
    } catch (err) {
      toast.error('Could not add transaction', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCategorize = async (txnId: string) => {
    const categoryId = categoryByTxn[txnId]
    if (!categoryId) {
      toast.error('Select a category first')
      return
    }
    setCategorizingId(txnId)
    try {
      await categorizeBankTransaction(txnId, categoryId)
      toast.success('Transaction categorized')
      onRefresh()
    } catch (err) {
      toast.error('Could not categorize', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setCategorizingId(null)
    }
  }

  const handleApplyMatch = async (suggestion: FinanceMatchSuggestion) => {
    const categoryId = defaultCategoryForMatch(expenseAccounts, suggestion.source_type)
    if (!categoryId) {
      toast.error('No matching chart of accounts category found')
      return
    }
    setCategorizingId(suggestion.transaction_id)
    try {
      await linkBankTransactionToSource(
        suggestion.transaction_id,
        suggestion.source_type,
        suggestion.source_id,
        categoryId,
      )
      toast.success(`Linked to ${suggestion.label}`)
      onRefresh()
    } catch (err) {
      toast.error('Could not apply match', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setCategorizingId(null)
    }
  }

  const categorizableAccounts = expenseAccounts.filter((a) =>
    ['expense', 'income', 'cost_of_goods_sold', 'other_income', 'other_expense'].includes(
      a.account_type,
    ),
  )

  const hasAddFormWidget = layout.widgets.some((w) => w.i === 'add_transaction_form')
  const showInlineForm = showForm && !hasAddFormWidget

  const addForm = (
    <Card className="h-full overflow-auto">
      <CardContent className="pt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Bank account</Label>
            <Select value={financialAccountId} onValueChange={setFinancialAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {financialAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="txn-date">Date</Label>
            <Input
              id="txn-date"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="txn-desc">Description</Label>
            <Input
              id="txn-desc"
              placeholder="Office Depot, Client payment, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="txn-amount">Amount</Label>
            <Input
              id="txn-amount"
              type="number"
              step="0.01"
              placeholder="-50.00 for expense, 1000 for deposit"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save transaction
          </Button>
          {!hasAddFormWidget && (
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div data-tour="finance-transactions">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'statement_import') {
            return (
              <div className="h-full overflow-auto">
                <FinanceStatementImport
                  financialAccounts={financialAccounts}
                  onImported={onRefresh}
                />
              </div>
            )
          }

          if (widgetId === 'transactions_header') {
            return (
              <div className="h-full overflow-auto space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-medium">Transactions</h2>
                    <p className="text-sm text-muted-foreground">
                      Categorize activity or accept Katana cross-module match suggestions.
                    </p>
                  </div>
                  {!hasAddFormWidget && (
                    <Button
                      onClick={() => setShowForm((v) => !v)}
                      disabled={financialAccounts.length === 0}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add transaction
                    </Button>
                  )}
                </div>
                {showInlineForm && financialAccounts.length > 0 ? addForm : null}
              </div>
            )
          }

          if (widgetId === 'add_transaction_form') {
            if (financialAccounts.length === 0) {
              return (
                <Card className="h-full">
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    Add a bank account first before recording transactions.
                  </CardContent>
                </Card>
              )
            }
            return addForm
          }

          if (widgetId === 'match_suggestions') {
            if (suggestions.length === 0) {
              return (
                <Card className="h-full">
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    {loadingSuggestions ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Looking for Katana matches…
                      </span>
                    ) : (
                      'No cross-module match suggestions right now.'
                    )}
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card className="h-full overflow-auto border-primary/20">
                <CardContent className="pt-6 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Katana match suggestions
                    {loadingSuggestions && <Loader2 className="w-3 h-3 animate-spin" />}
                  </p>
                  {suggestions.map((s) => (
                    <div
                      key={`${s.transaction_id}-${s.source_id}`}
                      className="flex flex-wrap items-center justify-between gap-3 text-sm border rounded-lg p-3"
                    >
                      <div>
                        <p className="font-medium">{s.label}</p>
                        <p className="text-muted-foreground text-xs">{s.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={s.confidence === 'high' ? 'default' : 'secondary'}>
                          {s.confidence}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={categorizingId === s.transaction_id}
                          onClick={() => void handleApplyMatch(s)}
                        >
                          {categorizingId === s.transaction_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Link2 className="w-3 h-3 mr-1" />
                              Link & categorize
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'empty_no_accounts') {
            if (financialAccounts.length > 0) {
              return (
                <Card className="h-full">
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    Bank accounts are connected.
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card className="h-full">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Add a bank account first before recording transactions.
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'metric_uncategorized') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Uncategorized</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{uncategorizedCount}</p>
              </Card>
            )
          }

          if (widgetId === 'metric_txn_count') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{transactions.length}</p>
              </Card>
            )
          }

          if (widgetId === 'transaction_list') {
            if (transactions.length === 0) {
              return (
                <Card className="h-full">
                  <CardContent className="py-12 text-center text-muted-foreground text-sm">
                    No transactions yet. Import a statement or add a transaction manually.
                  </CardContent>
                </Card>
              )
            }
            return (
              <div className="h-full border rounded-lg overflow-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Account</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Category / Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn) => {
                      const match = suggestionByTxnId[txn.id]
                      return (
                        <tr key={txn.id} className="border-t">
                          <td className="p-3 whitespace-nowrap">{txn.transaction_date}</td>
                          <td className="p-3 text-muted-foreground">
                            {accountNameById[txn.financial_account_id] ?? '—'}
                          </td>
                          <td className="p-3 max-w-[200px] truncate">{txn.description}</td>
                          <td
                            className={`p-3 text-right font-medium whitespace-nowrap ${
                              Number(txn.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(Number(txn.amount))}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={txn.status === 'uncategorized' ? 'destructive' : 'secondary'}
                            >
                              {BANK_TRANSACTION_STATUS_LABELS[txn.status]}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {txn.linked_source_type && (
                              <Badge variant="outline" className="mb-1 mr-1">
                                {txn.linked_source_type === 'invoice'
                                  ? 'CRM invoice'
                                  : 'Inventory PO'}
                              </Badge>
                            )}
                            {txn.status === 'uncategorized' ? (
                              <div className="flex flex-col gap-2 min-w-[200px]">
                                {match && (
                                  <p className="text-xs text-primary">{match.label} suggested</p>
                                )}
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={categoryByTxn[txn.id] ?? ''}
                                    onValueChange={(v) =>
                                      setCategoryByTxn((prev) => ({ ...prev, [txn.id]: v }))
                                    }
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {categorizableAccounts.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                          {a.account_number} — {a.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={categorizingId === txn.id}
                                    onClick={() => handleCategorize(txn.id)}
                                  >
                                    {categorizingId === txn.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      'Apply'
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                {txn.category_account_id
                                  ? categoryNameById[txn.category_account_id] ?? 'Categorized'
                                  : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          }

          return null
        }}
      />
    </div>
  )
}
