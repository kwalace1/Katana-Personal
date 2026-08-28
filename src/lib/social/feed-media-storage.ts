import { getSupabase } from '@/lib/supabase'
import type { FeedMedia } from '@/lib/social/feed'

/** Immutable paths — long browser cache cuts repeat egress. */
export const TOGETHER_CACHE_CONTROL = '31536000'

export const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7

type ImageTransform = {
  width?: number
  height?: number
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
}

function normalizePath(path: string) {
  return path.replace(/^together\//, '')
}

export function feedMediaStoragePaths(m: FeedMedia): string[] {
  return [m.path, m.thumbPath, m.posterPath].filter(Boolean) as string[]
}

export async function uploadTogetherFile(
  path: string,
  file: File | Blob,
  contentType: string,
): Promise<void> {
  const { error } = await getSupabase()
    .storage.from('together')
    .upload(normalizePath(path), file, {
      contentType,
      upsert: false,
      cacheControl: TOGETHER_CACHE_CONTROL,
    })
  if (error) throw error
}

async function signPath(path: string, transform?: ImageTransform): Promise<string | null> {
  const normalized = normalizePath(path)
  const options = transform ? { transform } : undefined
  const { data, error } = await getSupabase()
    .storage.from('together')
    .createSignedUrl(normalized, SIGNED_URL_TTL_SEC, options)
  if (error || !data?.signedUrl) {
    console.warn('signPath failed', normalized, error?.message)
    return null
  }
  return data.signedUrl
}

/** Small URL for timeline / avatars — never the full original when avoidable. */
export async function signFeedMediaTimeline(m: FeedMedia): Promise<string | null> {
  if (m.type === 'image') {
    if (m.thumbPath) return signPath(m.thumbPath)
    return signPath(m.path, { width: 800, quality: 70, resize: 'contain' })
  }
  if (m.type === 'video') {
    if (m.posterPath) return signPath(m.posterPath)
    return null
  }
  return null
}

/** Full file — only when the user opens or plays media. */
export async function signFeedMediaFull(m: FeedMedia): Promise<string | null> {
  return signPath(m.path)
}

export async function signAvatarUrl(storedPath: string): Promise<string | null> {
  return signPath(storedPath, { width: 128, height: 128, quality: 75, resize: 'cover' })
}
