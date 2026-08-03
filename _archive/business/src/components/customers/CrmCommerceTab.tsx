import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Download,
  ShoppingBag,
  Edit,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import type { Client } from '@/lib/customer-success-api'
import type { CrmContract, CrmInvoice, CrmQuote, LineItem } from '@/lib/customer-crm-api'
import * as crmApi from '@/lib/customer-crm-api'
import { downloadContractPdf, downloadInvoicePdf, downloadQuotePdf } from '@/lib/crm-pdf'
import { formatDateOnly, getTodayDateKey } from '@/lib/due-date-utils'
import { CsTabHeader } from '@/components/customers/CsModuleUi'
import { CrmCommerceTemplatesPanel } from '@/components/customers/CrmCommerceTemplatesPanel'
import { CrmLineItemsEditor } from '@/components/customers/CrmLineItemsEditor'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { CustomersTabLayoutProps } from '@/lib/customers/customers-widget-layout'
import { useAuth } from '@/contexts/AuthContext'
import type {
  CommerceContractTemplateSettings,
  CommerceDocType,
  CommerceInvoiceTemplateSettings,
  CommerceQuoteTemplateSettings,
  CrmCommerceTemplate,
} from '@/lib/crm-commerce-templates'
import {
  CONTRACT_LEGAL_DISCLAIMER,
  addDaysFromToday,
  normalizeLineItems,
} from '@/lib/crm-commerce-templates'
import { ModuleDiscussion } from '@/components/comms/ModuleDiscussion'

interface CrmCommerceTabProps {
  quotes: CrmQuote[]
  invoices: CrmInvoice[]
  contracts: CrmContract[]
  clients: Client[]
  onRefresh: () => Promise<void>
  layout: CustomersTabLayoutProps
}

type EditorMode = 'quote' | 'invoice' | 'contract' | null

export function CrmCommerceTab({ quotes, invoices, contracts, clients, onRefresh, layout }: CrmCommerceTabProps) {
  const { organization } = useAuth()
  const [templates, setTemplates] = useState<CrmCommerceTemplate[]>([])
  const [editorMode, setEditorMode] = useState<EditorMode>(null)
  const [editingQuote, setEditingQuote] = useState<CrmQuote | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<CrmInvoice | null>(null)
  const [editingContract, setEditingContract] = useState<CrmContract | null>(null)

  useEffect(() => {
    void crmApi.ensureDefaultCommerceTemplates(organization?.name).then(setTemplates)
  }, [organization?.name])

  const templateFor = (docType: CommerceDocType, templateId?: string | null) => {
    if (templateId) return templates.find((t) => t.id === templateId) ?? null
    return templates.find((t) => t.doc_type === docType && t.is_default) ?? templates.find((t) => t.doc_type === docType) ?? null
  }

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? '—'

  const openCreate = (mode: EditorMode) => {
    setEditingQuote(null)
    setEditingInvoice(null)
    setEditingContract(null)
    setEditorMode(mode)
  }

  const openEditQuote = (quote: CrmQuote) => {
    setEditingQuote(quote)
    setEditorMode('quote')
  }

  const openEditInvoice = (invoice: CrmInvoice) => {
    setEditingInvoice(invoice)
    setEditorMode('invoice')
  }

  const openEditContract = (contract: CrmContract) => {
    setEditingContract(contract)
    setEditorMode('contract')
  }

  const closeEditor = () => {
    setEditorMode(null)
    setEditingQuote(null)
    setEditingInvoice(null)
    setEditingContract(null)
  }

  const handleSaved = async () => {
    closeEditor()
    const rows = await crmApi.getCommerceTemplates()
    setTemplates(rows)
    await onRefresh()
  }

  return (
    <div className="space-y-6">
      <CsTabHeader
        icon={ShoppingBag}
        title="Quotes, invoices & contracts"
        description="Create branded, customizable commerce documents. Set up templates once, then tailor each quote, invoice, or contract for your customers."
      />

      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'metric_quotes') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Quotes</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{quotes.length}</p>
              </Card>
            )
          }

          if (widgetId === 'metric_invoices') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Invoices</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{invoices.length}</p>
              </Card>
            )
          }

          if (widgetId === 'metric_contracts') {
            return (
              <Card className="h-full p-4 flex flex-col justify-center">
                <p className="text-xs text-muted-foreground">Contracts</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{contracts.length}</p>
              </Card>
            )
          }

          if (widgetId === 'templates') {
            return (
              <Card className="h-full overflow-auto">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium mb-3">Document templates & branding</p>
                  <CrmCommerceTemplatesPanel orgName={organization?.name} />
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'quotes_list') {
            return (
              <div className="h-full overflow-auto space-y-3">
                <Button size="sm" onClick={() => openCreate('quote')}>
                  <Plus className="h-4 w-4 mr-1" /> New quote
                </Button>
                <DocumentList
                  emptyLabel="No quotes yet"
                  items={quotes.map((q) => ({
                    id: q.id,
                    title: q.quote_number,
                    subtitle: clientName(q.client_id),
                    status: q.status,
                    amount: q.total,
                    extra: q.valid_until ? `Valid until ${formatDateOnly(q.valid_until)}` : undefined,
                    onEdit: () => openEditQuote(q),
                    onDelete: async () => {
                      if (confirm('Delete this quote?')) {
                        await crmApi.deleteQuote(q.id)
                        await onRefresh()
                      }
                    },
                    onDownload: () =>
                      void downloadQuotePdf(q, clients.find((c) => c.id === q.client_id) ?? null, templateFor('quote', q.template_id)),
                  }))}
                />
              </div>
            )
          }

          if (widgetId === 'invoices_list') {
            return (
              <div className="h-full overflow-auto space-y-3">
                <Button size="sm" onClick={() => openCreate('invoice')}>
                  <Plus className="h-4 w-4 mr-1" /> New invoice
                </Button>
                <DocumentList
                  emptyLabel="No invoices yet"
                  items={invoices.map((inv) => ({
                    id: inv.id,
                    title: inv.invoice_number,
                    subtitle: clientName(inv.client_id),
                    status: inv.status,
                    amount: inv.total,
                    extra: inv.due_date ? `Due ${formatDateOnly(inv.due_date)}` : undefined,
                    onEdit: () => openEditInvoice(inv),
                    onDelete: async () => {
                      if (confirm('Delete this invoice?')) {
                        await crmApi.deleteInvoice(inv.id)
                        await onRefresh()
                      }
                    },
                    onDownload: () =>
                      void downloadInvoicePdf(
                        inv,
                        clients.find((c) => c.id === inv.client_id) ?? null,
                        templateFor('invoice', inv.template_id),
                      ),
                  }))}
                />
              </div>
            )
          }

          if (widgetId === 'contracts_list') {
            return (
              <div className="h-full overflow-auto space-y-3">
                <Button size="sm" onClick={() => openCreate('contract')}>
                  <Plus className="h-4 w-4 mr-1" /> New contract
                </Button>
                <DocumentList
                  emptyLabel="No contracts yet"
                  items={contracts.map((c) => ({
                    id: c.id,
                    title: c.title,
                    subtitle: clientName(c.client_id),
                    status: c.status,
                    amount: c.value,
                    extra:
                      c.start_date || c.end_date
                        ? `${formatDateOnly(c.start_date)} – ${formatDateOnly(c.end_date)}`
                        : undefined,
                    onEdit: () => openEditContract(c),
                    onDelete: async () => {
                      if (confirm('Delete this contract?')) {
                        await crmApi.deleteContract(c.id)
                        await onRefresh()
                      }
                    },
                    onDownload: () =>
                      void downloadContractPdf(
                        c,
                        clients.find((cl) => cl.id === c.client_id) ?? null,
                        templateFor('contract', c.template_id),
                      ),
                  }))}
                />
              </div>
            )
          }

          return null
        }}
      />

      <QuoteInvoiceEditorDialog
        open={editorMode === 'quote'}
        mode="quote"
        clients={clients}
        templates={templates.filter((t) => t.doc_type === 'quote')}
        existing={editingQuote}
        onClose={closeEditor}
        onSaved={handleSaved}
      />
      <QuoteInvoiceEditorDialog
        open={editorMode === 'invoice'}
        mode="invoice"
        clients={clients}
        templates={templates.filter((t) => t.doc_type === 'invoice')}
        existing={editingInvoice}
        onClose={closeEditor}
        onSaved={handleSaved}
      />
      <ContractEditorDialog
        open={editorMode === 'contract'}
        clients={clients}
        templates={templates.filter((t) => t.doc_type === 'contract')}
        existing={editingContract}
        onClose={closeEditor}
        onSaved={handleSaved}
      />
    </div>
  )
}

function DocumentList({
  items,
  emptyLabel,
}: {
  emptyLabel: string
  items: Array<{
    id: string
    title: string
    subtitle: string
    status: string
    amount: number
    extra?: string
    onEdit: () => void
    onDelete: () => void
    onDownload: () => void
  }>
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyLabel}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0 text-sm">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                {item.extra && <p className="text-xs text-muted-foreground">{item.extra}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{item.status}</Badge>
                <span className="tabular-nums font-medium">${item.amount.toLocaleString()}</span>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={item.onEdit}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={item.onDownload}>
                  <Download className="h-3 w-3" />
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={item.onDelete}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function QuoteInvoiceEditorDialog({
  open,
  mode,
  clients,
  templates,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: 'quote' | 'invoice'
  clients: Client[]
  templates: CrmCommerceTemplate[]
  existing: CrmQuote | CrmInvoice | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const defaultTemplate = templates.find((t) => t.is_default) ?? templates[0]
  const templateSettings = defaultTemplate?.settings as CommerceQuoteTemplateSettings | CommerceInvoiceTemplateSettings | undefined

  const [submitting, setSubmitting] = useState(false)
  const [templateId, setTemplateId] = useState(defaultTemplate?.id ?? '')
  const [clientId, setClientId] = useState('')
  const [status, setStatus] = useState(mode === 'quote' ? 'draft' : 'draft')
  const [lineItems, setLineItems] = useState<LineItem[]>(
    templateSettings?.default_line_items?.length
      ? normalizeLineItems(templateSettings.default_line_items)
      : [{ description: 'Service or product', quantity: 1, unit_price: 0, total: 0 }],
  )
  const [notes, setNotes] = useState(templateSettings?.default_notes ?? '')
  const [introText, setIntroText] = useState(templateSettings?.intro_text ?? '')
  const [footerText, setFooterText] = useState(templateSettings?.footer_text ?? '')
  const [headerTitle, setHeaderTitle] = useState(templateSettings?.header_title ?? (mode === 'quote' ? 'Quote' : 'Invoice'))
  const [extraText, setExtraText] = useState(
    mode === 'quote'
      ? (templateSettings as CommerceQuoteTemplateSettings | undefined)?.terms_text ?? ''
      : (templateSettings as CommerceInvoiceTemplateSettings | undefined)?.payment_instructions ?? '',
  )
  const [dateValue, setDateValue] = useState(
    mode === 'quote'
      ? addDaysFromToday((templateSettings as CommerceQuoteTemplateSettings | undefined)?.validity_days ?? 30)
      : addDaysFromToday((templateSettings as CommerceInvoiceTemplateSettings | undefined)?.due_days ?? 30),
  )

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? defaultTemplate,
    [templateId, templates, defaultTemplate],
  )

  const taxRate =
    mode === 'invoice'
      ? (selectedTemplate?.settings as CommerceInvoiceTemplateSettings | undefined)?.tax_rate ?? 0
      : (selectedTemplate?.settings as CommerceQuoteTemplateSettings | undefined)?.tax_rate ?? 0

  const totals = crmApi.computeLineItemTotal(lineItems, taxRate)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setClientId(existing.client_id ?? '')
      setStatus(existing.status)
      setLineItems(normalizeLineItems(existing.line_items))
      setNotes(existing.notes ?? '')
      setTemplateId(existing.template_id ?? defaultTemplate?.id ?? '')
      setIntroText(existing.document_settings?.intro_text ?? '')
      setFooterText(existing.document_settings?.footer_text ?? '')
      setHeaderTitle(existing.document_settings?.header_title ?? headerTitle)
      if (mode === 'quote') {
        const q = existing as CrmQuote
        setDateValue(q.valid_until ?? '')
        setExtraText(existing.document_settings?.terms_text ?? extraText)
      } else {
        const inv = existing as CrmInvoice
        setDateValue(inv.due_date ?? '')
        setExtraText(existing.document_settings?.payment_instructions ?? extraText)
      }
      return
    }
    applyTemplate(defaultTemplate)
  }, [open, existing?.id])

  const applyTemplate = (template: CrmCommerceTemplate | undefined) => {
    if (!template) return
    setTemplateId(template.id)
    const s = template.settings as CommerceQuoteTemplateSettings | CommerceInvoiceTemplateSettings
    setLineItems(normalizeLineItems(s.default_line_items?.length ? s.default_line_items : lineItems))
    setNotes(s.default_notes ?? '')
    setIntroText(s.intro_text ?? '')
    setFooterText(s.footer_text ?? '')
    setHeaderTitle(s.header_title ?? '')
    if (mode === 'quote') {
      const qs = s as CommerceQuoteTemplateSettings
      setExtraText(qs.terms_text ?? '')
      setDateValue(addDaysFromToday(qs.validity_days ?? 30))
    } else {
      const is = s as CommerceInvoiceTemplateSettings
      setExtraText(is.payment_instructions ?? '')
      setDateValue(addDaysFromToday(is.due_days ?? 30))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const document_settings = {
      header_title: headerTitle,
      intro_text: introText,
      footer_text: footerText,
      ...(mode === 'quote' ? { terms_text: extraText } : { payment_instructions: extraText }),
    }

    if (mode === 'quote') {
      const payload = {
        deal_id: null,
        client_id: clientId || null,
        contact_id: null,
        status: status as CrmQuote['status'],
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        valid_until: dateValue || null,
        line_items: lineItems,
        notes,
        template_id: templateId || null,
        document_settings,
      }
      if (existing) await crmApi.updateQuote(existing.id, payload)
      else await crmApi.createQuote(payload)
    } else {
      const payload = {
        quote_id: null,
        client_id: clientId || null,
        status: status as CrmInvoice['status'],
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        due_date: dateValue || null,
        paid_date: null,
        line_items: lineItems,
        notes,
        template_id: templateId || null,
        document_settings,
      }
      if (existing) await crmApi.updateInvoice(existing.id, payload)
      else await crmApi.createInvoice(payload)
    }

    setSubmitting(false)
    await onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit' : 'New'} {mode}</DialogTitle>
          <DialogDescription>Customize line items, text, and branding for this document.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
              <div className="space-y-2">
                <Label>Template</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={templateId}
                  onChange={(e) => {
                    const t = templates.find((tpl) => tpl.id === e.target.value)
                    applyTemplate(t)
                  }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Document title</Label>
                <Input value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {mode === 'quote' ? (
                    <>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                      <option value="expired">Expired</option>
                    </>
                  ) : (
                    <>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="void">Void</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Intro text</Label>
              <Textarea rows={2} value={introText} onChange={(e) => setIntroText(e.target.value)} />
            </div>

            <CrmLineItemsEditor
              items={lineItems}
              onChange={setLineItems}
              currency={(selectedTemplate?.settings as CommerceQuoteTemplateSettings | undefined)?.currency ?? 'USD'}
            />

            <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({(taxRate * 100).toFixed(1)}%)</span>
                <span className="tabular-nums">${totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">${totals.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{mode === 'quote' ? 'Valid until' : 'Due date'}</Label>
                <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{mode === 'quote' ? 'Terms & conditions' : 'Payment instructions'}</Label>
              <Textarea rows={3} value={extraText} onChange={(e) => setExtraText(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Notes (internal / customer-facing)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Footer text</Label>
              <Textarea rows={2} value={footerText} onChange={(e) => setFooterText(e.target.value)} />
            </div>
            {mode === 'invoice' && existing?.id && (
              <ModuleDiscussion
                contextType="invoice"
                contextId={existing.id}
                title="Invoice discussion"
                contextLabel={`Invoice ${existing.id.slice(0, 8)}`}
                className="mt-2"
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {existing ? 'Save changes' : `Create ${mode}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ContractEditorDialog({
  open,
  clients,
  templates,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean
  clients: Client[]
  templates: CrmCommerceTemplate[]
  existing: CrmContract | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const defaultTemplate = templates.find((t) => t.is_default) ?? templates[0]
  const [submitting, setSubmitting] = useState(false)
  const [legalAck, setLegalAck] = useState(false)
  const [templateId, setTemplateId] = useState(defaultTemplate?.id ?? '')
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('Service Agreement')
  const [status, setStatus] = useState('draft')
  const [value, setValue] = useState('')
  const [startDate, setStartDate] = useState(getTodayDateKey())
  const [endDate, setEndDate] = useState('')
  const [preamble, setPreamble] = useState('')
  const [sections, setSections] = useState<{ title: string; body: string }[]>([])
  const [closingText, setClosingText] = useState('')
  const [footerText, setFooterText] = useState('')
  const [customTerms, setCustomTerms] = useState('')

  const buildTermsFromSections = (
    preambleText: string,
    sectionList: { title: string; body: string }[],
    closing: string,
  ) => {
    const parts = [preambleText.trim()]
    for (const section of sectionList) {
      if (section.title.trim() || section.body.trim()) {
        parts.push(`${section.title.trim()}\n${section.body.trim()}`.trim())
      }
    }
    if (closing.trim()) parts.push(closing.trim())
    return parts.filter(Boolean).join('\n\n')
  }

  const applyTemplate = (template: CrmCommerceTemplate | undefined) => {
    if (!template) return
    const s = template.settings as CommerceContractTemplateSettings
    setTemplateId(template.id)
    setTitle(s.header_title || 'Service Agreement')
    setPreamble(s.preamble ?? '')
    setSections(structuredClone(s.sections ?? []))
    setClosingText(s.closing_text ?? '')
    setFooterText(s.footer_text ?? '')
    setCustomTerms(buildTermsFromSections(s.preamble ?? '', s.sections ?? [], s.closing_text ?? ''))
  }

  useEffect(() => {
    if (!open) return
    setLegalAck(false)
    if (existing) {
      setClientId(existing.client_id ?? '')
      setTitle(existing.title)
      setStatus(existing.status)
      setValue(String(existing.value || ''))
      setStartDate(existing.start_date ?? getTodayDateKey())
      setEndDate(existing.end_date ?? '')
      setTemplateId(existing.template_id ?? defaultTemplate?.id ?? '')
      setCustomTerms(existing.terms ?? '')
      setFooterText(existing.document_settings?.footer_text ?? '')
      setPreamble('')
      setSections(existing.document_settings?.custom_sections ?? [])
      setClosingText('')
      return
    }
    applyTemplate(defaultTemplate)
  }, [open, existing?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!legalAck) return
    setSubmitting(true)

    const terms =
      customTerms.trim() ||
      buildTermsFromSections(preamble, sections, closingText)

    const payload = {
      title: title.trim() || 'Service Agreement',
      client_id: clientId || null,
      deal_id: null,
      status: status as CrmContract['status'],
      start_date: startDate || null,
      end_date: endDate || null,
      value: parseFloat(value) || 0,
      terms,
      template_id: templateId || null,
      document_settings: {
        footer_text: footerText,
        custom_sections: sections,
      },
    }

    if (existing) await crmApi.updateContract(existing.id, payload)
    else await crmApi.createContract(payload)

    setSubmitting(false)
    await onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit contract' : 'New contract'}</DialogTitle>
          <DialogDescription>Build a customizable agreement from your template. Review with legal counsel before sending.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto">
            <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Not legal advice</AlertTitle>
              <AlertDescription className="text-sm">{CONTRACT_LEGAL_DISCLAIMER}</AlertDescription>
            </Alert>

            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={legalAck}
                onChange={(e) => setLegalAck(e.target.checked)}
                required
              />
              <span>
                I understand this tool does not provide legal advice and I will consult a qualified attorney before using this contract with customers.
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
              <div className="space-y-2">
                <Label>Template</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={templateId}
                  onChange={(e) => {
                    const t = templates.find((tpl) => tpl.id === e.target.value)
                    applyTemplate(t)
                  }}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Agreement title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contract value ($)</Label>
              <Input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            {!existing && sections.length > 0 && (
              <div className="space-y-3">
                <Label>Template sections (edit per contract)</Label>
                {sections.map((section, index) => (
                  <div key={index} className="rounded-lg border p-3 space-y-2">
                    <Input
                      value={section.title}
                      onChange={(e) => {
                        const next = [...sections]
                        next[index] = { ...section, title: e.target.value }
                        setSections(next)
                        setCustomTerms(buildTermsFromSections(preamble, next, closingText))
                      }}
                    />
                    <Textarea
                      rows={3}
                      value={section.body}
                      onChange={(e) => {
                        const next = [...sections]
                        next[index] = { ...section, body: e.target.value }
                        setSections(next)
                        setCustomTerms(buildTermsFromSections(preamble, next, closingText))
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <Label>Full contract terms</Label>
              <Textarea
                rows={10}
                value={customTerms}
                onChange={(e) => setCustomTerms(e.target.value)}
                placeholder="Write or paste your full agreement text here…"
              />
              <p className="text-xs text-muted-foreground">
                You have full control over the contract language. Customize every clause to match your business needs.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Footer text (optional)</Label>
              <Textarea rows={2} value={footerText} onChange={(e) => setFooterText(e.target.value)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !legalAck}>
              {existing ? 'Save contract' : 'Create contract'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ClientSelect({
  clients,
  value,
  onChange,
}: {
  clients: Client[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>Customer</Label>
      <select
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}
