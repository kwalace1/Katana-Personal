import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, DollarSign, Kanban } from 'lucide-react'
import type { Client, CSMUser } from '@/lib/customer-success-api'
import type { CrmDeal, PipelineStage } from '@/lib/customer-crm-api'
import * as crmApi from '@/lib/customer-crm-api'
import { formatDateOnly } from '@/lib/due-date-utils'
import { CsTabHeader, CsAccountTypeBadge } from '@/components/customers/CsModuleUi'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { CustomersTabLayoutProps } from '@/lib/customers/customers-widget-layout'

interface CrmPipelineTabProps {
  deals: CrmDeal[]
  stages: PipelineStage[]
  clients: Client[]
  csmUsers: CSMUser[]
  onRefresh: () => Promise<void>
  layout: CustomersTabLayoutProps
}

export function CrmPipelineTab({ deals, stages, clients, csmUsers, onRefresh, layout }: CrmPipelineTabProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    clientId: '',
    stageId: '',
    amount: '',
    expectedCloseDate: '',
    assignedTo: '',
    notes: '',
  })

  const openStages = useMemo(() => stages.filter((s) => !s.is_won && !s.is_lost), [stages])
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? '—'

  const dealsByStage = useMemo(() => {
    const map = new Map<string, CrmDeal[]>()
    for (const stage of stages) map.set(stage.id, [])
    for (const deal of deals.filter((d) => d.status === 'open')) {
      const key = deal.stage_id ?? openStages[0]?.id ?? ''
      if (key) map.get(key)?.push(deal)
    }
    return map
  }, [deals, stages, openStages])

  const pipelineValue = deals.filter((d) => d.status === 'open').reduce((s, d) => s + d.amount, 0)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    const stage = stages.find((s) => s.id === form.stageId) ?? openStages[0]
    await crmApi.createDeal({
      title: form.title.trim(),
      client_id: form.clientId || null,
      contact_id: null,
      lead_id: null,
      stage_id: stage?.id ?? null,
      amount: parseFloat(form.amount) || 0,
      currency: 'USD',
      probability: stage?.probability_default ?? 10,
      expected_close_date: form.expectedCloseDate || null,
      status: 'open',
      lost_reason: null,
      assigned_to: form.assignedTo || null,
      notes: form.notes,
    })
    setSubmitting(false)
    setOpen(false)
    setForm({ title: '', clientId: '', stageId: '', amount: '', expectedCloseDate: '', assignedTo: '', notes: '' })
    await onRefresh()
  }

  const moveDeal = async (deal: CrmDeal, stageId: string) => {
    const stage = stages.find((s) => s.id === stageId)
    if (!stage) return
    const updates: Partial<CrmDeal> = {
      stage_id: stageId,
      probability: stage.probability_default,
    }
    if (stage.is_won) updates.status = 'won'
    if (stage.is_lost) updates.status = 'lost'
    await crmApi.updateDeal(deal.id, updates)
    await onRefresh()
  }

  return (
    <div className="space-y-6">
      <CsTabHeader
        icon={Kanban}
        title="Sales pipeline"
        description="Track opportunities from first touch to close — B2B deals and B2C purchases in one board."
        actions={
          <>
            <Badge variant="outline" className="gap-1 tabular-nums">
              <DollarSign className="h-3 w-3" />
              ${(pipelineValue / 1000).toFixed(0)}K open
            </Badge>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New deal
                </Button>
              </DialogTrigger>
            <DialogContent size="md">
              <DialogHeader>
                <DialogTitle>New deal</DialogTitle>
                <DialogDescription>Add an opportunity to the pipeline</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <DialogBody className="space-y-4">
                  <div className="space-y-2">
                    <Label>Deal title *</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Enterprise renewal, Service package…"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Customer</Label>
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={form.clientId}
                        onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                      >
                        <option value="">Unlinked</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Stage</Label>
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        value={form.stageId}
                        onChange={(e) => setForm({ ...form, stageId: e.target.value })}
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected close</Label>
                      <Input
                        type="date"
                        value={form.expectedCloseDate}
                        onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.assignedTo}
                      onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {csmUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                  </div>
                </DialogBody>
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Creating…' : 'Create deal'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </>
        }
      />

      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'pipeline_value') {
            return (
              <Card className="h-full flex flex-col justify-center">
                <CardContent className="py-4 px-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Open pipeline value</p>
                    <p className="text-2xl font-bold tabular-nums">${(pipelineValue / 1000).toFixed(0)}K</p>
                  </div>
                  <Badge variant="outline" className="gap-1 tabular-nums">
                    {deals.filter((d) => d.status === 'open').length} open deals
                  </Badge>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'deal_board') {
            return (
              <div className="h-full overflow-auto">
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {stages.map((stage) => {
                    const stageDeals = dealsByStage.get(stage.id) ?? []
                    const stageTotal = stageDeals.reduce((s, d) => s + d.amount, 0)
                    return (
                      <div key={stage.id} className="min-w-[260px] flex-1 shrink-0">
                        <Card>
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
                              <Badge variant="secondary" className="tabular-nums text-xs">
                                {stageDeals.length}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">${(stageTotal / 1000).toFixed(0)}K</p>
                          </CardHeader>
                          <CardContent className="space-y-2 px-3 pb-3">
                            {stageDeals.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">No deals</p>
                            ) : (
                              stageDeals.map((deal) => (
                                <div key={deal.id} className="rounded-lg border bg-card p-3 space-y-2">
                                  <p className="text-sm font-medium leading-snug">{deal.title}</p>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <p className="text-sm font-semibold tracking-tight text-foreground truncate">
                                      {clientName(deal.client_id)}
                                    </p>
                                    {deal.client_id && (
                                      <CsAccountTypeBadge accountType={clients.find((c) => c.id === deal.client_id)?.account_type} />
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold tabular-nums">${deal.amount.toLocaleString()}</span>
                                    {deal.expected_close_date && (
                                      <span className="text-muted-foreground">{formatDateOnly(deal.expected_close_date)}</span>
                                    )}
                                  </div>
                                  {!stage.is_won && !stage.is_lost && (
                                    <select
                                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                                      value={deal.stage_id ?? ''}
                                      onChange={(e) => void moveDeal(deal, e.target.value)}
                                    >
                                      {stages.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          Move to {s.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              ))
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }

          if (widgetId === 'closed_deals') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Closed deals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {deals.filter((d) => d.status !== 'open').length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No closed deals yet</p>
                  ) : (
                    deals
                      .filter((d) => d.status !== 'open')
                      .slice(0, 10)
                      .map((deal) => (
                        <div key={deal.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                          <span>{deal.title}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={deal.status === 'won' ? 'default' : 'destructive'}>{deal.status}</Badge>
                            <span className="tabular-nums font-medium">${deal.amount.toLocaleString()}</span>
                          </div>
                        </div>
                      ))
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
