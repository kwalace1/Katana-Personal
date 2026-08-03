import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileUp, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'
import { formatShortDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { documentsApi, storageApi } from '../api'
import type { DocumentRecord } from '../types'
import { ShareWithFriendsButton } from '@/components/ShareWithFriendsButton'

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function fileGroup(mime: string): string {
  if (mime.startsWith('image/')) return 'Images'
  if (mime.startsWith('text/') || mime.includes('json') || mime.includes('markdown')) return 'Text'
  if (mime.includes('pdf')) return 'PDFs'
  return 'Other'
}

export default function DocumentsPage() {
  const { user } = useAuth()
  const userId = user!.id
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<DocumentRecord | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const { tick, refresh } = useLocalRefresh()
  const [params, setParams] = useSearchParams()

  const docs = useMemo(() => {
    void tick
    const all = documentsApi.list(userId)
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter((d) => d.name.toLowerCase().includes(q))
  }, [userId, query, tick])

  useEffect(() => {
    const id = params.get('id')
    if (id) {
      const doc = documentsApi.get(userId, id)
      if (doc) setPreview(doc)
    }
  }, [params, userId])

  const grouped = useMemo(() => {
    const map = new Map<string, DocumentRecord[]>()
    for (const doc of docs) {
      const g = fileGroup(doc.mime_type)
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(doc)
    }
    return [...map.entries()]
  }, [docs])

  async function onFiles(files: FileList | File[] | null) {
    if (!files || (Array.isArray(files) ? files.length === 0 : files.length === 0)) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        const validation = storageApi.validateUploadFile(file)
        if (!validation.valid) {
          toast.error(validation.error)
          continue
        }
        await documentsApi.upload(userId, file)
      }
      refresh()
      toast.success('Uploaded')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const canPreviewInline =
    preview &&
    (preview.mime_type.startsWith('image/') ||
      preview.mime_type.startsWith('text/') ||
      preview.mime_type.includes('json') ||
      preview.mime_type.includes('pdf'))

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader
        title="Documents"
        description="Files that matter to you."
        eyebrow="Life"
        actions={
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => void onFiles(e.target.files)}
            />
            <Button className="gap-2" disabled={busy} onClick={() => inputRef.current?.click()}>
              <FileUp className="h-4 w-4" />
              {busy ? 'Adding…' : 'Add files'}
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div
        className={cn(
          'mb-6 rounded-2xl border border-dashed border-border/70 bg-secondary/30 p-8 text-center transition',
          dragOver && 'border-primary bg-primary/5',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void onFiles(e.dataTransfer.files)
        }}
      >
        <p className="text-sm text-muted-foreground">Drop files here, or use Add files.</p>
        <p className="mt-1 text-xs text-muted-foreground">Stays on this device · up to 4 MB each</p>
      </div>

      {busy ? <LoadingState message="Adding files…" className="mb-4" fullPage={false} /> : null}
      {error ? (
        <div className="mb-4">
          <ErrorState title="Couldn’t add that file" message={error} fullPage={false} />
        </div>
      ) : null}

      {docs.length === 0 && !busy ? (
        <EmptyState
          title="No files yet"
          description="Add something important — it’ll stay on this device."
          action={
            <Button onClick={() => inputRef.current?.click()}>
              <FileUp className="mr-2 h-4 w-4" />
              Add files
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([group, items]) => (
            <div key={group}>
              <p className="kp-section-label mb-2">{group}</p>
              <ul className="space-y-2">
                {items.map((doc) => (
                  <li key={doc.id} className="kp-surface flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      {renamingId === doc.id ? (
                        <Input
                          autoFocus
                          defaultValue={doc.name}
                          onBlur={(e) => {
                            const name = e.target.value.trim()
                            if (name && name !== doc.name) {
                              documentsApi.update(userId, doc.id, { name })
                              refresh()
                            }
                            setRenamingId(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="block w-full truncate text-left font-medium hover:underline"
                          onClick={() => {
                            setPreview(doc)
                            setParams({ id: doc.id })
                          }}
                          onDoubleClick={() => setRenamingId(doc.id)}
                        >
                          {doc.name}
                        </button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(doc.size)} · {formatShortDate(doc.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <ShareWithFriendsButton
                        kind="file"
                        title={doc.name}
                        data={{ mime_type: doc.mime_type, size: doc.size, localDocId: doc.id }}
                      />
                      <Button size="sm" variant="outline" asChild>
                        <a href={doc.data_url} download={doc.name}>
                          Download
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          documentsApi.remove(userId, doc.id)
                          if (preview?.id === doc.id) {
                            setPreview(null)
                            setParams({})
                          }
                          refresh()
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) {
            setPreview(null)
            setParams({})
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && canPreviewInline ? (
            preview.mime_type.startsWith('image/') ? (
              <img src={preview.data_url} alt={preview.name} className="max-h-[60vh] w-full rounded-xl object-contain" />
            ) : preview.mime_type.includes('pdf') ? (
              <iframe title={preview.name} src={preview.data_url} className="h-[60vh] w-full rounded-xl" />
            ) : (
              <TextPreview dataUrl={preview.data_url} />
            )
          ) : preview ? (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">Preview isn’t available for this type.</p>
              <Button asChild>
                <a href={preview.data_url} download={preview.name}>
                  Download
                </a>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

function TextPreview({ dataUrl }: { dataUrl: string }) {
  const [text, setText] = useState('Loading…')
  useEffect(() => {
    fetch(dataUrl)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText('Could not read file.'))
  }, [dataUrl])
  return (
    <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl bg-secondary/50 p-4 text-xs">
      {text}
    </pre>
  )
}
