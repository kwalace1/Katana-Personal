"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Upload, X, File, AlertCircle } from "lucide-react"
import { uploadFileToStorage, addProjectFile } from "@/lib/supabase-api"
import { validateFile } from "@/lib/validation"
import type { ProjectFile } from "@/lib/project-data"
import { useAuth } from "@/contexts/AuthContext"

interface UploadFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onFileUploaded: (file: ProjectFile) => void
}

export function UploadFileDialog({
  open,
  onOpenChange,
  projectId,
  onFileUploaded,
}: UploadFileDialogProps) {
  const { user, profile } = useAuth()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
      for (const file of files) {
        const result = validateFile(file)
        if (!result.valid) { setError(result.error ?? 'Invalid file'); return }
      }
      setSelectedFiles((prev) => [...prev, ...files])
      setError(null)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      for (const file of files) {
        const result = validateFile(file)
        if (!result.valid) { setError(result.error ?? 'Invalid file'); return }
      }
      setSelectedFiles((prev) => [...prev, ...files])
      setError(null)
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  const getFileType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp']
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'csv', 'xls', 'xlsx']
    const codeExts = ['js', 'ts', 'jsx', 'tsx', 'css', 'html', 'json', 'xml']
    
    if (imageExts.includes(ext)) return 'image'
    if (docExts.includes(ext)) return 'document'
    if (codeExts.includes(ext)) return 'code'
    return 'file'
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file')
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const totalFiles = selectedFiles.length
      let uploadedCount = 0

      for (const file of selectedFiles) {
        // Upload to Supabase Storage
        const uploadResult = await uploadFileToStorage(projectId, file)
        
        if (!uploadResult) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        // Add file metadata to database
        const uploadedBy =
          profile?.full_name?.trim() || user?.email?.trim() || 'Unknown user'
        const fileData: Omit<ProjectFile, 'id'> = {
          name: file.name,
          type: getFileType(file.name),
          uploadedBy,
          uploadedAt: new Date().toISOString(),
          size: formatFileSize(file.size),
          url: uploadResult.url,
        }

        const fileId = await addProjectFile(projectId, fileData)
        
        if (!fileId) {
          throw new Error(`Failed to save metadata for ${file.name}`)
        }

        // Notify parent component
        onFileUploaded({
          ...fileData,
          id: fileId,
        })

        uploadedCount++
        setUploadProgress((uploadedCount / totalFiles) * 100)
      }

      // Success
      setSelectedFiles([])
      setUploadProgress(100)
      
      // Close dialog after a short delay
      setTimeout(() => {
        onOpenChange(false)
        setUploadProgress(0)
      }, 500)
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    if (!uploading) {
      setSelectedFiles([])
      setError(null)
      setUploadProgress(0)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Add files to your project. Drag and drop or click to browse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm font-medium mb-1">
              {dragActive ? 'Drop files here' : 'Drag and drop files here'}
            </p>
            <p className="text-xs text-muted-foreground mb-3">or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              accept="*/*"
            />
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => {
                console.log('Button clicked, fileInputRef:', fileInputRef.current)
                if (fileInputRef.current) {
                  fileInputRef.current.click()
                }
              }}
            >
              Select Files
            </Button>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({selectedFiles.length})</Label>
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <Label>Uploading... {Math.round(uploadProgress)}%</Label>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 border border-destructive/50 rounded-lg bg-destructive/5">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
          >
            {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

