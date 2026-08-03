import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  HardDrive, FileText, Image, Archive, RefreshCw, Trash2, AlertCircle,
} from 'lucide-react'
import {
  getStorageStats,
  deleteTrackedFile,
  formatBytes,
  getModuleColor,
  type StorageStats,
  type StorageFileRecord,
} from '@/lib/storage-api'

const STORAGE_QUOTA = 1 * 1024 * 1024 * 1024 // 1 GB assumed quota

function getFileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image className="h-4 w-4" />
  if (mime.includes('zip') || mime.includes('archive')) return <Archive className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

export function StorageDashboard() {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    const data = await getStorageStats()
    setStats(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const handleDelete = async (file: StorageFileRecord) => {
    if (!confirm(`Delete "${file.file_name}"? This cannot be undone.`)) return
    setDeleting(file.id)
    await deleteTrackedFile(file.id)
    await loadStats()
    setDeleting(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!stats) return null

  const usagePct = stats.totalBytes > 0 ? Math.min((stats.totalBytes / STORAGE_QUOTA) * 100, 100) : 0

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Storage Used</CardDescription>
            <CardTitle className="text-2xl">{formatBytes(stats.totalBytes)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={usagePct} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {usagePct.toFixed(1)}% of {formatBytes(STORAGE_QUOTA)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Files</CardDescription>
            <CardTitle className="text-2xl">{stats.totalFiles}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across {stats.byModule.length} module{stats.byModule.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg File Size</CardDescription>
            <CardTitle className="text-2xl">
              {stats.totalFiles > 0 ? formatBytes(Math.round(stats.totalBytes / stats.totalFiles)) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.byModule.length > 0 ? `Largest module: ${stats.byModule[0].module}` : 'No files yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Module Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Storage by Module
              </CardTitle>
              <CardDescription>Breakdown of storage usage across modules</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadStats}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.byModule.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <HardDrive className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No files uploaded yet</p>
              <p className="text-xs mt-1">Upload files in any module to see storage analytics</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.byModule.map((mod) => {
                const pct = stats.totalBytes > 0
                  ? (mod.totalBytes / stats.totalBytes) * 100
                  : 0
                return (
                  <div key={mod.module} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getModuleColor(mod.module) }}
                        />
                        <span className="font-medium capitalize">{mod.module}</span>
                        <Badge variant="secondary" className="text-xs">
                          {mod.fileCount} file{mod.fileCount !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground">{formatBytes(mod.totalBytes)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(pct, 1)}%`,
                          backgroundColor: getModuleColor(mod.module),
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Uploads */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Uploads</CardTitle>
          <CardDescription>Last 10 files uploaded across all modules</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentUploads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No uploads yet</p>
          ) : (
            <div className="space-y-2">
              {stats.recentUploads.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(file.mime_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.file_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {file.module}
                        </Badge>
                        <span>{formatBytes(file.file_size)}</span>
                        <span>{new Date(file.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(file)}
                    disabled={deleting === file.id}
                  >
                    {deleting === file.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duplicate Detection Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Upload Safeguards
          </CardTitle>
          <CardDescription>Active protections for file uploads</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'File Type Validation', desc: 'Only allowed file types accepted' },
              { label: 'Size Limit', desc: '25 MB maximum per file' },
              { label: 'Image Compression', desc: 'Auto-compress images > 100KB' },
              { label: 'Duplicate Detection', desc: 'SHA-256 hash prevents duplicate uploads' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2 p-2 border rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
