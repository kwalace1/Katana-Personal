import { useState, useRef } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Upload, X, FileText, Image, AlertCircle, CheckCircle2, Loader2,
} from 'lucide-react'
import {
  uploadWithTracking,
  validateUploadFile,
  formatBytes,
  type UploadOptions,
  type StorageFileRecord,
} from '@/lib/storage-api'

interface TrackedUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  module: string
  bucket: string
  compress?: boolean
  onFileUploaded?: (record: StorageFileRecord, url: string) => void
}

interface QueuedFile {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error' | 'duplicate'
  progress: number
  error?: string
  result?: { url: string; record: StorageFileRecord }
}

export function TrackedUploadDialog({
  open,
  onOpenChange,
  module,
  bucket,
  compress = true,
  onFileUploaded,
}: TrackedUploadDialogProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = (files: File[]) => {
    const newItems: QueuedFile[] = []
    for (const file of files) {
      const v = validateUploadFile(file)
      if (!v.valid) {
        newItems.push({ file, status: 'error', progress: 0, error: v.error })
      } else {
        newItems.push({ file, status: 'pending', progress: 0 })
      }
    }
    setQueue((prev) => [...prev, ...newItems])
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.length) addFiles(Array.from(e.dataTransfer.files))
  }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(Array.from(e.target.files))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeItem = (idx: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleUpload = async () => {
    const pending = queue.filter((q) => q.status === 'pending')
    if (pending.length === 0) return

    setUploading(true)

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status !== 'pending') continue

      setQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, status: 'uploading' as const, progress: 0 } : q)),
      )

      const opts: UploadOptions = {
        module,
        bucket,
        compress,
        onProgress: (pct) => {
          setQueue((prev) =>
            prev.map((q, idx) => (idx === i ? { ...q, progress: pct } : q)),
          )
        },
      }

      const result = await uploadWithTracking(queue[i].file, opts)

      if ('error' in result) {
        const isDup = result.error.startsWith('Duplicate')
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i ? { ...q, status: isDup ? 'duplicate' as const : 'error' as const, error: result.error, progress: 100 } : q,
          ),
        )
      } else {
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i ? { ...q, status: 'done' as const, progress: 100, result } : q,
          ),
        )
        onFileUploaded?.(result.record, result.url)
      }
    }

    setUploading(false)
  }

  const handleClose = () => {
    if (uploading) return
    setQueue([])
    setDragActive(false)
    onOpenChange(false)
  }

  const pendingCount = queue.filter((q) => q.status === 'pending').length
  const doneCount = queue.filter((q) => q.status === 'done').length
  const overallProgress = queue.length > 0
    ? queue.reduce((sum, q) => sum + q.progress, 0) / queue.length
    : 0

  const getIcon = (mime: string) =>
    mime.startsWith('image/') ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Upload to <span className="font-medium capitalize">{module}</span> module. Files are validated, compressed, and checked for duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm font-medium">{dragActive ? 'Drop files here' : 'Drag & drop or click to browse'}</p>
            <p className="text-xs text-muted-foreground mt-1">Max 25MB per file. Images auto-compressed.</p>
            <input ref={fileInputRef} type="file" multiple onChange={handleSelect} className="hidden" />
          </div>

          {/* File Queue */}
          {queue.length > 0 && (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              <Label>Files ({queue.length})</Label>
              {queue.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                  <div className="flex-shrink-0">
                    {item.status === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : item.status === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : item.status === 'duplicate' ? (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    ) : item.status === 'uploading' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      getIcon(item.file.type)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</span>
                      {item.status === 'done' && <Badge variant="outline" className="text-[10px] text-green-600">Uploaded</Badge>}
                      {item.status === 'duplicate' && <Badge variant="outline" className="text-[10px] text-amber-600">Duplicate</Badge>}
                      {item.status === 'error' && <span className="text-[10px] text-destructive truncate">{item.error}</span>}
                    </div>
                    {item.status === 'uploading' && (
                      <Progress value={item.progress} className="h-1 mt-1" />
                    )}
                  </div>
                  {(item.status === 'pending' || item.status === 'error' || item.status === 'duplicate') && (
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} disabled={uploading}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Overall Progress */}
          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading...</span>
                <span>{Math.round(overallProgress)}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              {doneCount > 0 && `${doneCount} uploaded`}
              {doneCount > 0 && pendingCount > 0 && ' · '}
              {pendingCount > 0 && `${pendingCount} pending`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={uploading}>
                {doneCount > 0 && pendingCount === 0 ? 'Done' : 'Cancel'}
              </Button>
              {pendingCount > 0 && (
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Uploading...</>
                  ) : (
                    `Upload ${pendingCount} File${pendingCount !== 1 ? 's' : ''}`
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
