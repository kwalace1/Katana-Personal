import { useEffect, useMemo, useState } from 'react'
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
import { Plus, UserPlus, ArrowRight, Target } from 'lucide-react'
import type { CSMUser } from '@/lib/customer-success-api'
import type { CrmCampaign, CrmLead, LeadSource } from '@/lib/customer-crm-api'
import * as crmApi from '@/lib/customer-crm-api'
import { CrmLeadCaptureSettings } from '@/components/customers/CrmLeadCaptureSettings'
import { KycLeadFitBadge, KycFitMeter } from '@/components/customers/KycLeadFitBadge'
import { KycSignalBadges } from '@/components/customers/KycSignalBadges'
import { KycOutreachSelector } from '@/components/customers/KycOutreachSelector'
import { CsTabHeader, CsAccountTypeBadge } from '@/components/customers/CsModuleUi'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { CustomersTabLayoutProps } from '@/lib/customers/customers-widget-layout'
import {
  computeLeadFit,
  computeLeadsFit,
  getIcpProfile,
  updateLeadOutreachStatus,
  type KycLeadOutreachStatus,
  type LeadFitResult,
} from '@/lib/kyc-api'

interface CrmLeadsTabProps {
  leads: CrmLead[]
  campaigns: CrmCampaign[]
  csmUsers: CSMUser[]
  onRefresh: () => Promise<void>
  layout: CustomersTabLayoutProps
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  web: 'Website',
  referral: 'Referral',
  campaign: 'Campaign',
  cold_outreach: 'Cold outreach',
  event: 'Event',
  phone: 'Phone',
  other: 'Other',
}

export function CrmLeadsTab({ leads, campaigns, csmUsers, onRefresh, layout }: CrmLeadsTabProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | CrmLead['status']>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'fit'>('fit')
  const [fitByLeadId, setFitByLeadId] = useState<Map<string, LeadFitResult>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    industry: '',
    state: '',
    accountType: 'business' as 'business' | 'individual',
    source: 'web' as LeadSource,
    campaignId: '',
    assignedTo: '',
    notes: '',
  })

  useEffect(() => {
    let cancelled = false
    void getIcpProfile().then((icp) => {
      if (cancelled) return
      const results = computeLeadsFit(
        leads.map((l) => ({
          id: l.id,
          industry: l.industry,
          state: l.state,
          country: l.country,
          account_type: l.account_type,
          company_name: l.company_name,
          score: l.score,
        })),
        icp,
      )
      setFitByLeadId(new Map(results.map((r) => [r.lead_id, r])))
    })
    return () => {
      cancelled = true
    }
  }, [leads])

  const filtered = useMemo(() => {
    let rows = filter === 'all' ? [...leads] : leads.filter((l) => l.status === filter)
    if (sortBy === 'fit') {
      rows = rows.sort((a, b) => {
        const fa = fitByLeadId.get(a.id)?.fit_percent ?? 0
        const fb = fitByLeadId.get(b.id)?.fit_percent ?? 0
        return fb - fa
      })
    }
    return rows
  }, [leads, filter, sortBy, fitByLeadId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const fit = await computeLeadFit({
      industry: form.industry || null,
      state: form.state || null,
      account_type: form.accountType,
      company_name: form.companyName || null,
    })
    await crmApi.createLead({
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      email: form.email || null,
      phone: form.phone || null,
      company_name: form.accountType === 'business' ? form.companyName || null : null,
      industry: form.industry || null,
      state: form.state || null,
      account_type: form.accountType,
      source: form.source,
      campaign_id: form.campaignId || null,
      status: 'new',
      score: fit.fit_percent,
      notes: form.notes,
      assigned_to: form.assignedTo || null,
      outreach_status: 'new',
    })
    setSubmitting(false)
    setOpen(false)
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      companyName: '',
      industry: '',
      state: '',
      accountType: 'business',
      source: 'web',
      campaignId: '',
      assignedTo: '',
      notes: '',
    })
    await onRefresh()
  }

  const handleConvert = async (lead: CrmLead) => {
    if (!confirm(`Convert "${crmApi.leadDisplayName(lead)}" to a customer and open a deal?`)) return
    await crmApi.convertLeadToCustomer(lead.id, { createDeal: true, dealAmount: 0 })
    await onRefresh()
  }

  const handleLeadOutreach = async (leadId: string, status: string) => {
    await updateLeadOutreachStatus(leadId, status as KycLeadOutreachStatus)
    await onRefresh()
  }

  const statusBadge = (status: CrmLead['status']) => {
    const map: Record<CrmLead['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
      new: 'default',
      contacted: 'secondary',
      qualified: 'outline',
      unqualified: 'destructive',
      converted: 'secondary',
    }
    return <Badge variant={map[status]}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      <CsTabHeader
        icon={Target}
        title="Leads"
        description="Prospects ranked by ICP fit — capture B2B opportunities and B2C consumer inquiries, then convert when qualified."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New lead
              </Button>
            </DialogTrigger>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>New lead</DialogTitle>
              <DialogDescription>Capture a B2B or B2C prospect</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <DialogBody className="space-y-4">
                <div className="space-y-2">
                  <Label>Lead type</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.accountType}
                    onChange={(e) =>
                      setForm({ ...form, accountType: e.target.value as 'business' | 'individual' })
                    }
                  >
                    <option value="business">Business (B2B)</option>
                    <option value="individual">Individual (B2C)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First name</Label>
                    <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last name</Label>
                    <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                {form.accountType === 'business' && (
                  <div className="space-y-2">
                    <Label>Company name</Label>
                    <Input
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Industry (ICP fit)</Label>
                    <Input
                      placeholder="Healthcare, SaaS"
                      value={form.industry}
                      onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State / region</Label>
                    <Input
                      placeholder="CA, NY"
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                    >
                      {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Campaign</Label>
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.campaignId}
                      onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
                    >
                      <option value="">None</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Create lead'}
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
          if (widgetId === 'lead_filters') {
            return (
              <div className="h-full overflow-auto flex flex-wrap items-center gap-2 rounded-lg border p-3">
                {(['all', 'new', 'contacted', 'qualified', 'unqualified', 'converted'] as const).map((s) => (
                  <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)} className="capitalize">
                    {s === 'all' ? 'All' : s}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={sortBy === 'fit' ? 'secondary' : 'ghost'}
                  onClick={() => setSortBy(sortBy === 'fit' ? 'recent' : 'fit')}
                >
                  Sort by ICP fit
                </Button>
              </div>
            )
          }

          if (widgetId === 'lead_capture') {
            return (
              <div className="h-full overflow-auto">
                <CrmLeadCaptureSettings />
              </div>
            )
          }

          if (widgetId === 'metric_lead_count') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Total leads</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{leads.length}</p>
              </Card>
            )
          }

          if (widgetId === 'metric_qualified') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Qualified</p>
                <p className="text-3xl font-bold tabular-nums mt-1">
                  {leads.filter((l) => l.status === 'qualified').length}
                </p>
              </Card>
            )
          }

          if (widgetId === 'metric_converted') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Converted</p>
                <p className="text-3xl font-bold tabular-nums mt-1">
                  {leads.filter((l) => l.status === 'converted').length}
                </p>
              </Card>
            )
          }

          if (widgetId === 'lead_list') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      No leads yet. Add inbound form submissions, referrals, or cold prospects here.
                    </p>
                  ) : (
                    filtered.map((lead) => {
                      const fit = fitByLeadId.get(lead.id)
                      return (
                        <div
                          key={lead.id}
                          className="flex flex-col gap-3 rounded-xl border p-4 transition-all hover:shadow-sm hover:border-primary/20 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="min-w-0 space-y-2.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{crmApi.leadDisplayName(lead)}</p>
                              {statusBadge(lead.status)}
                              <CsAccountTypeBadge accountType={lead.account_type} />
                              {fit && <KycLeadFitBadge fitPercent={fit.fit_percent} />}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {SOURCE_LABELS[lead.source]}
                              {lead.campaign?.name ? ` · ${lead.campaign.name}` : ''}
                              {lead.email ? ` · ${lead.email}` : ''}
                              {lead.industry ? ` · ${lead.industry}` : ''}
                            </p>
                            {fit && fit.top_signals.length > 0 && (
                              <KycSignalBadges keys={fit.top_signals} maxVisible={3} />
                            )}
                            {fit && (
                              <div className="max-w-xs">
                                <KycFitMeter fitPercent={fit.fit_percent} size="sm" />
                              </div>
                            )}
                            {lead.status !== 'converted' && (
                              <div className="max-w-[220px]">
                                <KycOutreachSelector
                                  mode="lead"
                                  value={lead.outreach_status ?? 'new'}
                                  onChange={(v) => void handleLeadOutreach(lead.id, v)}
                                  compact
                                />
                              </div>
                            )}
                          </div>
                          {lead.status !== 'converted' && (
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => void handleConvert(lead)}>
                              <UserPlus className="h-3 w-3 mr-1" />
                              Convert
                              <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      )
                    })
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
