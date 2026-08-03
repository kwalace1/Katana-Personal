import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FileText, Loader2, RefreshCw, Search, Trash2, Upload } from 'lucide-react'
import {
  AUTOMATION_BUCKET,
  AUTOMATION_MODULE,
  deleteAutomationDocument,
  extractStatusLabel,
  formatBytesPublic,
  listAutomationDocumentRecords,
  listAutomationDocuments,
  reindexAutomationDocument,
  searchAutomationDocuments,
  uploadAutomationDocument,
  type AutomationDocumentRecord,
  type AutomationDocumentSearchHit,
} from '@/lib/automation-api'
import type { StorageFileRecord } from '@/lib/storage-api'
import type { ExtractStatus } from '@/lib/automation-document-extract'
import { SwitchImportDivert } from '@/components/switch/switch-import-divert'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { AutomationTabLayoutProps } from '@/lib/automation/automation-widget-layout'

interface DocumentsPanelProps {
  onChanged?: () => void
  onOpenAgent?: () => void
  layout: AutomationTabLayoutProps
}

function statusVariant(
  status: ExtractStatus | undefined,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ready') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'unsupported') return 'secondary'
  return 'outline'
}

export function DocumentsPanel({ onChanged, onOpenAgent, layout }: DocumentsPanelProps) {
  const [docs, setDocs] = useState<StorageFileRecord[]>([])
  const [indexes, setIndexes] = useState<Record<string, AutomationDocumentRecord>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reindexingId, setReindexingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<AutomationDocumentSearchHit[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [switchFile, setSwitchFile] = useState<File | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [list, records] = await Promise.all([
        listAutomationDocuments(),
        listAutomationDocumentRecords(),
      ])
      setDocs(list)
      const map: Record<string, AutomationDocumentRecord> = {}
      for (const r of records) map[r.storage_file_id] = r
      setIndexes(map)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return
    setUploading(true)
    let ok = 0
    let indexed = 0
    for (const file of files) {
      const result = await uploadAutomationDocument(file)
      if ('error' in result) {
        toast.error(`${file.name}: ${result.error}`)
      } else {
        ok++
        if (result.index?.extract_status === 'ready') indexed++
        else if (result.index?.extract_error) {
          toast.message(`${file.name}: ${result.index.extract_error}`)
        }
      }
    }
    if (ok > 0) {
      toast.success(
        indexed > 0
          ? `Uploaded ${ok} · indexed ${indexed} for search`
          : `Uploaded ${ok} file${ok === 1 ? '' : 's'}`,
      )
      await refresh()
      onChanged?.()
    }
    setUploading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.length) {
      void uploadFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const success = await deleteAutomationDocument(id)
    setDeletingId(null)
    if (!success) {
      toast.error('Could not delete document')
      return
    }
    toast.success('Document removed')
    await refresh()
    onChanged?.()
  }

  const handleReindex = async (file: StorageFileRecord) => {
    setReindexingId(file.id)
    const result = await reindexAutomationDocument(file)
    setReindexingId(null)
    if (!result) {
      toast.error(`Could not re-index ${file.file_name}`)
      return
    }
    if (result.extract_status === 'ready') {
      toast.success(`Indexed ${file.file_name}`)
    } else {
      toast.message(result.extract_error || `Stored ${file.file_name}`)
    }
    await refresh()
    onChanged?.()
  }

  const handleSearch = async () => {
    const q = searchQuery.trim()
    if (!q) {
      setHits(null)
      return
    }
    setSearching(true)
    try {
      const next = await searchAutomationDocuments(q, 20)
      setHits(next)
      if (next.length === 0) toast.message('No matching documents')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div data-tour="automation-documents-panel">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId): ReactNode => {
          if (widgetId === 'upload_zone') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Document Manager</CardTitle>
                  <CardDescription>
                    Upload policies, specs, and reference files. Text is extracted so Automation
                    Agent can search them (module: {AUTOMATION_MODULE}, bucket: {AUTOMATION_BUCKET}
                    ).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                      dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                    }`}
                    onDragEnter={(e) => {
                      e.preventDefault()
                      setDragActive(true)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragActive(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setDragActive(false)
                    }}
                    onDrop={handleDrop}
                  >
                    <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 text-lg font-semibold">
                      {uploading ? 'Uploading & indexing…' : 'Drag & Drop Files'}
                    </h3>
                    <p className="mb-4 text-sm text-muted-foreground">or click to browse</p>
                    <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading
                        </>
                      ) : (
                        'Select Files'
                      )}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept=".pdf,.txt,.csv,.md,.doc,.docx,.xls,.xlsx,.json,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => {
                        if (e.target.files?.length) void uploadFiles(Array.from(e.target.files))
                        e.target.value = ''
                      }}
                    />
                    <p className="mt-4 text-xs text-muted-foreground">
                      Searchable: PDF, TXT, MD, CSV, JSON, DOCX, XLSX · Images stored only (max 25MB)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'switch_import') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Send to Switch</CardTitle>
                  <CardDescription>
                    Optionally divert a selected file into Switch for processing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Input
                    type="file"
                    accept=".pdf,.txt,.csv,.md,.doc,.docx,.xls,.xlsx,.json,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => setSwitchFile(e.target.files?.[0] ?? null)}
                  />
                  <SwitchImportDivert
                    module="automation"
                    entityType="storage_file"
                    sourceLabel="katana.automation.document_upload"
                    file={switchFile}
                    disabled={!switchFile}
                  />
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'document_search') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Search indexed docs</CardTitle>
                  <CardDescription>Query extracted text across your library.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search indexed documents…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSearch()
                      }}
                    />
                    <Button
                      variant="outline"
                      disabled={searching}
                      onClick={() => void handleSearch()}
                    >
                      {searching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                    {hits !== null && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setHits(null)
                          setSearchQuery('')
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  {hits !== null && (
                    <div className="space-y-2">
                      <h4 className="font-semibold">Search results ({hits.length})</h4>
                      {hits.length === 0 ? (
                        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          No matches. Try different keywords or upload more documents.
                        </p>
                      ) : (
                        hits.map((hit) => (
                          <div key={hit.id} className="rounded-lg border p-3">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium">{hit.file_name}</p>
                              <Badge variant="outline">
                                {Math.round((hit.rank || 0) * 100)}% match
                              </Badge>
                            </div>
                            <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                              {hit.snippet}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'document_library') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Library</CardTitle>
                  <CardDescription>Re-index or remove files from this workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading documents…
                    </div>
                  ) : docs.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No documents yet. Upload files to index them for this workspace.
                    </p>
                  ) : (
                    docs.map((doc) => {
                      const index = indexes[doc.id]
                      const status = index?.extract_status
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between gap-3 rounded-lg border p-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatBytesPublic(doc.file_size || 0)}
                                {index?.char_count
                                  ? ` · ${index.char_count.toLocaleString()} chars`
                                  : ''}
                                {doc.created_at
                                  ? ` · ${new Date(doc.created_at).toLocaleString()}`
                                  : ''}
                                {index?.extract_error ? ` · ${index.extract_error}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Badge variant={statusVariant(status)}>
                              {status ? extractStatusLabel(status) : 'File only'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={reindexingId === doc.id}
                              onClick={() => void handleReindex(doc)}
                              aria-label={`Re-index ${doc.file_name}`}
                              title="Re-index text"
                            >
                              {reindexingId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={deletingId === doc.id}
                              onClick={() => void handleDelete(doc.id)}
                              aria-label={`Delete ${doc.file_name}`}
                            >
                              {deletingId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'agent_footer') {
            return (
              <Card className="h-full overflow-hidden">
                <CardContent className="flex h-full flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm text-muted-foreground">
                    Indexed text is searchable here and via Automation Agent (
                    <code className="text-xs">search_automation_documents</code>).
                  </p>
                  {onOpenAgent && (
                    <Button variant="outline" size="sm" onClick={onOpenAgent}>
                      Ask Automation Agent
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
