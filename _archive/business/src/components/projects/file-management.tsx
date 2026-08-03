"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { Project, ProjectFile } from "@/lib/project-data"
import { deleteProjectFile, getProjectFiles } from "@/lib/supabase-api"
import { UploadFileDialog } from "./upload-file-dialog"
import {
  Upload,
  Search,
  File,
  FileText,
  ImageIcon,
  FileCode,
  Download,
  MoreHorizontal,
  FolderOpen,
  Grid3x3,
  List,
  Trash2,
  Loader2,
  Eye,
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface FileManagementProps {
  project: Project
  onProjectUpdate?: () => void
  readOnly?: boolean
}

export function FileManagement({ project, onProjectUpdate, readOnly = false }: FileManagementProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [files, setFiles] = useState<ProjectFile[]>(project.files)
  const [loading, setLoading] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [deletingMultiple, setDeletingMultiple] = useState(false)
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null)
  const [previewExpanded, setPreviewExpanded] = useState(false)

  const closePreview = () => {
    setPreviewFile(null)
    setPreviewExpanded(false)
  }

  const isPreviewable = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')
  }

  const isImage = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')
  }

  // Refresh files when project changes
  useEffect(() => {
    setFiles(project.files)
  }, [project.files])

  const refreshFiles = async () => {
    setLoading(true)
    try {
      const updatedFiles = await getProjectFiles(project.id)
      setFiles(updatedFiles)
      onProjectUpdate?.()
    } catch (err) {
      console.error('Error refreshing files:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUploaded = (file: ProjectFile) => {
    console.log('[FileManagement] File uploaded:', file.name)
    setFiles((prev) => [file, ...prev])
    onProjectUpdate?.()
  }

  const handleDeleteFile = async (fileId: string, fileUrl?: string) => {
    if (readOnly) return
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return
    }

    setDeletingFileId(fileId)
    try {
      const success = await deleteProjectFile(fileId, fileUrl)
      if (success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId))
        onProjectUpdate?.()
      } else {
        alert('Failed to delete file')
      }
    } catch (err) {
      console.error('Error deleting file:', err)
      alert('Error deleting file')
    } finally {
      setDeletingFileId(null)
    }
  }

  const handleDownloadFile = async (file: ProjectFile) => {
    if (!file.url) {
      alert('File URL not available')
      return
    }

    try {
      window.open(file.url, '_blank')
    } catch (err) {
      console.error('Error downloading file:', err)
      alert('Error downloading file')
    }
  }

  const openPreview = (file: ProjectFile) => {
    setPreviewFile(file)
    setPreviewExpanded(false)
  }

  const renderPreviewContent = (file: ProjectFile) => {
    if (!file.url) {
      return (
        <div className="text-center p-8">
          <File className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">File URL not available</p>
        </div>
      )
    }

    if (isImage(file.name)) {
      return (
        <img
          src={file.url}
          alt={file.name}
          className="max-w-full max-h-full w-auto h-auto object-contain"
        />
      )
    }

    if (file.name.toLowerCase().endsWith('.pdf')) {
      return (
        <iframe
          src={`${file.url}#view=FitH`}
          className="h-full w-full min-h-[60vh] border-0 bg-white"
          title={file.name}
        />
      )
    }

    return (
      <div className="text-center p-8">
        <File className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Preview not available for this file type</p>
        <Button variant="outline" className="mt-4" onClick={() => handleDownloadFile(file)}>
          <Download className="w-4 h-4 mr-2" />
          Download to view
        </Button>
      </div>
    )
  }

  const renderPreviewToolbar = (file: ProjectFile, expanded: boolean) => (
    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
      <Button variant="outline" size="sm" onClick={() => handleDownloadFile(file)}>
        <Download className="w-3 h-3 mr-1" />
        Download
      </Button>
      {file.url && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(file.url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Open in tab
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPreviewExpanded(!expanded)}
      >
        {expanded ? (
          <>
            <Minimize2 className="w-3 h-3 mr-1" />
            Exit full view
          </>
        ) : (
          <>
            <Maximize2 className="w-3 h-3 mr-1" />
            Pop out
          </>
        )}
      </Button>
    </div>
  )

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    )
  }

  const toggleSelectAll = () => {
    setSelectedFiles(prev =>
      prev.length === filteredFiles.length
        ? []
        : filteredFiles.map(f => f.id)
    )
  }

  const handleDeleteSelectedFiles = async () => {
    if (readOnly) return
    if (selectedFiles.length === 0) return
    
    if (!window.confirm(`Are you sure you want to delete ${selectedFiles.length} file(s)?`)) {
      return
    }

    setDeletingMultiple(true)
    try {
      const filesToDelete = files.filter(f => selectedFiles.includes(f.id))
      
      for (const file of filesToDelete) {
        await deleteProjectFile(file.id, file.url)
      }
      
      setFiles(prev => prev.filter(f => !selectedFiles.includes(f.id)))
      setSelectedFiles([])
      onProjectUpdate?.()
    } catch (err) {
      console.error('Error deleting files:', err)
      alert('Error deleting some files')
    } finally {
      setDeletingMultiple(false)
    }
  }

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculate total size in bytes from formatted strings
  const calculateTotalSize = (files: ProjectFile[]): string => {
    let totalBytes = 0
    files.forEach((file) => {
      const sizeStr = file.size.toLowerCase()
      const value = parseFloat(sizeStr)
      
      if (sizeStr.includes('kb')) {
        totalBytes += value * 1024
      } else if (sizeStr.includes('mb')) {
        totalBytes += value * 1024 * 1024
      } else if (sizeStr.includes('gb')) {
        totalBytes += value * 1024 * 1024 * 1024
      } else {
        totalBytes += value // Assume bytes if no unit
      }
    })
    
    // Convert to human-readable format
    if (totalBytes < 1024) {
      return `${totalBytes.toFixed(0)} B`
    } else if (totalBytes < 1024 * 1024) {
      return `${(totalBytes / 1024).toFixed(1)} KB`
    } else if (totalBytes < 1024 * 1024 * 1024) {
      return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
    } else {
      return `${(totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    switch (ext) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "svg":
        return <ImageIcon className="w-8 h-8 text-blue-500" />
      case "pdf":
        return <FileText className="w-8 h-8 text-red-500" />
      case "js":
      case "ts":
      case "jsx":
      case "tsx":
      case "css":
      case "html":
        return <FileCode className="w-8 h-8 text-green-500" />
      default:
        return <File className="w-8 h-8 text-muted-foreground" />
    }
  }

  const getFileType = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    switch (ext) {
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "svg":
        return "Image"
      case "pdf":
        return "PDF"
      case "js":
      case "ts":
      case "jsx":
      case "tsx":
        return "Code"
      case "css":
        return "Stylesheet"
      case "html":
        return "HTML"
      default:
        return "Document"
    }
  }

  return (
    <div className="space-y-4">
      {/* File stats – one rectangular bar */}
      <Card className="overflow-hidden border-border bg-card/50">
        <div className="stat-bar">
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Total Files</p>
              <p className="text-2xl font-bold tabular-nums">{files.length}</p>
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <File className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Total Size</p>
              <p className="text-2xl font-bold tabular-nums">
                {(() => {
                  const [value, unit] = calculateTotalSize(files).split(" ")
                  return <>{value}<span className="text-lg font-semibold text-muted-foreground"> {unit}</span></>
                })()}
              </p>
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Images</p>
              <p className="text-2xl font-bold tabular-nums">
                {files.filter((f) => f.type === "image" || /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(f.name)).length}
              </p>
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Documents</p>
              <p className="text-2xl font-bold tabular-nums">
                {files.filter((f) => f.type === "document" || /\.(pdf|doc|docx|txt|rtf|csv|xls|xlsx)$/i.test(f.name)).length}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Search and Actions */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && selectedFiles.length > 0 && (
              <>
                <Badge variant="secondary" className="mr-2">
                  {selectedFiles.length} selected
                </Badge>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelectedFiles}
                  disabled={deletingMultiple}
                >
                  {deletingMultiple ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete {selectedFiles.length}
                </Button>
              </>
            )}
            <div className="flex items-center gap-2 border rounded-md px-3 py-2">
              <Checkbox
                checked={selectedFiles.length === filteredFiles.length && filteredFiles.length > 0}
                onCheckedChange={toggleSelectAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm cursor-pointer">
                Select All
              </label>
            </div>
            <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")}>
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
              <List className="w-4 h-4" />
            </Button>
          </div>
          {!readOnly ? (
          <Button onClick={() => setUploadDialogOpen(true)} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Upload Files
          </Button>
          ) : null}
        </div>
      </Card>

      {/* Files Display */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredFiles.map((file) => (
            <Card key={file.id} className="p-4 hover:border-primary/40 transition-all group relative">
              <div className="absolute top-2 left-2 z-10">
                <Checkbox
                  checked={selectedFiles.includes(file.id)}
                  onCheckedChange={() => toggleFileSelection(file.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex flex-col items-center text-center space-y-3">
                <div
                  className="w-16 h-16 rounded-lg bg-muted/50 flex items-center justify-center group-hover:scale-110 transition-transform cursor-pointer"
                  onClick={() => file.url && isPreviewable(file.name) ? openPreview(file) : handleDownloadFile(file)}
                >
                  {getFileIcon(file.name)}
                </div>
                <div className="flex-1 w-full">
                  <p
                    className="font-medium text-sm text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => file.url && isPreviewable(file.name) ? openPreview(file) : handleDownloadFile(file)}
                  >{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{file.size}</p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {getFileType(file.name)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 w-full">
                  {file.url && isPreviewable(file.name) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent"
                      onClick={() => openPreview(file)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent"
                      onClick={() => handleDownloadFile(file)}
                      disabled={!file.url}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" disabled={deletingFileId === file.id}>
                        {deletingFileId === file.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="w-4 h-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-2 border-border shadow-lg">
                      {file.url && isPreviewable(file.name) && (
                        <DropdownMenuItem onClick={() => openPreview(file)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDownloadFile(file)} disabled={!file.url}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteFile(file.id, file.url)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border/40">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-foreground w-12">
                    <Checkbox
                      checked={selectedFiles.length === filteredFiles.length && filteredFiles.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Type</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Size</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file, index) => (
                  <tr
                    key={file.id}
                    className={`
                      border-b border-border/40 hover:bg-muted/20 transition-colors
                      ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}
                    `}
                  >
                    <td className="p-4">
                      <Checkbox
                        checked={selectedFiles.includes(file.id)}
                        onCheckedChange={() => toggleFileSelection(file.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="p-4">
                      <div
                        className="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => file.url && isPreviewable(file.name) ? openPreview(file) : handleDownloadFile(file)}
                      >
                        {getFileIcon(file.name)}
                        <span className="font-medium">{file.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-xs">
                        {getFileType(file.name)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-foreground">{file.size}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {file.url && isPreviewable(file.name) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPreview(file)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadFile(file)}
                          disabled={!file.url}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={deletingFileId === file.id}>
                              {deletingFileId === file.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="w-4 h-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-2 border-border shadow-lg">
                            {file.url && isPreviewable(file.name) && (
                              <DropdownMenuItem onClick={() => openPreview(file)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDownloadFile(file)} disabled={!file.url}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteFile(file.id, file.url)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filteredFiles.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No files found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try adjusting your search' : 'Upload files to get started'}
            </p>
            {!readOnly ? (
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
            ) : null}
          </div>
        </Card>
      )}

      {previewFile && previewExpanded && (
        <div className="fixed inset-0 z-[10050] flex flex-col bg-background">
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {getFileIcon(previewFile.name)}
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{previewFile.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {previewFile.size} &middot; Uploaded by {previewFile.uploadedBy}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {renderPreviewToolbar(previewFile, true)}
              <Button variant="ghost" size="icon" onClick={closePreview} aria-label="Close preview">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-muted/20 p-4 sm:p-6 flex items-center justify-center overflow-auto">
            <div className="h-full w-full max-w-[1600px] flex items-center justify-center">
              {renderPreviewContent(previewFile)}
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={!!previewFile && !previewExpanded}
        onOpenChange={(open) => {
          if (!open) closePreview()
        }}
      >
        <DialogContent size="lg">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {previewFile && getFileIcon(previewFile.name)}
                <div className="min-w-0">
                  <DialogTitle className="truncate">{previewFile?.name}</DialogTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {previewFile?.size} &middot; Uploaded by {previewFile?.uploadedBy}
                  </p>
                </div>
              </div>
              {previewFile && renderPreviewToolbar(previewFile, false)}
            </div>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/30 p-4">
            <div className="flex h-full min-h-[65vh] w-full items-center justify-center">
              {previewFile && renderPreviewContent(previewFile)}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <UploadFileDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        projectId={project.id}
        onFileUploaded={handleFileUploaded}
      />
    </div>
  )
}
