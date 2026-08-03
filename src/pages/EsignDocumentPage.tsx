import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MotionPage } from '@/components/motion-page'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Send,
  Trash2,
  Ban,
  ExternalLink,
  Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  buildSigningUrl,
  cancelEsignDocument,
  deleteEsignDocument,
  getEsignDocument,
  getEsignFileSignedUrl,
  isEsignSchemaError,
  markEsignReminded,
  replaceEsignFields,
  saveDocumentAsTemplate,
  sendEsignDocument,
  updateEsignSignerEmail,
} from '@/lib/esign-api'
import {
  isEsignEmailConfigured,
  sendEsignSigningEmails,
  sendEsignSigningRequestEmail,
} from '@/lib/esign-email'
import type { EsignDocumentWithRelations, EsignSigner } from '@/lib/esign-types'
import { ESIGN_STATUS_LABELS } from '@/lib/esign-types'
import { EsignFieldPlacer, type DraftField } from '@/components/esign/EsignFieldPlacer'
import { EsignSaveTemplateDialog } from '@/components/esign/EsignSaveTemplateDialog'
import { formatDateOnly } from '@/lib/due-date-utils'
import { useAuth } from '@/contexts/AuthContext'

export default function EsignDocumentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, organization } = useAuth()
  const [doc, setDoc] = useState<EsignDocumentWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [draftFields, setDraftFields] = useState<DraftField[]>([])
  const [saving, setSaving] = useState(false)
  const [emailingId, setEmailingId] = useState<string | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      const data = await getEsignDocument(id)
      if (!data) {
        setError('Document not found')
        setDoc(null)
        return
      }
      setDoc(data)
      const url = await getEsignFileSignedUrl(data.signed_file_path || data.file_path)
      setPdfUrl(url)
    } catch (e) {
      if (isEsignSchemaError(e) || (e instanceof Error && e.message === 'ESIGN_SCHEMA_MISSING')) {
        setError('E-Sign schema missing. Run supabase-esign-schema.sql')
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load document')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleSaveFields = async () => {
    if (!doc) return
    setSaving(true)
    try {
      const saved = await replaceEsignFields(
        doc.id,
        draftFields.map(({ localId: _id, ...rest }) => rest),
      )
      setDoc({ ...doc, fields: saved })
      toast.success('Field placement saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async () => {
    if (!doc) return
    try {
      await handleSaveFields()
      const updated = await sendEsignDocument(doc.id)
      const nextDoc = { ...doc, ...updated }
      setDoc(nextDoc)

      if (!isEsignEmailConfigured()) {
        toast.success('Document sent — copy signing links below (EmailJS not configured)')
        return
      }

      const result = await sendEsignSigningEmails({
        signers: nextDoc.signers.filter((s) => !s.signed_at),
        documentTitle: nextDoc.title,
        buildUrl: buildSigningUrl,
        organizationName: organization?.name,
        requesterName: profile?.full_name || profile?.email || undefined,
        expiresAt: nextDoc.expires_at,
      })

      if (result.failures.length > 0) {
        toast.error(
          `Sent ${result.sent}, failed ${result.failures.length}. ${result.failures[0]?.error ?? ''}`,
        )
      } else if (result.sent === 0) {
        toast.success('Marked as sent — add signer emails to notify them, or copy links below')
      } else {
        toast.success(
          `Sent ${result.sent} signing email${result.sent === 1 ? '' : 's'}` +
            (result.skipped ? ` (${result.skipped} without email skipped)` : ''),
        )
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    }
  }

  const handleEmailSigner = async (signer: EsignSigner) => {
    if (!doc) return
    if (!signer.email?.trim()) {
      toast.error('This signer has no email address')
      return
    }
    if (!isEsignEmailConfigured()) {
      toast.error('EmailJS is not configured for E-Sign')
      return
    }
    setEmailingId(signer.id)
    try {
      await sendEsignSigningRequestEmail({
        toEmail: signer.email,
        signerName: signer.name,
        documentTitle: doc.title,
        signingUrl: buildSigningUrl(signer.signing_token),
        organizationName: organization?.name,
        requesterName: profile?.full_name || profile?.email || undefined,
        expiresAt: doc.expires_at,
      })
      if (doc.status === 'draft') {
        const updated = await sendEsignDocument(doc.id)
        setDoc({ ...doc, ...updated })
      }
      toast.success(`Email sent to ${signer.email}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send email')
    } finally {
      setEmailingId(null)
    }
  }

  const handleCancel = async () => {
    if (!doc) return
    await cancelEsignDocument(doc.id)
    toast.success('Cancelled')
    await refresh()
  }

  const handleDelete = async () => {
    if (!doc) return
    if (!window.confirm('Delete this document and all signing data?')) return
    await deleteEsignDocument(doc.id)
    toast.success('Deleted')
    navigate('/esign')
  }

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(buildSigningUrl(token))
    toast.success('Signing link copied')
  }

  const handleSaveSignerEmail = async (signer: EsignSigner, email: string) => {
    if (!doc) return
    try {
      const updated = await updateEsignSignerEmail(signer.id, email)
      setDoc({
        ...doc,
        signers: doc.signers.map((s) => (s.id === signer.id ? updated : s)),
      })
      toast.success('Signer email updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update email')
    }
  }

  if (loading) {
    return (
      <MotionPage className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading document…
      </MotionPage>
    )
  }

  if (error || !doc) {
    return (
      <MotionPage className="p-6 space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/esign">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <p className="text-destructive">{error || 'Not found'}</p>
      </MotionPage>
    )
  }

  const canEditFields = doc.status === 'draft' || doc.status === 'pending'
  const fieldCount = draftFields.length || doc.fields.length
  const signersMissingEmail = doc.signers.filter((s) => !s.signed_at && !s.email?.trim()).length
  const signedCount = doc.signers.filter((s) => s.signed_at).length
  const checklist = [
    { ok: fieldCount > 0, label: 'Signature boxes placed on the document' },
    { ok: doc.signers.length > 0, label: 'At least one signer added' },
    {
      ok: signersMissingEmail === 0,
      label:
        signersMissingEmail === 0
          ? 'All pending signers have email addresses'
          : `${signersMissingEmail} signer(s) still need an email (or use copy link)`,
    },
    {
      ok: doc.status !== 'draft',
      label: doc.status === 'draft' ? 'Ready to send for signing' : 'Request has been sent',
    },
  ]

  return (
    <MotionPage className="p-6 space-y-6">
      {doc.template_id && canEditFields && (
        <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3.5 text-sm shadow-sm">
          <p className="font-medium tracking-tight">Setting up a template</p>
          <p className="text-muted-foreground mt-0.5 leading-relaxed">
            Place signature / name / date boxes on the PDF, click <span className="text-foreground font-medium">Save placement</span>, then{' '}
            <span className="text-foreground font-medium">Save as template</span> to lock in this layout for reuse.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/25 p-5 shadow-sm">
        <div className="space-y-2 min-w-0">
          <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
            <Link to="/esign">
              <ArrowLeft className="h-4 w-4 mr-2" />
              All documents
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">{doc.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                doc.status === 'signed'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                  : doc.status === 'cancelled' || doc.status === 'expired'
                    ? 'bg-destructive/10 text-destructive border-destructive/25'
                    : doc.status === 'partially_signed'
                      ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25'
                      : doc.status === 'pending'
                        ? 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/25'
                        : 'bg-muted text-muted-foreground border-border'
              }`}
            >
              {ESIGN_STATUS_LABELS[doc.status]}
            </span>
            <span className="text-xs text-muted-foreground">
              {signedCount}/{doc.signers.length} signed · Created {formatDateOnly(doc.created_at)}
              {doc.expires_at ? ` · Expires ${formatDateOnly(doc.expires_at)}` : ''}
            </span>
          </div>
          {doc.description && <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">{doc.description}</p>}
          {(doc.client_id || doc.project_id) && (
            <p className="text-xs text-muted-foreground">
              {doc.client_id ? (
                <Link className="underline mr-3 hover:text-foreground" to={`/customer-success?client=${doc.client_id}`}>
                  Linked customer
                </Link>
              ) : null}
              {doc.project_id ? (
                <Link className="underline hover:text-foreground" to={`/projects/${doc.project_id}`}>
                  Linked project
                </Link>
              ) : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditFields && (
            <>
              <Button variant="outline" onClick={() => void handleSaveFields()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Save placement
              </Button>
              <Button className="shadow-sm shadow-primary/15" onClick={() => void handleSend()}>
                <Send className="h-4 w-4 mr-2" />
                {doc.status === 'draft' ? 'Send & email signers' : 'Resend emails'}
              </Button>
              {(doc.status === 'pending' || doc.status === 'partially_signed') && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void (async () => {
                      if (!isEsignEmailConfigured()) {
                        toast.error('EmailJS not configured')
                        return
                      }
                      const result = await sendEsignSigningEmails({
                        signers: doc.signers.filter((s) => !s.signed_at),
                        documentTitle: doc.title,
                        buildUrl: buildSigningUrl,
                        organizationName: organization?.name,
                        requesterName: profile?.full_name || profile?.email || undefined,
                        expiresAt: doc.expires_at,
                      })
                      await markEsignReminded(doc.id)
                      toast.success(`Reminded ${result.sent} signer(s)`)
                      await refresh()
                    })()
                  }
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Remind unsigned
                </Button>
              )}
            </>
          )}
          <Button variant="outline" onClick={() => setTemplateOpen(true)} disabled={fieldCount === 0}>
            Save as template
          </Button>
          {doc.status !== 'cancelled' && doc.status !== 'signed' && (
            <Button variant="outline" onClick={() => void handleCancel()}>
              <Ban className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button variant="ghost" className="text-destructive" onClick={() => void handleDelete()}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="py-3 border-b border-border/50 bg-muted/20">
          <CardTitle className="text-sm font-medium tracking-tight">Checklist</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 pt-4 grid gap-2 sm:grid-cols-2">
          {checklist.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5 text-sm rounded-lg border border-transparent px-1 py-0.5">
              <span
                className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${
                  item.ok
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700'
                    : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                {item.ok ? '✓' : ''}
              </span>
              <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Place signature boxes</CardTitle>
          <p className="text-xs text-muted-foreground">
            Zoom in for accuracy. Click to place, drag to move, drag the corner to resize. Then save.
          </p>
        </CardHeader>
        <CardContent>
          {pdfUrl ? (
            <EsignFieldPlacer
              pdfUrl={pdfUrl}
              signers={doc.signers}
              initialFields={doc.fields}
              onChange={setDraftFields}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load PDF preview.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Signers & links</CardTitle>
            <p className="text-xs text-muted-foreground">
              Add emails to send requests, or copy a private link for anyone.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {doc.signers.map((signer) => (
              <div key={signer.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{signer.name}</p>
                  </div>
                  <Badge variant={signer.signed_at ? 'default' : 'outline'}>
                    {signer.signed_at ? 'Signed' : 'Pending'}
                  </Badge>
                </div>
                {!signer.signed_at && (
                  <Input
                    type="email"
                    className="h-8 text-xs"
                    defaultValue={signer.email ?? ''}
                    placeholder="signer@email.com"
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next !== (signer.email ?? '')) {
                        void handleSaveSignerEmail(signer, next)
                      }
                    }}
                  />
                )}
                {signer.signed_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Signed {formatDateOnly(signer.signed_at)}
                    {signer.email ? ` · ${signer.email}` : ''}
                  </p>
                )}
                <div className="flex gap-1">
                  <Input
                    readOnly
                    className="h-8 text-xs"
                    value={buildSigningUrl(signer.signing_token)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 shrink-0"
                    title="Copy link"
                    onClick={() => void copyLink(signer.signing_token)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 shrink-0"
                    title="Open link"
                    asChild
                  >
                    <a href={buildSigningUrl(signer.signing_token)} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 shrink-0"
                    title={signer.email ? 'Email signing link' : 'Add an email first'}
                    disabled={!signer.email || !!signer.signed_at || emailingId === signer.id}
                    onClick={() => void handleEmailSigner(signer)}
                  >
                    {emailingId === signer.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {(doc.signed_file_path || doc.file_path) && pdfUrl && (
            <Button variant="outline" className="w-full" asChild>
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      <EsignSaveTemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        defaultName={`${doc.title} template`}
        defaultDescription={doc.description}
        fieldCount={fieldCount}
        signerCount={doc.signers.length}
        onSave={async ({ name, description }) => {
          if (draftFields.length > 0) {
            const saved = await replaceEsignFields(
              doc.id,
              draftFields.map(({ localId: _id, ...rest }) => rest),
            )
            setDoc({ ...doc, fields: saved })
            await saveDocumentAsTemplate({ ...doc, fields: saved }, name, description)
          } else {
            await saveDocumentAsTemplate(doc, name, description)
          }
          toast.success('Template saved — use it from the E-Sign dashboard')
        }}
      />
    </MotionPage>
  )
}
