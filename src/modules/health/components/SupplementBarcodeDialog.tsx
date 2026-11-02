import { FormEvent, useEffect, useRef, useState } from 'react'
import { Loader2, ScanBarcode } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  acceptCameraCode,
  fetchSupplementBarcode,
  InvalidBarcodeError,
  normalizeProductBarcode,
  type SupplementMatch,
} from '@/lib/supplements/barcode'
import { liveBarcodeDetector } from '@/lib/supplements/barcode-detector'

type Issue = 'permission' | 'camera' | 'unreadable' | 'invalid' | 'network'

const ISSUE_TEXT: Record<Issue, string> = {
  permission: 'Camera access is off. Type the barcode or choose a photo.',
  camera: 'Camera isn’t available. Type the barcode or choose a photo.',
  unreadable: 'Couldn’t read a barcode in that photo. Try again or enter the numbers.',
  invalid: 'That doesn’t look like a product barcode.',
  network: 'Couldn’t look up that barcode. Check your connection and try again.',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFound: (match: SupplementMatch) => void
  onNotFound: () => void
}

export function SupplementBarcodeDialog({ open, onOpenChange, onFound, onNotFound }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const busyRef = useRef(false)
  const lastCamera = useRef<string | null>(null)
  const lookupRef = useRef<(raw: string) => void>(() => {})
  const openRef = useRef(open)
  openRef.current = open
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState(false)
  const [issue, setIssue] = useState<Issue | null>(null)

  useEffect(() => {
    if (open) return
    setManual('')
    setBusy(false)
    setLive(false)
    setIssue(null)
    busyRef.current = false
    lastCamera.current = null
  }, [open])

  useEffect(() => {
    if (!open) return
    const video = videoRef.current
    const detector = liveBarcodeDetector()
    if (!detector || !video || !navigator.mediaDevices?.getUserMedia) return

    let cancelled = false
    let stream: MediaStream | null = null
    let timer = 0

    const stop = () => {
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      if (video.srcObject) video.srcObject = null
    }

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        })
        if (cancelled) {
          stop()
          return
        }
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        setLive(true)
        const tick = async () => {
          if (cancelled) return
          try {
            if (!busyRef.current) {
              const codes = await detector.detect(video)
              for (const code of codes) {
                const next = acceptCameraCode(lastCamera.current, code.rawValue || '')
                if (!next) continue
                lastCamera.current = next
                lookupRef.current(next)
                break
              }
            }
          } catch {
            // A single frame can fail while the camera is still starting.
          }
          if (!cancelled) timer = window.setTimeout(() => void tick(), 280)
        }
        void tick()
      } catch (err) {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ''
        setIssue(name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'permission' : 'camera')
        setLive(false)
      }
    })()

    return () => {
      cancelled = true
      stop()
    }
  }, [open])

  async function runLookup(raw: string) {
    if (busyRef.current) return
    const code = normalizeProductBarcode(raw)
    if (!code) {
      setIssue('invalid')
      return
    }
    busyRef.current = true
    setBusy(true)
    setIssue(null)
    try {
      const result = await fetchSupplementBarcode(code)
      if (!openRef.current) return
      if (result.status === 'not_found') {
        onNotFound()
        onOpenChange(false)
        return
      }
      onFound(result.match)
      onOpenChange(false)
    } catch (err) {
      if (!openRef.current) return
      setIssue(err instanceof InvalidBarcodeError ? 'invalid' : 'network')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  lookupRef.current = (raw: string) => {
    void runLookup(raw)
  }

  async function onPhoto(file: File | undefined) {
    if (!file || busyRef.current) return
    if (!file.type.startsWith('image/')) {
      setIssue('unreadable')
      return
    }
    busyRef.current = true
    setBusy(true)
    setIssue(null)
    try {
      const { decodeBarcodeFromFile } = await import('@/lib/supplements/decode-barcode')
      const code = await decodeBarcodeFromFile(file)
      busyRef.current = false
      if (!code) {
        setIssue('unreadable')
        setBusy(false)
        return
      }
      await runLookup(code)
    } catch {
      busyRef.current = false
      setBusy(false)
      setIssue('unreadable')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function onManual(e: FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    void runLookup(manual)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="gap-3 p-4 sm:max-w-md">
        <DialogHeader className="space-y-1 pr-6 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanBarcode className="h-4 w-4" />
            Scan barcode
          </DialogTitle>
          <DialogDescription className="text-sm">
            Point at the barcode on the bottle, or type the numbers. You can review the name before
            adding it.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => void onPhoto(e.target.files?.[0])}
        />

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-secondary/40">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className={live ? 'max-h-52 w-full bg-black object-contain' : 'hidden'}
          />
          {live ? null : (
            <button
              type="button"
              className="flex h-36 w-full flex-col items-center justify-center gap-2 px-4 text-sm text-muted-foreground hover:bg-secondary/60"
              onClick={() => fileRef.current?.click()}
            >
              <ScanBarcode className="h-8 w-8" />
              Scan with camera
            </button>
          )}
        </div>

        {live ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            Use a photo instead
          </Button>
        ) : null}

        <form onSubmit={onManual} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Barcode number"
            aria-label="Barcode number"
            disabled={busy}
          />
          <Button type="submit" size="sm" variant="outline" disabled={busy || !manual.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Look up
          </Button>
        </form>

        {issue ? (
          <p className="text-sm text-muted-foreground" role="status">
            {ISSUE_TEXT[issue]}
          </p>
        ) : null}

        {issue === 'network' ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              lastCamera.current = null
              setIssue(null)
            }}
          >
            Try again
          </Button>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
