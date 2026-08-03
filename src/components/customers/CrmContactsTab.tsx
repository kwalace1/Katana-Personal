import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Mail, Phone, Building2, User, Contact } from 'lucide-react'
import type { Client } from '@/lib/customer-success-api'
import type { CrmContact } from '@/lib/customer-crm-api'
import * as crmApi from '@/lib/customer-crm-api'
import { CsTabHeader, CsAccountTypeBadge } from '@/components/customers/CsModuleUi'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { CustomersTabLayoutProps } from '@/lib/customers/customers-widget-layout'

interface CrmContactsTabProps {
  contacts: CrmContact[]
  clients: Client[]
  onRefresh: () => Promise<void>
  layout: CustomersTabLayoutProps
}

export function CrmContactsTab({ contacts, clients, onRefresh, layout }: CrmContactsTabProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterClient, setFilterClient] = useState('all')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    clientId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    isPrimary: false,
    isDecisionMaker: false,
  })

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Unknown'
  const clientType = (id: string) => clients.find((c) => c.id === id)?.account_type ?? 'business'

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (filterClient !== 'all' && c.client_id !== filterClient) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const name = crmApi.contactDisplayName(c).toLowerCase()
      return (
        name.includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.includes(q) ?? false) ||
        clientName(c.client_id).toLowerCase().includes(q)
      )
    })
  }, [contacts, search, filterClient, clients])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clientId || !form.firstName.trim()) return
    setSubmitting(true)
    await crmApi.createContact({
      client_id: form.clientId,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      email: form.email || null,
      phone: form.phone || null,
      job_title: form.jobTitle || null,
      is_primary: form.isPrimary,
      is_decision_maker: form.isDecisionMaker,
      notes: null,
    })
    setSubmitting(false)
    setOpen(false)
    setForm({
      clientId: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
      isPrimary: false,
      isDecisionMaker: false,
    })
    await onRefresh()
  }

  return (
    <div className="space-y-6">
      <CsTabHeader
        icon={Contact}
        title="Contacts"
        description="People at business accounts, or linked contacts for consumer households — works for both B2B and B2C."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add contact
              </Button>
            </DialogTrigger>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>Add contact</DialogTitle>
              <DialogDescription>Link a person to a customer account</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <DialogBody className="space-y-4">
                <div className="space-y-2">
                  <Label>Customer account *</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                    required
                  >
                    <option value="">Select account…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.account_type === 'individual' ? 'B2C' : 'B2B'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First name *</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last name</Label>
                    <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
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
                <div className="space-y-2">
                  <Label>Job title</Label>
                  <Input
                    value={form.jobTitle}
                    onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                    placeholder="Owner, VP Sales…"
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isPrimary}
                      onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                    />
                    Primary contact
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isDecisionMaker}
                      onChange={(e) => setForm({ ...form, isDecisionMaker: e.target.checked })}
                    />
                    Decision maker
                  </label>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Add contact'}
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
          if (widgetId === 'contact_filters') {
            return (
              <div className="h-full overflow-auto flex flex-wrap gap-3 rounded-lg border p-3">
                <Input
                  placeholder="Search contacts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs"
                />
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                >
                  <option value="all">All accounts</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          }

          if (widgetId === 'metric_contact_count') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Total contacts</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{contacts.length}</p>
              </Card>
            )
          }

          if (widgetId === 'contact_list') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">{filtered.length} contacts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No contacts yet. Add people to your B2B accounts or link family members on B2C accounts.
                    </p>
                  ) : (
                    filtered.map((contact) => (
                      <div key={contact.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4 hover:border-primary/20 transition-colors">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{crmApi.contactDisplayName(contact)}</p>
                            {contact.is_primary && <Badge variant="secondary">Primary</Badge>}
                            {contact.is_decision_maker && clientType(contact.client_id) !== 'individual' && (
                              <Badge variant="outline">Decision maker</Badge>
                            )}
                          </div>
                          {contact.job_title && <p className="text-sm text-muted-foreground">{contact.job_title}</p>}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              {clientType(contact.client_id) === 'individual' ? (
                                <User className="h-3 w-3" />
                              ) : (
                                <Building2 className="h-3 w-3" />
                              )}
                              {clientName(contact.client_id)}
                              <CsAccountTypeBadge accountType={clientType(contact.client_id)} />
                            </span>
                            {contact.email && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {contact.email}
                              </span>
                            )}
                            {contact.phone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {contact.phone}
                              </span>
                            )}
                          </div>
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
