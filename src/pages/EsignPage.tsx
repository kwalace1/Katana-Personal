import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MotionPage } from '@/components/motion-page'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  AlertCircle,
  FileSignature,
  Loader2,
  Mail,
  PenLine,
  Plus,
  Search,
  Trash2,
  Ban,
  LayoutTemplate,
} from 'lucide-react'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  bulkCancelEsignDocuments,
  bulkDeleteEsignDocuments,
  computeEsignStats,
  createEsignDocument,
  createEsignTemplate,
  deleteEsignTemplate,
  isEsignSchemaError,
  listEsignDocuments,
  listEsignTemplates,
  markEsignReminded,
  buildSigningUrl,
} from '@/lib/esign-api'
import { sendEsignSigningEmails, isEsignEmailConfigured } from '@/lib/esign-email'
import type {
  CreateEsignDocumentInput,
  EsignDocumentWithRelations,
  EsignTemplate,
} from '@/lib/esign-types'
import { ESIGN_STATUS_LABELS } from '@/lib/esign-types'
import { EsignUploadDialog } from '@/components/esign/EsignUploadDialog'
import { EsignCreateTemplateDialog } from '@/components/esign/EsignCreateTemplateDialog'
import { EsignGuidedEmpty } from '@/components/esign/EsignGuidedEmpty'
import { formatDateOnly } from '@/lib/due-date-utils'
import { toast } from 'sonner'
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  ESIGN_MODULE_ID,
  getEsignTabSurfaceConfig,
} from '@/lib/esign/esign-widget-layout'
import { useAuth } from '@/contexts/AuthContext'
import { esignStatusTone, ESIGN_SHELL, ESIGN_INSET } from '@/components/esign/esign-ui'

export default function EsignPage() {
  const navigate = useNavigate()
  const { profile, organization } = useAuth()
  const surface = getEsignTabSurfaceConfig('dashboard')
  const {
    layout,
    isCustomizeMode,
    enterCustomize,
    saveAndExit,
    onLayoutChange,
    addWidget,
    removeWidget,
    availableWidgets,
    resetToDefault,
  } = useModuleWidgetLayout({
    moduleId: ESIGN_MODULE_ID,
    surfaceId: surface.id,
    catalog: surface.catalog,
    normalize: surface.normalize,
    toBase: surface.toBase,
    successMessage: 'E-Sign layout saved',
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [docs, setDocs] = useState<EsignDocumentWithRelations[]>([])
  const [templates, setTemplates] = useState<EsignTemplate[]>([])
  const [search, setSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [templateForUpload, setTemplateForUpload] = useState<string | null>(null)
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [templatesError, setTemplatesError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    setError(null)
    setSchemaMissing(false)
    setTemplatesError(null)
    try {
      const list = await listEsignDocuments()
      setDocs(list)
    } catch (e) {
      if (isEsignSchemaError(e) || (e instanceof Error && e.message === 'ESIGN_SCHEMA_MISSING')) {
        setSchemaMissing(true)
        setDocs([])
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load documents')
      }
    }
    try {
      const tpls = await listEsignTemplates()
      setTemplates(tpls)
    } catch (e) {
      setTemplates([])
      setTemplatesError(
        e instanceof Error
          ? e.message
          : 'Could not load templates. Run supabase-esign-v2-migration.sql.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const stats = useMemo(() => computeEsignStats(docs), [docs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return docs
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.signers.some(
          (s) => s.name.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q),
        ),
    )
  }, [docs, search])

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelected(new Set(filtered.map((d) => d.id)))
  }

  const handleCreate = async (input: CreateEsignDocumentInput) => {
    const created = await createEsignDocument(input)
    toast.success('Document uploaded')
    navigate(`/esign/${created.id}`)
  }

  const handleBulkRemind = async () => {
    const targets = docs.filter(
      (d) => selected.has(d.id) && (d.status === 'pending' || d.status === 'partially_signed'),
    )
    if (!targets.length) {
      toast.error('Select awaiting documents to remind')
      return
    }
    if (!isEsignEmailConfigured()) {
      toast.error('Configure EmailJS to send reminders')
      return
    }
    let sent = 0
    for (const doc of targets) {
      const result = await sendEsignSigningEmails({
        signers: doc.signers.filter((s) => !s.signed_at),
        documentTitle: doc.title,
        buildUrl: buildSigningUrl,
        organizationName: organization?.name,
        requesterName: profile?.full_name || profile?.email || undefined,
        expiresAt: doc.expires_at,
      })
      sent += result.sent
      await markEsignReminded(doc.id)
    }
    toast.success(`Sent ${sent} reminder email${sent === 1 ? '' : 's'}`)
    await refresh()
  }

  const handleBulkCancel = async () => {
    const ids = [...selected]
    if (!ids.length) return
    const n = await bulkCancelEsignDocuments(ids)
    toast.success(`Cancelled ${n} document${n === 1 ? '' : 's'}`)
    setSelected(new Set())
    await refresh()
  }

  const handleBulkDelete = async () => {
    const ids = [...selected]
    if (!ids.length) return
    if (!window.confirm(`Delete ${ids.length} document(s)?`)) return
    const n = await bulkDeleteEsignDocuments(ids)
    toast.success(`Deleted ${n}`)
    setSelected(new Set())
    await refresh()
  }

  const showGuidedEmpty =
    !loading &&
    !schemaMissing &&
    !error &&
    isSupabaseConfigured &&
    docs.length === 0 &&
    !isCustomizeMode

  return (
    <MotionPage className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ModuleCustomizeControls
          customizeMode={isCustomizeMode}
          onEnterCustomize={enterCustomize}
          onDone={() => void saveAndExit()}
        />
      </div>

      {isCustomizeMode && (
        <div className="space-y-3">
          <ModuleCustomizeHint surfaceLabel="E-Sign dashboard" />
          <div className="flex flex-wrap gap-2">
            <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
            <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
              Reset layout
            </Button>
          </div>
        </div>
      )}

      {!isSupabaseConfigured && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="py-4 flex gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            Supabase is not configured, so E-Sign cannot store documents yet.
          </CardContent>
        </Card>
      )}

      {schemaMissing && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="py-4 text-sm space-y-2">
            <p className="font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              E-Sign database not set up
            </p>
            <p className="text-muted-foreground">
              Run <code className="rounded bg-muted px-1">supabase-esign-schema.sql</code> then{' '}
              <code className="rounded bg-muted px-1">supabase-esign-v2-migration.sql</code>.
            </p>
          </CardContent>
        </Card>
      )}

      {showGuidedEmpty ? (
        <div className="space-y-4">
          <EsignGuidedEmpty
            disabled={!isSupabaseConfigured || schemaMissing}
            onStart={() => {
              setTemplateForUpload(null)
              setUploadOpen(true)
            }}
            templateCount={templates.length}
            onCreateTemplate={() => {
              if (templates.length > 0) {
                document.getElementById('esign-templates-panel')?.scrollIntoView({ behavior: 'smooth' })
              } else {
                setCreateTemplateOpen(true)
              }
            }}
          />
          {(templates.length > 0 || templatesError) && (
            <Card id="esign-templates-panel">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutTemplate className="h-4 w-4" />
                  Templates
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setCreateTemplateOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {templatesError && (
                  <p className="text-sm text-amber-700 dark:text-amber-400">{templatesError}</p>
                )}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map((t) => (
                    <div key={t.id} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.field_blueprint?.length ?? 0} fields · {t.default_signer_count} signer
                        {t.default_signer_count === 1 ? '' : 's'}
                      </p>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setTemplateForUpload(t.id)
                          setUploadOpen(true)
                        }}
                      >
                        Use template
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={surface.catalog}
        customizeMode={isCustomizeMode}
        onLayoutChange={onLayoutChange}
        onRemoveWidget={removeWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'header') {
            return (
              <div className={`h-full flex flex-wrap items-start justify-between gap-4 p-5 ${ESIGN_SHELL}`}>
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                      <PenLine className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Signatures
                      </p>
                      <h1 className="text-2xl font-semibold tracking-tight">Katana E-Sign</h1>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed pl-0 sm:pl-14">
                    Create a request, place signature boxes, send links or email, and track who has signed.
                    Save layouts as templates to reuse next time.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="shadow-md shadow-primary/15"
                  onClick={() => {
                    setTemplateForUpload(null)
                    setUploadOpen(true)
                  }}
                  disabled={!isSupabaseConfigured || schemaMissing}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New request
                </Button>
              </div>
            )
          }

          if (widgetId === 'stats') {
            const items = [
              { label: 'Total', value: stats.total, accent: 'from-slate-500/15 to-transparent' },
              { label: 'Draft', value: stats.draft, accent: 'from-muted-foreground/10 to-transparent' },
              { label: 'Awaiting', value: stats.pending, accent: 'from-sky-500/15 to-transparent' },
              { label: 'Partial', value: stats.partiallySigned, accent: 'from-amber-500/15 to-transparent' },
              { label: 'Completed', value: stats.signed, accent: 'from-emerald-500/15 to-transparent' },
            ]
            return (
              <div className="h-full grid grid-cols-2 sm:grid-cols-5 gap-2 p-1">
                {items.map((item) => (
                  <div
                    key={item.label}
                    className={`relative overflow-hidden h-full rounded-xl border border-border/70 bg-card p-3 ${ESIGN_INSET}`}
                  >
                    <div
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.accent}`}
                    />
                    <div className="relative">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="text-2xl font-semibold tabular-nums mt-1 tracking-tight">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          }

          if (widgetId === 'filters') {
            return (
              <div className={`h-full flex flex-wrap items-center gap-2 p-3 ${ESIGN_INSET}`}>
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 bg-background/80"
                    placeholder="Search documents or signers…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selected.size}
                  onClick={() => void handleBulkRemind()}
                >
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  Remind
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selected.size}
                  onClick={() => void handleBulkCancel()}
                >
                  <Ban className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selected.size}
                  onClick={() => void handleBulkDelete()}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
                {selected.size > 0 && (
                  <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                )}
              </div>
            )
          }

          if (widgetId === 'document_list') {
            if (loading) {
              return (
                <div className="h-full flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading…
                </div>
              )
            }
            if (error) {
              return (
                <Card className="h-full border-destructive/40">
                  <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
                </Card>
              )
            }
            return (
              <Card className="h-full overflow-auto border-border/70 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base tracking-tight">
                    {filtered.length} document{filtered.length === 1 ? '' : 's'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {filtered.length === 0 ? (
                    <div className="text-center py-12 space-y-3 rounded-xl border border-dashed bg-muted/20">
                      <FileSignature className="h-10 w-10 mx-auto text-muted-foreground/70" />
                      <p className="text-sm text-muted-foreground">No signature requests match your search.</p>
                    </div>
                  ) : (
                    filtered.map((doc) => {
                      const signed = doc.signers.filter((s) => s.signed_at).length
                      const tone = esignStatusTone(doc.status)
                      const progress =
                        doc.signers.length > 0 ? Math.round((signed / doc.signers.length) * 100) : 0
                      return (
                        <div
                          key={doc.id}
                          className="group flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card/50 p-3.5 transition-colors hover:border-primary/30 hover:bg-card"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={selected.has(doc.id)}
                            onChange={() => toggleSelected(doc.id)}
                            aria-label={`Select ${doc.title}`}
                          />
                          <Link to={`/esign/${doc.id}`} className="min-w-0 flex-1 space-y-1.5 hover:opacity-95">
                            <p className="font-medium truncate tracking-tight group-hover:text-primary transition-colors">
                              {doc.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {doc.signers.map((s) => s.name).join(', ') || 'No signers'} ·{' '}
                              {formatDateOnly(doc.created_at)}
                              {doc.client_id ? ' · Customer linked' : ''}
                              {doc.project_id ? ' · Project linked' : ''}
                            </p>
                            <div className="h-1 w-full max-w-[220px] rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${tone.dot}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </Link>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs tabular-nums text-muted-foreground font-medium">
                              {signed}/{doc.signers.length}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tone.chip}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                              {ESIGN_STATUS_LABELS[doc.status]}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'templates') {
            return (
              <Card className="h-full overflow-auto border-border/70 shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2 tracking-tight">
                      <LayoutTemplate className="h-4 w-4 text-primary" />
                      Templates
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create a template, upload a sample file, place boxes, then save — reuse it anytime.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setCreateTemplateOpen(true)}
                    disabled={!isSupabaseConfigured || schemaMissing}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create template
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {templatesError && (
                    <p className="text-sm text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      {templatesError.includes('esign_templates') ||
                      templatesError.includes('schema') ||
                      templatesError.includes('does not exist')
                        ? 'Templates need the database migration. Run supabase-esign-v2-migration.sql in Supabase, then refresh.'
                        : templatesError}
                    </p>
                  )}
                  {templates.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">
                        No templates yet. Click{' '}
                        <span className="font-medium text-foreground">Create template</span>, name it,
                        upload a sample document, place signature boxes, then click{' '}
                        <span className="font-medium text-foreground">Save as template</span>.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setCreateTemplateOpen(true)}
                        disabled={!isSupabaseConfigured || schemaMissing}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Create your first template
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {templates.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-xl border border-border/70 bg-gradient-to-b from-card to-muted/20 p-3.5 space-y-2.5 transition-colors hover:border-primary/30"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate tracking-tight">{t.name}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {t.field_blueprint?.length ?? 0} fields · {t.default_signer_count}{' '}
                                signer{t.default_signer_count === 1 ? '' : 's'}
                                {(t.field_blueprint?.length ?? 0) === 0 ? ' · needs field setup' : ''}
                              </p>
                              {t.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {t.description}
                                </p>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() =>
                                void deleteEsignTemplate(t.id)
                                  .then(() => refresh())
                                  .then(() => toast.success('Template deleted'))
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            variant={(t.field_blueprint?.length ?? 0) === 0 ? 'outline' : 'default'}
                            onClick={() => {
                              setTemplateForUpload(t.id)
                              setUploadOpen(true)
                            }}
                          >
                            {(t.field_blueprint?.length ?? 0) === 0 ? 'Set up fields' : 'Use template'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />
      )}

      <EsignUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSubmit={handleCreate}
        initialTemplateId={templateForUpload}
      />

      <EsignCreateTemplateDialog
        open={createTemplateOpen}
        onOpenChange={setCreateTemplateOpen}
        onCreate={async (input) => {
          const created = await createEsignTemplate({
            name: input.name,
            description: input.description,
            defaultTitle: input.defaultTitle,
            defaultSignerCount: input.defaultSignerCount,
            fieldBlueprint: [],
          })
          await refresh()
          return created
        }}
        onCreated={(templateId) => {
          toast.success('Template created — upload a sample document and place signature boxes')
          setTemplateForUpload(templateId)
          setUploadOpen(true)
        }}
      />
    </MotionPage>
  )
}
