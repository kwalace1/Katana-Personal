import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { normalizeSignatureDataUrl } from '@/lib/esign-pdf'

type SigCanvas = {
  clear: () => void
  isEmpty: () => boolean
  toDataURL: (type?: string) => string
  getCanvas: () => HTMLCanvasElement
  getTrimmedCanvas: () => HTMLCanvasElement
}

interface EsignSignaturePadProps {
  defaultName?: string
  onSubmit: (payload: { signatureText?: string; signatureImageDataUrl?: string }) => void
  submitting?: boolean
}

function exportSignaturePng(pad: SigCanvas): string {
  try {
    const trimmed = pad.getTrimmedCanvas()
    if (trimmed.width > 2 && trimmed.height > 2) {
      return trimmed.toDataURL('image/png')
    }
  } catch {
    /* fall through */
  }
  return pad.getCanvas().toDataURL('image/png')
}

export function EsignSignaturePad({ defaultName = '', onSubmit, submitting }: EsignSignaturePadProps) {
  const canvasRef = useRef<SigCanvas | null>(null)
  const [typedName, setTypedName] = useState(defaultName)
  const [mode, setMode] = useState<'draw' | 'type'>('draw')

  const handleSubmit = async () => {
    if (mode === 'draw') {
      const canvas = canvasRef.current
      if (!canvas || canvas.isEmpty()) return
      const raw = exportSignaturePng(canvas)
      const signatureImageDataUrl = await normalizeSignatureDataUrl(raw)
      onSubmit({
        signatureImageDataUrl,
        signatureText: typedName.trim() || defaultName || undefined,
      })
      return
    }
    if (!typedName.trim()) return
    onSubmit({ signatureText: typedName.trim() })
  }

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'draw' | 'type')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw">Draw</TabsTrigger>
          <TabsTrigger value="type">Type</TabsTrigger>
        </TabsList>
        <TabsContent value="draw" className="space-y-3 mt-4">
          <div className="rounded-xl border border-dashed border-border/80 bg-[linear-gradient(to_bottom,transparent_95%,hsl(var(--border))_95%),linear-gradient(to_right,transparent_95%,hsl(var(--border)/0.4)_95%)] bg-[size:100%_28px,28px_100%] overflow-hidden shadow-inner">
            <SignatureCanvas
              ref={(instance) => {
                canvasRef.current = instance as unknown as SigCanvas
              }}
              penColor="#0f172a"
              backgroundColor="#ffffff"
              canvasProps={{
                className: 'w-full h-44 touch-none block bg-white',
                width: 500,
                height: 176,
                style: { width: '100%', height: '176px' },
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Sign in the box above</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => canvasRef.current?.clear()}>
              Clear
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="type" className="space-y-3 mt-4">
          <div className="space-y-2">
            <Label htmlFor="typed-signature">Type your full name</Label>
            <Input
              id="typed-signature"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Jane Doe"
              className="font-serif text-2xl italic h-12"
            />
            <p className="text-xs text-muted-foreground">
              We’ll place this as a cursive-style signature on the document.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {mode === 'draw' && (
        <div className="space-y-2">
          <Label htmlFor="printed-name">Printed name (optional)</Label>
          <Input
            id="printed-name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={defaultName || 'Your name'}
          />
        </div>
      )}

      <Button
        className="w-full shadow-md shadow-primary/15"
        size="lg"
        disabled={submitting}
        onClick={() => void handleSubmit()}
      >
        {submitting ? 'Signing…' : 'Apply signature & finish'}
      </Button>
    </div>
  )
}
