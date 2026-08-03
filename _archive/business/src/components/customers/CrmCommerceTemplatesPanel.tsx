import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Palette, Plus, Settings2, Star, Trash2 } from 'lucide-react'
import type {
  CommerceContractTemplateSettings,
  CommerceDocType,
  CommerceInvoiceTemplateSettings,
  CommerceQuoteTemplateSettings,
  CrmCommerceTemplate,
} from '@/lib/crm-commerce-templates'
import {
  DEFAULT_CONTRACT_TEMPLATE,
  DEFAULT_INVOICE_TEMPLATE,
  DEFAULT_QUOTE_TEMPLATE,
  defaultTemplateName,
} from '@/lib/crm-commerce-templates'
import * as crmApi from '@/lib/customer-crm-api'
import { useToast } from '@/hooks/use-toast'
import { CommerceLogoUpload } from '@/components/customers/CommerceLogoUpload'

interface CrmCommerceTemplatesPanelProps {
  orgName?: string | null
}

export function CrmCommerceTemplatesPanel({ orgName }: CrmCommerceTemplatesPanelProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<CrmCommerceTemplate[]>([])
  const [activeType, setActiveType] = useState<CommerceDocType>('quote')
  const [editing, setEditing] = useState<CrmCommerceTemplate | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const rows = await crmApi.ensureDefaultCommerceTemplates(orgName)
    setTemplates(rows.length > 0 ? rows : await crmApi.getCommerceTemplates())
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [orgName])

  const typeTemplates = templates.filter((t) => t.doc_type === activeType)

  const openNew = () => {
    const defaults =
      activeType === 'quote'
        ? structuredClone(DEFAULT_QUOTE_TEMPLATE)
        : activeType === 'invoice'
          ? structuredClone(DEFAULT_INVOICE_TEMPLATE)
          : structuredClone(DEFAULT_CONTRACT_TEMPLATE)
    if (orgName) defaults.branding.company_name = orgName
    setEditing({
      id: '',
      organization_id: '',
      doc_type: activeType,
      name: `New ${defaultTemplateName(activeType).toLowerCase()}`,
      is_default: false,
      settings: defaults,
      created_at: '',
      updated_at: '',
    })
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    if (editing.id) {
      const saved = await crmApi.updateCommerceTemplate(editing.id, {
        name: editing.name,
        is_default: editing.is_default,
        settings: editing.settings,
      })
      if (saved) toast({ title: 'Template updated' })
    } else {
      const saved = await crmApi.createCommerceTemplate({
        doc_type: editing.doc_type,
        name: editing.name,
        is_default: editing.is_default,
        settings: editing.settings,
      })
      if (saved) toast({ title: 'Template created' })
    }
    setSaving(false)
    setEditing(null)
    await load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return
    await crmApi.deleteCommerceTemplate(id)
    toast({ title: 'Template deleted' })
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading templates…
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          Document templates
        </CardTitle>
        <CardDescription>
          Customize branding, default text, and layout for quotes, invoices, and contracts. Your team can override per document.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeType} onValueChange={(v) => setActiveType(v as CommerceDocType)}>
          <TabsList className="mb-4">
            <TabsTrigger value="quote">Quotes</TabsTrigger>
            <TabsTrigger value="invoice">Invoices</TabsTrigger>
            <TabsTrigger value="contract">Contracts</TabsTrigger>
          </TabsList>

          {(['quote', 'invoice', 'contract'] as CommerceDocType[]).map((type) => (
            <TabsContent key={type} value={type} className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={openNew}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New template
                </Button>
              </div>
              {templates.filter((t) => t.doc_type === type).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No templates yet</p>
              ) : (
                typeTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{template.name}</p>
                        {template.is_default && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Star className="h-3 w-3 mr-0.5" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {template.settings.branding?.company_name || 'Your Company'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(template)}>
                        <Settings2 className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      {!template.is_default && (
                        <Button size="sm" variant="ghost" onClick={() => void handleDelete(template.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="lg">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Edit template — {editing.doc_type}</DialogTitle>
              </DialogHeader>
              <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Template name</Label>
                    <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </div>
                  <div className="flex items-end gap-2 pb-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editing.is_default}
                        onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })}
                      />
                      Set as default for {editing.doc_type}s
                    </label>
                  </div>
                </div>

                <BrandingFields
                  branding={editing.settings.branding}
                  onChange={(branding) =>
                    setEditing({ ...editing, settings: { ...editing.settings, branding } })
                  }
                />

                {editing.doc_type === 'quote' && (
                  <QuoteTemplateFields
                    settings={editing.settings as CommerceQuoteTemplateSettings}
                    onChange={(settings) => setEditing({ ...editing, settings })}
                  />
                )}
                {editing.doc_type === 'invoice' && (
                  <InvoiceTemplateFields
                    settings={editing.settings as CommerceInvoiceTemplateSettings}
                    onChange={(settings) => setEditing({ ...editing, settings })}
                  />
                )}
                {editing.doc_type === 'contract' && (
                  <ContractTemplateFields
                    settings={editing.settings as CommerceContractTemplateSettings}
                    onChange={(settings) => setEditing({ ...editing, settings })}
                  />
                )}
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save template
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function BrandingFields({
  branding,
  onChange,
}: {
  branding: CommerceQuoteTemplateSettings['branding']
  onChange: (b: CommerceQuoteTemplateSettings['branding']) => void
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p className="text-sm font-medium">Company branding</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Company name</Label>
          <Input
            value={branding.company_name}
            onChange={(e) => onChange({ ...branding, company_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            value={branding.company_email}
            onChange={(e) => onChange({ ...branding, company_email: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={branding.company_phone}
            onChange={(e) => onChange({ ...branding, company_phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Primary color</Label>
          <Input
            type="color"
            value={branding.primary_color}
            onChange={(e) => onChange({ ...branding, primary_color: e.target.value })}
            className="h-9 p-1"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Textarea
          rows={2}
          value={branding.company_address}
          onChange={(e) => onChange({ ...branding, company_address: e.target.value })}
        />
      </div>
      <CommerceLogoUpload
        value={branding.logo_url}
        onChange={(logo_url) => onChange({ ...branding, logo_url })}
      />
    </div>
  )
}

function QuoteTemplateFields({
  settings,
  onChange,
}: {
  settings: CommerceQuoteTemplateSettings
  onChange: (s: CommerceQuoteTemplateSettings) => void
}) {
  return (
    <TemplateTextFields
      headerTitle={settings.header_title}
      introText={settings.intro_text}
      footerText={settings.footer_text}
      extraLabel="Terms & conditions"
      extraText={settings.terms_text}
      onChange={(patch) => onChange({ ...settings, ...patch })}
      extraKey="terms_text"
    />
  )
}

function InvoiceTemplateFields({
  settings,
  onChange,
}: {
  settings: CommerceInvoiceTemplateSettings
  onChange: (s: CommerceInvoiceTemplateSettings) => void
}) {
  return (
    <>
      <TemplateTextFields
        headerTitle={settings.header_title}
        introText={settings.intro_text}
        footerText={settings.footer_text}
        extraLabel="Payment instructions"
        extraText={settings.payment_instructions}
        onChange={(patch) => onChange({ ...settings, ...patch })}
        extraKey="payment_instructions"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Default due days</Label>
          <Input
            type="number"
            min="0"
            value={settings.due_days}
            onChange={(e) => onChange({ ...settings, due_days: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Tax rate (%)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={Math.round(settings.tax_rate * 10000) / 100}
            onChange={(e) =>
              onChange({ ...settings, tax_rate: (parseFloat(e.target.value) || 0) / 100 })
            }
          />
        </div>
      </div>
    </>
  )
}

function ContractTemplateFields({
  settings,
  onChange,
}: {
  settings: CommerceContractTemplateSettings
  onChange: (s: CommerceContractTemplateSettings) => void
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Agreement title</Label>
        <Input
          value={settings.header_title}
          onChange={(e) => onChange({ ...settings, header_title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Preamble</Label>
        <Textarea
          rows={3}
          value={settings.preamble}
          onChange={(e) => onChange({ ...settings, preamble: e.target.value })}
        />
      </div>
      {settings.sections.map((section, index) => (
        <div key={index} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Section {index + 1}</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...settings,
                  sections: settings.sections.filter((_, i) => i !== index),
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            value={section.title}
            onChange={(e) => {
              const sections = [...settings.sections]
              sections[index] = { ...section, title: e.target.value }
              onChange({ ...settings, sections })
            }}
            placeholder="Section title"
          />
          <Textarea
            rows={3}
            value={section.body}
            onChange={(e) => {
              const sections = [...settings.sections]
              sections[index] = { ...section, body: e.target.value }
              onChange({ ...settings, sections })
            }}
          />
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          onChange({
            ...settings,
            sections: [...settings.sections, { title: 'New section', body: '' }],
          })
        }
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add section
      </Button>
      <div className="space-y-2">
        <Label>Closing / signature block</Label>
        <Textarea
          rows={2}
          value={settings.closing_text}
          onChange={(e) => onChange({ ...settings, closing_text: e.target.value })}
        />
      </div>
    </div>
  )
}

function TemplateTextFields({
  headerTitle,
  introText,
  footerText,
  extraLabel,
  extraText,
  onChange,
  extraKey,
}: {
  headerTitle: string
  introText: string
  footerText: string
  extraLabel: string
  extraText: string
  extraKey: 'terms_text' | 'payment_instructions'
  onChange: (patch: Record<string, string>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Document title</Label>
        <Input value={headerTitle} onChange={(e) => onChange({ header_title: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Intro text</Label>
        <Textarea rows={2} value={introText} onChange={(e) => onChange({ intro_text: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>{extraLabel}</Label>
        <Textarea rows={2} value={extraText} onChange={(e) => onChange({ [extraKey]: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Footer text</Label>
        <Textarea rows={2} value={footerText} onChange={(e) => onChange({ footer_text: e.target.value })} />
      </div>
    </div>
  )
}
