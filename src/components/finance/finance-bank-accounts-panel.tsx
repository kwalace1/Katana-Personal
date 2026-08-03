import { useState } from 'react'
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
import { Loader2, Plus, Landmark } from 'lucide-react'
import { createFinancialAccount } from '@/lib/finance-api'
import { FinancePlaidPanel } from '@/components/finance/finance-plaid-panel'
import {
  FINANCIAL_ACCOUNT_KIND_LABELS,
  type FinFinancialAccount,
  type FinancialAccountKind,
} from '@/lib/finance-types'
import { formatCurrency } from '@/lib/finance-api'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { FinanceTabLayoutProps } from '@/lib/finance/finance-widget-layout'

interface FinanceBankAccountsPanelProps {
  accounts: FinFinancialAccount[]
  onRefresh: () => void
  layout: FinanceTabLayoutProps
}

export function FinanceBankAccountsPanel({
  accounts,
  onRefresh,
  layout,
}: FinanceBankAccountsPanelProps) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [mask, setMask] = useState('')
  const [kind, setKind] = useState<FinancialAccountKind>('checking')
  const [openingBalance, setOpeningBalance] = useState('0')

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Account name is required')
      return
    }
    setSaving(true)
    try {
      await createFinancialAccount({
        name: name.trim(),
        institution: institution.trim() || undefined,
        mask: mask.trim() || undefined,
        account_kind: kind,
        opening_balance: parseFloat(openingBalance) || 0,
        opening_balance_date: new Date().toISOString().slice(0, 10),
      })
      toast.success('Bank account added')
      setName('')
      setInstitution('')
      setMask('')
      setOpeningBalance('0')
      setShowForm(false)
      onRefresh()
    } catch (err) {
      toast.error('Could not add account', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const hasAddFormWidget = layout.widgets.some((w) => w.i === 'add_account_form')
  const showInlineForm = showForm && !hasAddFormWidget

  const addForm = (
    <Card className="h-full overflow-auto">
      <CardHeader>
        <CardTitle className="text-base">New financial account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fa-name">Account name</Label>
            <Input
              id="fa-name"
              placeholder="Business Checking"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fa-institution">Institution</Label>
            <Input
              id="fa-institution"
              placeholder="Chase, Wells Fargo, etc."
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Account type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as FinancialAccountKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(FINANCIAL_ACCOUNT_KIND_LABELS) as [FinancialAccountKind, string][]
                ).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fa-mask">Last 4 digits</Label>
            <Input
              id="fa-mask"
              placeholder="1234"
              maxLength={4}
              value={mask}
              onChange={(e) => setMask(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fa-balance">Opening balance</Label>
            <Input
              id="fa-balance"
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save account
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
    <div data-tour="finance-bank-accounts">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'plaid_feeds') {
            return (
              <div className="h-full overflow-auto">
                <FinancePlaidPanel onConnected={onRefresh} />
              </div>
            )
          }

          if (widgetId === 'accounts_header') {
            return (
              <div className="h-full overflow-auto space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-medium">Bank & credit card accounts</h2>
                    <p className="text-sm text-muted-foreground">
                      Link your real-world accounts manually or connect via Plaid for automatic sync.
                    </p>
                  </div>
                  {!hasAddFormWidget && (
                    <Button onClick={() => setShowForm((v) => !v)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add account
                    </Button>
                  )}
                </div>
                {showInlineForm ? addForm : null}
              </div>
            )
          }

          if (widgetId === 'add_account_form') {
            return addForm
          }

          if (widgetId === 'metric_account_count') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Accounts</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{accounts.length}</p>
              </Card>
            )
          }

          if (widgetId === 'empty_accounts') {
            if (accounts.length > 0) {
              return (
                <Card className="h-full">
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    {accounts.length} account{accounts.length === 1 ? '' : 's'} configured.
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card className="h-full">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Landmark className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No bank accounts yet. Add one to start tracking transactions.</p>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'account_cards') {
            if (accounts.length === 0) {
              return (
                <Card className="h-full">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Landmark className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>No bank accounts yet. Add one to start tracking transactions.</p>
                  </CardContent>
                </Card>
              )
            }
            return (
              <div className="h-full overflow-auto grid gap-3 sm:grid-cols-2 content-start">
                {accounts.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{a.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {a.institution ?? 'No institution'}
                            {a.mask ? ` •••• ${a.mask}` : ''}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {FINANCIAL_ACCOUNT_KIND_LABELS[a.account_kind]}
                        </Badge>
                      </div>
                      <p className="text-lg font-semibold mt-3">
                        Opening: {formatCurrency(Number(a.opening_balance))}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          }

          return null
        }}
      />
    </div>
  )
}
