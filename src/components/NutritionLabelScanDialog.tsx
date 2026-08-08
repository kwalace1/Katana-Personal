import { useRef, useState } from 'react'
import { Loader2, ScanText } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { NutritionLabelEstimate } from '@/lib/food/nutrition-label'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRead: (label: NutritionLabelEstimate) => void
}

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

async function fileToCompressedDataUrl(file: File): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Canvas unavailable')
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
  return { base64, mimeType: 'image/jpeg' }
}

export function NutritionLabelScanDialog({ open, onOpenChange, onRead }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setPreview(null)
    setPendingFile(null)
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function onPickFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose a photo of the Nutrition Facts label')
      return
    }
    setPendingFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function runRead() {
    if (!pendingFile || busy) return
    setBusy(true)
    try {
      const { base64, mimeType } = await fileToCompressedDataUrl(pendingFile)
      const res = await fetch('/api/food-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, mode: 'label' }),
      })
      const data = (await res.json().catch(() => null)) as {
        label?: NutritionLabelEstimate
        error?: string
      } | null
      if (!res.ok || !data?.label) {
        throw new Error(data?.error || 'Could not read label')
      }
      onRead(data.label)
      handleOpenChange(false)
      toast.success(`Read ${data.label.name}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not read label'
      toast.error(
        /OPENROUTER|not configured/i.test(msg)
          ? 'Label scan needs cloud AI — check OpenRouter setup'
          : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden p-0">
        <DialogHeader className="space-y-1 px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanText className="h-4 w-4" />
            Scan Nutrition Facts
          </DialogTitle>
          <DialogDescription className="text-sm">
            Point at the Nutrition Facts panel on a package. We’ll pull calories and macros for one
            serving.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />

        <div className="mx-4 mb-3 overflow-hidden rounded-2xl border border-border/60 bg-secondary/40">
          {preview ? (
            <img src={preview} alt="Label preview" className="max-h-72 w-full object-contain bg-black" />
          ) : (
            <button
              type="button"
              className="flex h-48 w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-secondary/60"
              onClick={() => fileRef.current?.click()}
            >
              <ScanText className="h-8 w-8" />
              Take or choose a label photo
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {preview ? 'Retake' : 'Add photo'}
          </Button>
          <Button
            type="button"
            className="flex-1 gap-2"
            disabled={!pendingFile || busy}
            onClick={() => void runRead()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? 'Reading…' : 'Read label'}
          </Button>
        </div>
        <p className="px-4 pb-4 text-[0.7rem] text-muted-foreground">
          Fill the whole label in frame and keep it sharp. You can still edit macros before saving.
        </p>
      </DialogContent>
    </Dialog>
  )
}
