import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (barcode: string) => void
}

/**
 * Camera barcode scanner (UPC / EAN). Uses html5-qrcode — works in Safari PWA with camera permission.
 */
export function BarcodeScannerDialog({ open, onOpenChange, onScan }: Props) {
  const hostId = 'katana-barcode-reader'
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const handledRef = useRef(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    handledRef.current = false
    setError(null)
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
          verbose: false,
        })
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 8,
            qrbox: { width: 260, height: 140 },
            aspectRatio: 1.777,
          },
          (decoded) => {
            const code = decoded.replace(/\D/g, '')
            if (!/^\d{8,14}$/.test(code) || handledRef.current) return
            handledRef.current = true
            onScan(code)
            onOpenChange(false)
          },
          () => {
            // ignore frame-level “not found”
          },
        )
        if (!cancelled) setStarting(false)
      } catch (err) {
        if (cancelled) return
        setStarting(false)
        const msg =
          err instanceof Error && /NotAllowedError|Permission/i.test(err.message)
            ? 'Camera permission is needed to scan barcodes'
            : 'Could not start the camera — try typing the barcode instead'
        setError(msg)
        toast.error(msg)
      }
    }

    // Let the dialog mount the reader div first
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
  }, [open, onOpenChange, onScan])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0">
        <DialogHeader className="space-y-1 px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Scan barcode
          </DialogTitle>
          <DialogDescription className="text-sm">
            Point at a UPC or EAN on the package. We’ll fill macros from Open Food Facts.
          </DialogDescription>
        </DialogHeader>
        <div className="relative mx-4 mb-3 overflow-hidden rounded-2xl bg-black">
          <div id={hostId} className="min-h-[240px] w-full overflow-hidden [&_video]:object-cover" />
          {starting ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : null}
        </div>
        {error ? <p className="px-4 pb-2 text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-border/60 px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
