import { supabase } from './supabase'
import { uploadWithTracking } from './storage-api'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function validateCommerceLogo(file: File): string | null {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return 'Please upload a PNG, JPG, WebP, or GIF image.'
  }
  if (file.size > MAX_LOGO_BYTES) {
    return 'Logo must be under 2MB.'
  }
  return null
}

export async function uploadCommerceLogo(file: File): Promise<{ url: string } | { error: string }> {
  const validationError = validateCommerceLogo(file)
  if (validationError) return { error: validationError }

  const tracked = await uploadWithTracking(file, {
    module: 'customer-success',
    bucket: 'cs-files',
    compress: true,
    maxWidthPx: 600,
  })

  if (!('error' in tracked)) {
    return { url: tracked.url }
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `commerce-logos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { data, error } = await supabase.storage.from('cs-files').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    return {
      error:
        error.message.includes('Bucket not found') || error.message.includes('bucket')
          ? 'Storage bucket missing. Run supabase-cs-files-bucket-migration.sql in Supabase.'
          : `Upload failed: ${error.message}`,
    }
  }

  const { data: urlData } = supabase.storage.from('cs-files').getPublicUrl(data.path)
  return { url: urlData.publicUrl }
}
