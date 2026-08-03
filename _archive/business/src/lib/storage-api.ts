import { supabase, isSupabaseConfigured } from './supabase'
import { getCurrentUserId, getOrganizationId } from './auth-helpers'

// ============================================
// TYPES
// ============================================

export interface StorageModule {
  module: string
  bucket: string
  fileCount: number
  totalBytes: number
  lastUploadAt: string | null
}

export interface StorageFileRecord {
  id: string
  module: string
  bucket: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  file_hash: string | null
  uploaded_by: string | null
  created_at: string
}

export interface StorageStats {
  totalBytes: number
  totalFiles: number
  byModule: StorageModule[]
  recentUploads: StorageFileRecord[]
}

export interface UploadOptions {
  module: string
  bucket: string
  compress?: boolean
  maxWidthPx?: number
  onProgress?: (pct: number) => void
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  existingFile?: StorageFileRecord
}

// Module → bucket mapping
export const MODULE_BUCKETS: Record<string, string> = {
  projects: 'project-files',
  hr: 'employee-photos',
  inventory: 'inventory-files',
  wfm: 'wfm-files',
  'customer-success': 'cs-files',
  automation: 'automation-files',
  esign: 'esign-files',
}

const COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_SIZE = 25 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'zip', 'json',
])

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/zip', 'application/json',
])

// ============================================
// FILE VALIDATION
// ============================================

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateUploadFile(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` }
  }
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' }
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type .${ext || 'unknown'} is not allowed` }
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, error: `MIME type ${file.type} is not allowed` }
  }
  return { valid: true }
}

// ============================================
// IMAGE COMPRESSION
// ============================================

export async function compressImage(
  file: File,
  maxWidth = 1920,
  quality = 0.8,
): Promise<File> {
  if (!COMPRESSIBLE_TYPES.has(file.type)) return file
  if (file.size < 100 * 1024) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file)
          } else {
            resolve(new File([blob], file.name, { type: file.type, lastModified: file.lastModified }))
          }
        },
        file.type,
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }
    img.src = url
  })
}

// ============================================
// FILE HASHING (for duplicate detection)
// ============================================

export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ============================================
// DUPLICATE DETECTION
// ============================================

export async function checkDuplicate(
  hash: string,
  module: string,
): Promise<DuplicateCheckResult> {
  if (!isSupabaseConfigured) return { isDuplicate: false }

  const { data, error } = await supabase
    .from('storage_files')
    .select('*')
    .eq('file_hash', hash)
    .eq('module', module)
    .limit(1)
    .maybeSingle()

  if (error || !data) return { isDuplicate: false }
  return { isDuplicate: true, existingFile: data as StorageFileRecord }
}

// ============================================
// UPLOAD WITH TRACKING
// ============================================

export async function uploadWithTracking(
  file: File,
  opts: UploadOptions,
): Promise<{ url: string; path: string; record: StorageFileRecord } | { error: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' }

  // 1. Validate
  const validation = validateUploadFile(file)
  if (!validation.valid) return { error: validation.error! }

  opts.onProgress?.(5)

  // 2. Compress images if opted in
  let processedFile = file
  if (opts.compress !== false && COMPRESSIBLE_TYPES.has(file.type)) {
    processedFile = await compressImage(file, opts.maxWidthPx)
  }

  opts.onProgress?.(15)

  // 3. Hash for dedup
  const hash = await computeFileHash(processedFile)
  const dup = await checkDuplicate(hash, opts.module)
  if (dup.isDuplicate && dup.existingFile) {
    return {
      error: `Duplicate file: "${dup.existingFile.file_name}" already exists in ${opts.module}`,
    }
  }

  opts.onProgress?.(25)

  // 4. Upload to Supabase Storage
  const ext = processedFile.name.split('.').pop()
  const storagePath = `${opts.module}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(opts.bucket)
    .upload(storagePath, processedFile, { cacheControl: '3600', upsert: false })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    return { error: `Upload failed: ${uploadError.message}` }
  }

  opts.onProgress?.(75)

  // 5. Get public URL
  const { data: urlData } = supabase.storage
    .from(opts.bucket)
    .getPublicUrl(uploadData.path)

  // 6. Record in tracking table
  const userId = await getCurrentUserId()
  const orgId = await getOrganizationId()

  const { data: record, error: dbError } = await supabase
    .from('storage_files')
    .insert({
      module: opts.module,
      bucket: opts.bucket,
      file_name: processedFile.name,
      file_path: uploadData.path,
      file_size: processedFile.size,
      mime_type: processedFile.type || 'application/octet-stream',
      file_hash: hash,
      uploaded_by: userId,
      user_id: userId,
      organization_id: orgId,
    })
    .select()
    .single()

  if (dbError) {
    console.error('Failed to record file metadata:', dbError)
  }

  opts.onProgress?.(100)

  return {
    url: urlData.publicUrl,
    path: uploadData.path,
    record: record as StorageFileRecord,
  }
}

// ============================================
// STORAGE ANALYTICS
// ============================================

export async function getStorageStats(): Promise<StorageStats> {
  if (!isSupabaseConfigured) {
    return { totalBytes: 0, totalFiles: 0, byModule: [], recentUploads: [] }
  }

  const { data, error } = await supabase
    .from('storage_files')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('Error fetching storage stats:', error)
    return { totalBytes: 0, totalFiles: 0, byModule: [], recentUploads: [] }
  }

  const files = data as StorageFileRecord[]
  const moduleMap = new Map<string, StorageModule>()

  for (const f of files) {
    const existing = moduleMap.get(f.module) || {
      module: f.module,
      bucket: f.bucket,
      fileCount: 0,
      totalBytes: 0,
      lastUploadAt: null,
    }
    existing.fileCount++
    existing.totalBytes += f.file_size || 0
    if (!existing.lastUploadAt || f.created_at > existing.lastUploadAt) {
      existing.lastUploadAt = f.created_at
    }
    moduleMap.set(f.module, existing)
  }

  return {
    totalBytes: files.reduce((sum, f) => sum + (f.file_size || 0), 0),
    totalFiles: files.length,
    byModule: Array.from(moduleMap.values()).sort((a, b) => b.totalBytes - a.totalBytes),
    recentUploads: files.slice(0, 10),
  }
}

export async function deleteTrackedFile(fileId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false

  const { data: file, error: fetchErr } = await supabase
    .from('storage_files')
    .select('bucket, file_path')
    .eq('id', fileId)
    .single()

  if (fetchErr || !file) return false

  await supabase.storage.from(file.bucket).remove([file.file_path])

  const { error: delErr } = await supabase
    .from('storage_files')
    .delete()
    .eq('id', fileId)

  return !delErr
}

// ============================================
// UTILITY
// ============================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function getModuleColor(module: string): string {
  const colors: Record<string, string> = {
    projects: '#3b82f6',
    hr: '#8b5cf6',
    inventory: '#f59e0b',
    wfm: '#10b981',
    'customer-success': '#ec4899',
    automation: '#6366f1',
  }
  return colors[module] || '#6b7280'
}
