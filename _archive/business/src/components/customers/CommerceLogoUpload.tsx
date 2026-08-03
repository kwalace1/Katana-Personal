import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Upload, X } from 'lucide-react'
import { uploadCommerceLogo } from '@/lib/crm-commerce-logo'
import { useToast } from '@/hooks/use-toast'

interface CommerceLogoUploadProps {
  value: string
  onChange: (url: string) => void
}

export function CommerceLogoUpload({ value, onChange }: CommerceLogoUploadProps) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    const result = await uploadCommerceLogo(file)
    setUploading(false)

    if ('error' in result) {
      toast({ title: 'Logo upload failed', description: result.error, variant: 'destructive' })
      return
    }

    onChange(result.url)
    toast({ title: 'Logo uploaded', description: 'Your logo will appear on quotes, invoices, and contracts.' })
  }

  return (
    <div className="space-y-2">
      <Label>Company logo</Label>
      <div className="flex flex-wrap items-center gap-4">
        {value ? (
          <img
            src={value}
            alt="Company logo preview"
            className="h-16 w-28 rounded-lg border bg-white object-contain p-1"
          />
        ) : (
          <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
            No logo
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            {value ? 'Replace logo' : 'Upload logo'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
              <X className="h-4 w-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void handleFile(e)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        PNG, JPG, WebP, or GIF up to 2MB. Shown on generated quote, invoice, and contract PDFs.
      </p>
    </div>
  )
}
