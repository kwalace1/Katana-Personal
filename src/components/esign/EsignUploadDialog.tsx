import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
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
} from '@/components/ui/dialog'
import { Plus, Trash2, Upload, FileText } from 'lucide-react'
import type { CreateEsignDocumentInput, EsignTemplate } from '@/lib/esign-types'
import { listEsignTemplates } from '@/lib/esign-api'
import { getAllClients } from '@/lib/customer-success-api'
import type { Client } from '@/lib/customer-success-api'
import { getAllProjects } from '@/lib/project-data-supabase'
import type { Project } from '@/lib/project-data'

interface EsignUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CreateEsignDocumentInput) => Promise<void>
  initialTemplateId?: string | null
}

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function EsignUploadDialog({
  open,
  onOpenChange,
  onSubmit,
  initialTemplateId = null,
}: EsignUploadDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [expiresInDays, setExpiresInDays] = useState('14')
  const [reminderEveryDays, setReminderEveryDays] = useState('3')
  const [file, setFile] = useState<File | null>(null)
  const [signers, setSigners] = useState([{ name: '', email: '' }])
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [templates, setTemplates] = useState<EsignTemplate[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void (async () => {
      const [t, c, p] = await Promise.all([
        listEsignTemplates().catch(() => []),
        getAllClients().catch(() => []),
        getAllProjects().catch(() => []),
      ])
      setTemplates(t)
      setClients(c)
      setProjects(p)
      if (initialTemplateId) {
        const match = t.find((x) => x.id === initialTemplateId)
        setTemplateId(initialTemplateId)
        if (match?.default_title) setTitle(match.default_title)
        if (match?.description) setDescription(match.description)
        if (match && match.default_signer_count > 1) {
          setSigners(Array.from({ length: match.default_signer_count }, () => ({ name: '', email: '' })))
        }
      }
    })()
  }, [open, initialTemplateId])

  const canSubmit = useMemo(
    () => !!title.trim() && !!file && signers.some((s) => s.name.trim()),
    [title, file, signers],
  )

  const reset = () => {
    setTitle('')
    setDescription('')
    setExpiresInDays('14')
    setReminderEveryDays('3')
    setFile(null)
    setSigners([{ name: '', email: '' }])
    setClientId('')
    setProjectId('')
    setTemplateId('')
    setError(null)
  }

  const handleTemplateChange = (id: string) => {
    setTemplateId(id)
    const match = templates.find((t) => t.id === id)
    if (!match) return
    if (match.default_title) setTitle(match.default_title)
    if (match.description) setDescription(match.description)
    if (match.default_signer_count > signers.length) {
      setSigners((prev) => [
        ...prev,
        ...Array.from({ length: match.default_signer_count - prev.length }, () => ({
          name: '',
          email: '',
        })),
      ])
    }
  }

  const handleSubmit = async () => {
    if (!file || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        expiresInDays: expiresInDays ? Number(expiresInDays) : null,
        reminderEveryDays: reminderEveryDays ? Number(reminderEveryDays) : null,
        file,
        signers: signers.filter((s) => s.name.trim()),
        clientId: clientId || null,
        projectId: projectId || null,
        templateId: templateId || null,
      })
      reset()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent
        size="default"
        className="sm:max-w-xl gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="space-y-1.5 border-b px-6 py-5 pr-12 text-left">
          <DialogTitle>New signature request</DialogTitle>
          <DialogDescription>
            Upload a document, add who needs to sign, then place signature boxes on the next screen.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6 px-6 py-5">
          <section className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="esign-title">Document title</Label>
              <Input
                id="esign-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Offer letter — Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="esign-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="esign-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="esign-file">Document</Label>
            <label
              htmlFor="esign-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-7 text-center transition-colors hover:bg-muted/50"
            >
              {file ? (
                <>
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium break-all px-2">{file.name}</p>
                    <p className="text-xs text-muted-foreground">Click to choose a different file</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Choose a file</p>
                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG, WEBP, or DOCX</p>
                  </div>
                </>
              )}
              <Input
                id="esign-file"
                type="file"
                className="sr-only"
                accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Optional links & timing
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="esign-client">Customer</Label>
                <select
                  id="esign-client"
                  className={selectClassName}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">None</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="esign-project">Project</Label>
                <select
                  id="esign-project"
                  className={selectClassName}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="esign-template">Template</Label>
                <select
                  id="esign-template"
                  className={selectClassName}
                  value={templateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="">None</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="esign-expires">Expires (days)</Label>
                <Input
                  id="esign-expires"
                  type="number"
                  min={1}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="esign-remind">Remind every</Label>
                <Input
                  id="esign-remind"
                  type="number"
                  min={1}
                  value={reminderEveryDays}
                  onChange={(e) => setReminderEveryDays(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Signers</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Email is used when you send the request</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setSigners((prev) => [...prev, { name: '', email: '' }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {signers.map((signer, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
                >
                  <Input
                    placeholder="Full name"
                    value={signer.name}
                    onChange={(e) =>
                      setSigners((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)),
                      )
                    }
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={signer.email}
                    onChange={(e) =>
                      setSigners((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, email: e.target.value } : s)),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="justify-self-end"
                    disabled={signers.length === 1}
                    onClick={() => setSigners((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>

        <DialogFooter className="border-t bg-muted/20 px-6 py-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
            <Upload className="h-4 w-4 mr-2" />
            {submitting ? 'Uploading…' : 'Continue to placement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
