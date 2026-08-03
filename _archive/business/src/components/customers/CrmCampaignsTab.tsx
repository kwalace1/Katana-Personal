import { useState } from 'react'
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
import { Plus, Megaphone } from 'lucide-react'
import type { CrmCampaign, CampaignType } from '@/lib/customer-crm-api'
import * as crmApi from '@/lib/customer-crm-api'
import { formatDateOnly } from '@/lib/due-date-utils'
import { CrmLeadCaptureSettings } from '@/components/customers/CrmLeadCaptureSettings'
import { CsTabHeader } from '@/components/customers/CsModuleUi'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { CustomersTabLayoutProps } from '@/lib/customers/customers-widget-layout'

interface CrmCampaignsTabProps {
  campaigns: CrmCampaign[]
  leadCountByCampaign: Record<string, number>
  onRefresh: () => Promise<void>
  layout: CustomersTabLayoutProps
}

const TYPE_LABELS: Record<CampaignType, string> = {
  email: 'Email',
  social: 'Social',
  event: 'Event',
  ads: 'Paid ads',
  referral: 'Referral',
  other: 'Other',
}

export function CrmCampaignsTab({ campaigns, leadCountByCampaign, onRefresh, layout }: CrmCampaignsTabProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'email' as CampaignType,
    status: 'draft' as CrmCampaign['status'],
    startDate: '',
    endDate: '',
    budget: '',
    description: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    await crmApi.createCampaign({
      name: form.name.trim(),
      type: form.type,
      status: form.status,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      budget: parseFloat(form.budget) || 0,
      description: form.description,
    })
    setSubmitting(false)
    setOpen(false)
    setForm({ name: '', type: 'email', status: 'draft', startDate: '', endDate: '', budget: '', description: '' })
    await onRefresh()
  }

  const toggleStatus = async (campaign: CrmCampaign) => {
    const next = campaign.status === 'active' ? 'paused' : campaign.status === 'draft' ? 'active' : 'active'
    await crmApi.updateCampaign(campaign.id, { status: next })
    await onRefresh()
  }

  return (
    <div className="space-y-6">
      <CsTabHeader
        icon={Megaphone}
        title="Marketing campaigns"
        description="Track campaigns and attribute inbound B2B and B2C leads to their source."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New campaign
              </Button>
            </DialogTrigger>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>New campaign</DialogTitle>
              <DialogDescription>Launch or plan a marketing initiative</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <DialogBody className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as CampaignType })}
                    >
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Budget ($)</Label>
                    <Input type="number" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>End date</Label>
                    <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create campaign'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
          if (widgetId === 'metric_active_campaigns') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Active campaigns</p>
                <p className="text-3xl font-bold tabular-nums mt-1">
                  {campaigns.filter((c) => c.status === 'active').length}
                </p>
              </Card>
            )
          }

          if (widgetId === 'metric_total_budget') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Total budget</p>
                <p className="text-3xl font-bold tabular-nums mt-1">
                  ${campaigns.reduce((s, c) => s + c.budget, 0).toLocaleString()}
                </p>
              </Card>
            )
          }

          if (widgetId === 'metric_attributed_leads') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Attributed leads</p>
                <p className="text-3xl font-bold tabular-nums mt-1">
                  {Object.values(leadCountByCampaign).reduce((s, n) => s + n, 0)}
                </p>
              </Card>
            )
          }

          if (widgetId === 'lead_capture') {
            return (
              <div className="h-full overflow-auto">
                <CrmLeadCaptureSettings />
              </div>
            )
          }

          if (widgetId === 'campaign_grid') {
            return (
              <div className="h-full overflow-auto">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {campaigns.length === 0 ? (
                    <Card className="md:col-span-2 lg:col-span-3">
                      <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        <Megaphone className="h-8 w-8 mx-auto mb-3 opacity-40" />
                        No campaigns yet. Create one to track inbound leads from ads, events, email, or referrals.
                      </CardContent>
                    </Card>
                  ) : (
                    campaigns.map((campaign) => (
                      <Card key={campaign.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base leading-snug">{campaign.name}</CardTitle>
                            <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>{campaign.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{TYPE_LABELS[campaign.type]}</p>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Leads attributed</span>
                            <span className="font-medium text-foreground tabular-nums">
                              {leadCountByCampaign[campaign.id] ?? 0}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Budget</span>
                            <span className="font-medium text-foreground tabular-nums">${campaign.budget.toLocaleString()}</span>
                          </div>
                          {(campaign.start_date || campaign.end_date) && (
                            <p className="text-xs text-muted-foreground">
                              {campaign.start_date ? formatDateOnly(campaign.start_date) : '—'} →{' '}
                              {campaign.end_date ? formatDateOnly(campaign.end_date) : '—'}
                            </p>
                          )}
                          {campaign.description && <p className="text-xs line-clamp-2">{campaign.description}</p>}
                          <Button size="sm" variant="outline" className="w-full" onClick={() => void toggleStatus(campaign)}>
                            {campaign.status === 'active' ? 'Pause' : campaign.status === 'draft' ? 'Activate' : 'Resume'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            )
          }

          return null
        }}
      />
    </div>
  )
}
