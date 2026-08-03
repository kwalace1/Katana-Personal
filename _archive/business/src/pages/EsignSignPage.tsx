import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertCircle, PenLine, ShieldCheck } from 'lucide-react'
import {
  fetchSigningFile,
  fetchSigningPacket,
  submitSignature,
} from '@/lib/esign-api'
import type { EsignSigningPacket } from '@/lib/esign-types'
import { EsignSignaturePad } from '@/components/esign/EsignSignaturePad'
import { EsignSigningViewer } from '@/components/esign/EsignSigningViewer'
import { stampEsignFieldsOnPdf } from '@/lib/esign-pdf'
import { pageEnterSubtle, springSnappy } from '@/lib/motion-ui'

export default function EsignSignPage() {
  const { token } = useParams<{ token: string }>()
  const [packet, setPacket] = useState<EsignSigningPacket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let objectUrl: string | null = null
    ;(async () => {
      try {
        const data = await fetchSigningPacket(token)
        setPacket(data)
        setDone(data.alreadySigned)
        const ordered = [...data.fields].sort(
          (a, b) => a.page_index - b.page_index || a.y_pct - b.y_pct || a.x_pct - b.x_pct,
        )
        setActiveFieldId(ordered[0]?.id ?? null)
        const bytes = await fetchSigningFile(token)
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        setPdfUrl(objectUrl)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load signing request')
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [token])

  const brandName = useMemo(
    () => packet?.organization?.name?.trim() || 'Secure signature request',
    [packet],
  )
  const brandLogo = packet?.organization?.logoUrl ?? null

  const handleSign = async (payload: {
    signatureText?: string
    signatureImageDataUrl?: string
  }) => {
    if (!token || !packet) return
    setSubmitting(true)
    setError(null)
    try {
      const original = await fetchSigningFile(token)
      const printedName =
        payload.signatureText?.trim() || packet.signer.name.trim() || 'Signed'
      const stamped = await stampEsignFieldsOnPdf(original, {
        fields: packet.fields,
        signatureImageDataUrl: payload.signatureImageDataUrl,
        signatureText: payload.signatureText,
        printedName,
      })
      await submitSignature({
        token,
        signatureText: payload.signatureText,
        signatureImageDataUrl: payload.signatureImageDataUrl,
        signedPdfBytes: stamped,
      })

      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      const stampedCopy = new Uint8Array(stamped)
      const stampedUrl = URL.createObjectURL(new Blob([stampedCopy], { type: 'application/pdf' }))
      setPdfUrl(stampedUrl)
      setPacket({ ...packet, alreadySigned: true })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading signing request…
      </div>
    )
  }

  if (error && !packet) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-destructive/40 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Cannot open document
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!packet) return null

  return (
    <div className="min-h-screen relative">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 90% 50% at 50% -5%, hsl(var(--primary) / 0.12), transparent 55%), linear-gradient(to bottom, hsl(var(--background)), hsl(var(--muted) / 0.35))',
        }}
      />

      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {brandLogo ? (
              <img
                src={brandLogo}
                alt=""
                className="h-10 w-10 rounded-xl object-contain bg-white border shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-primary/25">
                <PenLine className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold leading-none truncate tracking-tight">{brandName}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Secure signature request
              </p>
            </div>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase tracking-wide">
            Katana E-Sign
          </Badge>
        </div>
      </header>

      <motion.main
        className="mx-auto max-w-5xl px-4 py-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"
        {...pageEnterSubtle}
      >
        <Card className="border-border/70 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="tracking-tight">{packet.document.title}</CardTitle>
              <Badge variant="outline" className="font-normal">
                {packet.document.file_name}
              </Badge>
            </div>
            {packet.document.description && (
              <CardDescription className="mt-1">{packet.document.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-5">
            {pdfUrl ? (
              done || packet.fields.length === 0 ? (
                <iframe
                  title="Document preview"
                  src={pdfUrl}
                  className="w-full h-[70vh] rounded-xl border bg-white shadow-inner"
                />
              ) : (
                <EsignSigningViewer
                  pdfUrl={pdfUrl}
                  fields={packet.fields}
                  activeFieldId={activeFieldId}
                  onSelectField={setActiveFieldId}
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">Preview unavailable.</p>
            )}
            {done && (
              <p className="text-xs text-muted-foreground mt-3">
                Your signature, name, and date are stamped on the document above.
              </p>
            )}
          </CardContent>
        </Card>

        <motion.div
          className="h-fit lg:sticky lg:top-20"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSnappy, delay: 0.05 }}
        >
          <Card className="border-border/70 shadow-md overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-primary/10 via-transparent to-transparent border-b border-border/50">
              <CardTitle className="text-base tracking-tight">Sign as {packet.signer.name}</CardTitle>
              <CardDescription>
                {packet.fields.length > 0
                  ? 'Review the highlighted boxes, then draw or type your signature. It will be applied to every place marked for you.'
                  : 'Review the document, then draw or type your signature.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              {packet.cancelled && (
                <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  This document has been cancelled.
                </p>
              )}
              {packet.expired && !done && (
                <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  This signing request has expired.
                </p>
              )}
              {done ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-2">
                  <p className="font-medium flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    You have signed this document
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Thank you. You can close this window.
                  </p>
                </div>
              ) : (
                !packet.cancelled &&
                !packet.expired && (
                  <EsignSignaturePad
                    defaultName={packet.signer.name}
                    submitting={submitting}
                    onSubmit={(payload) => void handleSign(payload)}
                  />
                )
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>
          </Card>
        </motion.div>
      </motion.main>

      <footer className="py-8 text-center text-[11px] text-muted-foreground">
        Powered by Katana E-Sign · Sent by {brandName}
      </footer>
    </div>
  )
}
