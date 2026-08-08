/**
 * Camera barcode scanner with live detect + manual Capture (frame decode).
 * Capture helps when continuous scanning is flaky on iOS / dim lighting.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Loader2, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Html5Qrcode } from 'html5-qrcode'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcode: string) => void
}

function normalizeBarcode(raw: string): string | null {
  const code = raw.replace(/\D/g, '')
  return /^\d{8,14}$/.test(code) ? code : null
}

export function BarcodeScannerDialog({ open, onOpenChange, onScan }: Props) {
  const hostId = 'katana-barcode-reader'
  const captureHostId = 'katana-barcode-capture-tmp'
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)
  const [starting, setStarting] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')

  const finish = useCallback(
    (code: string) => {
      if (handledRef.current) return
      handledRef.current = true
      onScan(code)
      onOpenChange(false)
    },
    [onOpenChange, onScan],
  )

  useEffect(() => {
    if (!open) return
    handledRef.current = false
    setError(null)
    setManual('')
    setStarting(true)
    let cancelled = false

    async function start() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode(hostId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        })
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            // Wider box — easier to frame UPC labels on phone
            qrbox: (viewW, viewH) => ({
              width: Math.floor(Math.min(viewW * 0.92, 360)),
              height: Math.floor(Math.min(viewH * 0.35, 160)),
            }),
            aspectRatio: 1.777,
            disableFlip: false,
          },
          (decoded) => {
            const code = normalizeBarcode(decoded)
            if (code) finish(code)
          },
          () => undefined,
        )
        if (!cancelled) setStarting(false)
      } catch (err) {
        if (cancelled) return
        setStarting(false)
        const msg =
          err instanceof Error && /NotAllowedError|Permission/i.test(err.message)
            ? 'Camera permission is needed to scan barcodes'
            : 'Could not start the camera — type the barcode below'
        setError(msg)
        toast.error(msg)
      }
    }

    const t = window.setTimeout(() => void start(), 80)
    return () => {
      cancelled = true
      window.clearTimeout(t)
      const scanner = scannerRef.current
      scannerRef.current = null
      if (scanner) {
        void scanner.stop().catch(() => undefined)
      }
    }
  }, [open, finish])

  async function captureFrame() {
    if (capturing || handledRef.current) return
    const video = document.querySelector(`#${hostId} video`) as HTMLVideoElement | null
    if (!video || video.videoWidth < 8) {
      toast.error('Camera not ready yet')
      return
    }

    setCapturing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.drawImage(video, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.95),
      )
      if (!blob) throw new Error('Capture failed')

      const file = new File([blob], 'barcode-capture.jpg', { type: 'image/jpeg' })
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')

      // Decode on a separate instance so the live preview keeps running
      let tmp = document.getElementById(captureHostId)
      if (!tmp) {
        tmp = document.createElement('div')
        tmp.id = captureHostId
        tmp.className = 'hidden'
        document.body.appendChild(tmp)
      }

      const decoder = new Html5Qrcode(captureHostId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
        ],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      })
      try {
        const decoded = await decoder.scanFile(file, false)
        const code = normalizeBarcode(decoded)
        if (!code) {
          toast.error('No barcode found — hold steadier and try Capture again')
          return
        }
        finish(code)
      } finally {
        try {
          decoder.clear()
        } catch {
          // ignore
        }
      }
    } catch {
      toast.error('No barcode found — move closer, add light, then tap Capture')
    } finally {
      setCapturing(false)
    }
  }

  function submitManual() {
    const code = normalizeBarcode(manual)
    if (!code) {
      toast.error('Enter an 8–14 digit barcode')
      return
    }
    finish(code)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0">
        <DialogHeader className="space-y-1 px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Scan barcode
          </DialogTitle>
          <DialogDescription className="text-sm">
            Line up the barcode, then tap Capture if it doesn’t auto-detect.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mx-4 mb-2 overflow-hidden rounded-2xl bg-black">
          <div id={hostId} className="min-h-[260px] w-full overflow-hidden [&_video]:object-cover" />
          {starting ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : null}
        </div>

        <div className="px-4 pb-2">
          <Button
            type="button"
            className="h-12 w-full gap-2 text-base"
            disabled={starting || capturing || Boolean(error)}
            onClick={() => void captureFrame()}
          >
            {capturing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ScanLine className="h-5 w-5" />
            )}
            {capturing ? 'Reading…' : 'Capture barcode'}
          </Button>
        </div>

        {error ? <p className="px-4 pb-2 text-sm text-destructive">{error}</p> : null}

        <div className="space-y-2 border-t border-border/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">Or type the digits</p>
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="012345678905"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="font-mono"
              aria-label="Barcode digits"
            />
            <Button type="button" variant="secondary" onClick={submitManual}>
              Use
            </Button>
          </div>
          <div className="flex justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
