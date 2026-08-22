import { useEffect, useMemo, useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { assertFeedMedia } from '@/lib/social/feed'

type Props = {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
  max?: number
}

function FileThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <li className="relative h-16 w-16 overflow-hidden rounded-xl border border-border/50 bg-secondary/40">
      {file.type.startsWith('video/') ? (
        <video src={url} className="h-full w-full object-cover" muted playsInline />
      ) : (
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 text-muted-foreground hover:text-destructive"
        aria-label="Remove photo"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  )
}

export function FeedMediaAttach({ files, onChange, disabled, max = 4 }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const room = Math.max(0, max - files.length)

  async function onPick(list: FileList | null) {
    if (!list?.length) return
    if (room <= 0) {
      toast.error(`Up to ${max} photos or clips per post.`)
      return
    }
    const slice = [...list].slice(0, room)
    try {
      for (const file of slice) await assertFeedMedia(file)
      onChange([...files, ...slice])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t add photo')
    }
  }

  return (
    <div className="space-y-2">
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <FileThumb
              key={`${file.name}-${file.lastModified}-${index}`}
              file={file}
              onRemove={() => onChange(files.filter((_, i) => i !== index))}
            />
          ))}
        </ul>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        multiple
        className="hidden"
        onChange={(e) => {
          void onPick(e.target.files)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || room <= 0}
        onClick={() => fileRef.current?.click()}
      >
        <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
        Add photo
      </Button>
    </div>
  )
}
