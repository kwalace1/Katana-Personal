import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Scale, CheckCircle2 } from 'lucide-react'
import {
  completeReconciliation,
  createReconciliation,
  formatCurrency,
  getReconciliationWorkspace,
  getReconciliations,
  setReconciliationItemCleared,
} from '@/lib/finance-api'
import {
  RECONCILIATION_STATUS_LABELS,
  type FinFinancialAccount,
  type FinReconciliation,
} from '@/lib/finance-types'
import type { FinReconciliationWorkspace } from '@/lib/finance-types'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { FinanceTabLayoutProps } from '@/lib/finance/finance-widget-layout'

interface FinanceReconciliationPanelProps {
  financialAccounts: FinFinancialAccount[]
  onRefresh: () => void
  layout: FinanceTabLayoutProps
}

export function FinanceReconciliationPanel({
  financialAccounts,
  onRefresh,
  layout,
}: FinanceReconciliationPanelProps) {
  const [reconciliations, setReconciliations] = useState<FinReconciliation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<FinReconciliationWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [newAccountId, setNewAccountId] = useState('')
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10))
  const [statementBalance, setStatementBalance] = useState('')
  const [creating, setCreating] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getReconciliations()
      setReconciliations(list)
      const inProgress = list.find((r) => r.status === 'in_progress' || r.status === 'balanced')
      if (inProgress && !activeId) setActiveId(inProgress.id)
    } catch (err) {
      toast.error('Failed to load reconciliations', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [activeId])

  const loadWorkspace = useCallback(async (id: string) => {
    try {
      const ws = await getReconciliationWorkspace(id)
      setWorkspace(ws)
    } catch (err) {
      toast.error('Failed to load reconciliation', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (activeId) void loadWorkspace(activeId)
    else setWorkspace(null)
  }, [activeId, loadWorkspace])

  const handleCreate = async () => {
    if (!newAccountId || !periodEnd || !statementBalance) {
      toast.error('Select account, period end, and statement balance')
      return
    }
    setCreating(true)
    try {
      const recon = await createReconciliation({
        financial_account_id: newAccountId,
        period_end: periodEnd,
        statement_balance: parseFloat(statementBalance),
      })
      toast.success('Reconciliation started')
      setActiveId(recon.id)
      await loadList()
      onRefresh()
    } catch (err) {
      toast.error('Could not start reconciliation', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (txnId: string, cleared: boolean) => {
    if (!activeId) return
    setSaving(true)
    try {
      await setReconciliationItemCleared(activeId, txnId, cleared)
      await loadWorkspace(activeId)
      await loadList()
    } catch (err) {
      toast.error('Update failed', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    if (!activeId) return
    setSaving(true)
    try {
      await completeReconciliation(activeId)
      toast.success('Reconciliation closed — transactions marked reconciled')
      await loadList()
      onRefresh()
    } catch (err) {
      toast.error('Could not complete reconciliation', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const accountName = (id: string) => financialAccounts.find((a) => a.id === id)?.name ?? 'Account'
  const clearedMap = new Map(
    workspace?.items.map((i) => [i.bank_transaction_id, i.is_cleared]) ?? [],
  )

  return (
    <div data-tour="finance-reconcile">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'empty_need_account') {
            if (financialAccounts.length > 0) {
              return (
                <Card className="h-full">
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    Bank accounts are ready for reconciliation.
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card className="h-full">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  Add a bank account before reconciling statements.
                </CardContent>
              </Card>
            )
          }

          if (financialAccounts.length === 0 && widgetId !== 'empty_need_account') {
            return (
              <Card className="h-full">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Add a bank account before reconciling statements.
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'reconcile_header') {
            return (
              <div className="h-full overflow-auto">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Reconciliation
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Match your Katana register to your bank statement ending balance.
                </p>
              </div>
            )
          }

          if (widgetId === 'start_reconciliation') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Start new reconciliation</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Bank account</Label>
                    <Select value={newAccountId} onValueChange={setNewAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
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
                    <Label htmlFor="recon-end">Statement date</Label>
                    <Input
                      id="recon-end"
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recon-bal">Ending balance</Label>
                    <Input
                      id="recon-bal"
                      type="number"
                      step="0.01"
                      value={statementBalance}
                      onChange={(e) => setStatementBalance(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleCreate} disabled={creating} className="sm:col-span-3 w-fit">
                    {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Start reconciliation
                  </Button>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'recon_session_picker') {
            if (loading) {
              return (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )
            }
            if (reconciliations.length === 0) {
              return (
                <Card className="h-full">
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    No reconciliation sessions yet. Start one above.
                  </CardContent>
                </Card>
              )
            }
            return (
              <div className="h-full overflow-auto flex flex-wrap gap-2 content-start">
                {reconciliations.map((r) => (
                  <Button
                    key={r.id}
                    variant={activeId === r.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveId(r.id)}
                  >
                    {accountName(r.financial_account_id)} — {r.period_end}
                    <Badge variant="secondary" className="ml-2">
                      {RECONCILIATION_STATUS_LABELS[r.status]}
                    </Badge>
                  </Button>
                ))}
              </div>
            )
          }

          if (widgetId === 'recon_workspace') {
            if (!workspace) {
              return (
                <Card className="h-full">
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    Select or start a reconciliation to open the workspace.
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
                    <span>
                      {accountName(workspace.financialAccount.id)} — through{' '}
                      {workspace.reconciliation.period_end}
                    </span>
                    <Badge
                      variant={
                        workspace.reconciliation.status === 'balanced' ? 'default' : 'outline'
                      }
                    >
                      {RECONCILIATION_STATUS_LABELS[workspace.reconciliation.status]}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Statement balance</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(Number(workspace.reconciliation.statement_balance))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cleared balance</p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(workspace.registerBalance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Difference</p>
                      <p
                        className={`text-lg font-semibold ${
                          Math.abs(workspace.reconciliation.difference) < 0.01
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(Number(workspace.reconciliation.difference))}
                      </p>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="p-3 w-10" />
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Description</th>
                          <th className="text-right p-3">Amount</th>
                          <th className="text-left p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workspace.transactions.map((txn) => (
                          <tr key={txn.id} className="border-t">
                            <td className="p-3">
                              <Checkbox
                                checked={clearedMap.get(txn.id) ?? false}
                                disabled={saving || workspace.reconciliation.status === 'closed'}
                                onCheckedChange={(v) => void handleToggle(txn.id, v === true)}
                              />
                            </td>
                            <td className="p-3 whitespace-nowrap">{txn.transaction_date}</td>
                            <td className="p-3 max-w-[200px] truncate">{txn.description}</td>
                            <td className="p-3 text-right font-medium">
                              {formatCurrency(Number(txn.amount))}
                            </td>
                            <td className="p-3 text-muted-foreground capitalize">{txn.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {workspace.reconciliation.status !== 'closed' && (
                    <Button
                      onClick={handleComplete}
                      disabled={saving || Math.abs(workspace.reconciliation.difference) >= 0.01}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Complete reconciliation
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />
    </div>
  )
}
