import { getSupabase } from '@/lib/supabase'
import { createId } from '@/lib/id'
import { listMyCircles } from '@/lib/social/circles'
import { listFriendProfiles, getCloudProfile, getCloudProfiles, resolveProfilePhotoUrl, type Unsubscribe } from '@/lib/social/friends'

export const FEED_TEXT_MAX = 500
export const FEED_IMAGE_MAX_BYTES = 5 * 1024 * 1024
/** Keep clips short so free-tier storage lasts longer. */
export const FEED_VIDEO_MAX_SECONDS = 20
export const FEED_VIDEO_MAX_MS = FEED_VIDEO_MAX_SECONDS * 1000
export const FEED_VIDEO_MAX_BYTES = 12 * 1024 * 1024
export const CIRCLE_BOOST_MS = 12 * 60 * 60 * 1000

export type FeedAudience = 'friends' | 'circle'
export type FeedMediaType = 'image' | 'video'
export type FeedCardKind = 'goal' | 'habit' | 'workout'

export interface FeedMedia {
  type: FeedMediaType
  path: string
  contentType: string
  url?: string
  width?: number
  height?: number
  durationMs?: number
}

export interface FeedCard {
  kind: FeedCardKind
  title: string
  subtitle?: string
  stats?: string
  /** Short celebratory label shown on the card (e.g. “Goal crushed”). */
  badge?: string
}

export interface RepostSnapshot {
  postId: string
  authorId: string
  text: string
  media: FeedMedia[]
  card?: FeedCard | null
  createdAt: string
}

export interface TogetherPost {
  id: string
  authorId: string
  createdAt: string
  text: string
  audience: FeedAudience
  circleId?: string | null
  viewerIds: string[]
  media: FeedMedia[]
  card?: FeedCard | null
  /** When set, this post is a repost/quote of another post */
  repost?: RepostSnapshot | null
}

export type RankedPost = TogetherPost & { score: number }

type PostRow = {
  id: string
  author_id: string
  created_at: string
  text: string
  audience: FeedAudience
  circle_id?: string | null
  viewer_ids: string[]
  media?: FeedMedia[] | null
  card?: FeedCard | null
  repost?: RepostSnapshot | null
}

function mapPost(row: PostRow): TogetherPost {
  return {
    id: row.id,
    authorId: row.author_id,
    createdAt: row.created_at,
    text: row.text || '',
    audience: row.audience,
    circleId: row.circle_id ?? null,
    viewerIds: row.viewer_ids || [],
    media: row.media || [],
    card: row.card ?? null,
    repost: row.repost ?? null,
  }
}

export function mediaTypeFromFile(file: File): FeedMediaType {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('image/')) return 'image'
  throw new Error('Use a photo (jpeg/png/webp) or short video (mp4/webm).')
}

export function validateFeedMedia(file: File): FeedMediaType {
  const type = mediaTypeFromFile(file)
  if (type === 'image' && file.size > FEED_IMAGE_MAX_BYTES) {
    throw new Error('Photos must be under 5 MB.')
  }
  if (type === 'video' && file.size > FEED_VIDEO_MAX_BYTES) {
    throw new Error(`Videos must be under ${Math.round(FEED_VIDEO_MAX_BYTES / (1024 * 1024))} MB (max ${FEED_VIDEO_MAX_SECONDS}s).`)
  }
  return type
}

/** Read video length via metadata (browser only). */
export function readVideoDurationMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Video length can only be checked in the browser.'))
      return
    }
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }
    video.onloadedmetadata = () => {
      const seconds = video.duration
      cleanup()
      if (!Number.isFinite(seconds) || seconds <= 0) {
        reject(new Error('Couldn’t read that video’s length.'))
        return
      }
      resolve(Math.round(seconds * 1000))
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('Couldn’t read that video.'))
    }
    video.src = url
  })
}

/** Sync size/type checks, then async duration for videos. */
export async function assertFeedMedia(file: File): Promise<{
  type: FeedMediaType
  durationMs?: number
}> {
  const type = validateFeedMedia(file)
  if (type !== 'video') return { type }
  const durationMs = await readVideoDurationMs(file)
  // Small tolerance for encoder rounding
  if (durationMs > FEED_VIDEO_MAX_MS + 250) {
    const secs = Math.ceil(durationMs / 1000)
    throw new Error(
      `Videos must be ${FEED_VIDEO_MAX_SECONDS} seconds or shorter (yours is ~${secs}s).`,
    )
  }
  return { type, durationMs }
}

/** Storage object path inside the `together` bucket (no bucket prefix). */
function storageObjectPath(authorId: string, postId: string, fileName: string) {
  return `${authorId}/${postId}/${fileName}`
}

export async function uploadFeedMedia(input: {
  authorId: string
  postId: string
  file: File
}): Promise<FeedMedia> {
  // Compress first so large camera rolls still upload under free-tier limits
  const { prepareFeedMedia } = await import('@/lib/social/feed-media-compress')
  const prepared = await prepareFeedMedia(input.file)
  const file = prepared.file
  const type = prepared.type
  const durationMs = prepared.durationMs
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80) || `${type}`
  const objectPath = storageObjectPath(input.authorId, input.postId, `${Date.now()}_${safeName}`)
  const supabase = getSupabase()
  const { error } = await supabase.storage.from('together').upload(objectPath, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  const { data: signed, error: signErr } = await supabase.storage
    .from('together')
    .createSignedUrl(objectPath, 60 * 60 * 24 * 7)
  if (signErr) throw signErr
  return {
    type,
    path: objectPath,
    contentType: file.type,
    url: signed.signedUrl,
    ...(durationMs != null ? { durationMs } : {}),
  }
}

async function resolveViewerIds(input: {
  authorId: string
  audience: FeedAudience
  circleId?: string | null
}): Promise<string[]> {
  if (input.audience === 'circle') {
    if (!input.circleId) throw new Error('Pick a circle.')
    const circles = await listMyCircles(input.authorId)
    const circle = circles.find((c) => c.id === input.circleId)
    if (!circle) throw new Error('You’re not in that circle.')
    return [...new Set(circle.memberIds)]
  }
  const friends = await listFriendProfiles(input.authorId)
  return [...new Set([input.authorId, ...friends.map((f) => f.uid)])]
}

export async function createTogetherPost(input: {
  authorId: string
  text: string
  audience: FeedAudience
  circleId?: string | null
  files?: File[]
  card?: FeedCard | null
  repost?: RepostSnapshot | null
}): Promise<TogetherPost> {
  const text = input.text.trim()
  if (text.length > FEED_TEXT_MAX) throw new Error(`Keep it under ${FEED_TEXT_MAX} characters.`)
  const files = input.files || []
  if (!text && files.length === 0 && !input.card && !input.repost) {
    throw new Error('Write something, add media, or attach a card.')
  }
  if (files.length > 4) throw new Error('Up to 4 media files per post.')

  const viewerIds = await resolveViewerIds({
    authorId: input.authorId,
    audience: input.audience,
    circleId: input.circleId,
  })

  const id = createId()
  const media: FeedMedia[] = []
  for (const file of files) {
    media.push(await uploadFeedMedia({ authorId: input.authorId, postId: id, file }))
  }

  const createdAt = new Date().toISOString()
  const row = {
    id,
    author_id: input.authorId,
    created_at: createdAt,
    text,
    audience: input.audience,
    circle_id: input.audience === 'circle' ? input.circleId || null : null,
    viewer_ids: viewerIds,
    media: media.map(({ type, path, contentType, width, height, durationMs }) => ({
      type,
      path,
      contentType,
      ...(width != null ? { width } : {}),
      ...(height != null ? { height } : {}),
      ...(durationMs != null ? { durationMs } : {}),
    })),
    card: input.card || null,
    repost: input.repost || null,
  }

  const { error } = await getSupabase().from('together_posts').insert(row)
  if (error) throw error
  return {
    id,
    authorId: input.authorId,
    createdAt,
    text,
    audience: input.audience,
    circleId: input.audience === 'circle' ? input.circleId || null : null,
    viewerIds,
    media: media.map((m) => ({ ...m })),
    card: input.card || null,
    repost: input.repost || null,
  }
}

export async function deleteTogetherPost(id: string): Promise<void> {
  const { error } = await getSupabase().from('together_posts').delete().eq('id', id)
  if (error) throw error
}

export function rankFeedPosts(posts: TogetherPost[]): RankedPost[] {
  return posts
    .map((p) => {
      const createdAtMs = Date.parse(p.createdAt) || 0
      const boost = p.audience === 'circle' ? CIRCLE_BOOST_MS : 0
      return { ...p, score: createdAtMs + boost }
    })
    .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
}

async function hydrateMediaUrls(posts: TogetherPost[]): Promise<TogetherPost[]> {
  const supabase = getSupabase()
  const signOne = async (m: FeedMedia): Promise<FeedMedia> => {
    if (m.url) return m
    try {
      const path = m.path.replace(/^together\//, '')
      const { data, error } = await supabase.storage
        .from('together')
        .createSignedUrl(path, 60 * 60 * 24 * 7)
      if (error || !data?.signedUrl) return m
      return { ...m, url: data.signedUrl }
    } catch {
      return m
    }
  }

  return Promise.all(
    posts.map(async (post) => {
      const media = await Promise.all((post.media || []).map(signOne))
      let repost = post.repost ?? null
      if (repost?.media?.length) {
        repost = { ...repost, media: await Promise.all(repost.media.map(signOne)) }
      }
      return { ...post, media, repost }
    }),
  )
}

async function queryFeed(viewerUid: string, pageSize: number, beforeCreatedAt?: string) {
  let q = getSupabase()
    .from('together_posts')
    .select('*')
    .contains('viewer_ids', [viewerUid])
    .order('created_at', { ascending: false })
    .limit(pageSize)
  if (beforeCreatedAt) {
    q = q.lt('created_at', beforeCreatedAt)
  }
  const { data, error } = await q
  if (error) throw error
  return (data || []).map((d) => mapPost(d as PostRow))
}

export function subscribeTogetherFeed(
  viewerUid: string,
  onChange: (posts: RankedPost[]) => void,
  onError?: (err: Error) => void,
  pageSize = 40,
): Unsubscribe {
  const supabase = getSupabase()
  let cancelled = false

  const refresh = () => {
    void queryFeed(viewerUid, pageSize)
      .then(async (raw) => {
        const hydrated = await hydrateMediaUrls(raw)
        if (!cancelled) onChange(rankFeedPosts(hydrated))
      })
      .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))))
  }

  refresh()

  const topic = `together_feed:${viewerUid}:${crypto.randomUUID?.() || String(Date.now())}`
  try {
    const channel = supabase
      .channel(topic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'together_posts' }, refresh)
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  } catch (err) {
    console.warn('Realtime feed unavailable', err)
    onError?.(err instanceof Error ? err : new Error(String(err)))
    return () => {
      cancelled = true
    }
  }
}

export async function loadOlderTogetherPosts(
  viewerUid: string,
  beforeCreatedAt: string,
  pageSize = 30,
): Promise<RankedPost[]> {
  const raw = await queryFeed(viewerUid, pageSize, beforeCreatedAt)
  const hydrated = await hydrateMediaUrls(raw)
  return rankFeedPosts(hydrated)
}

/** Posts by one author that the viewer is allowed to see (own profile or friend timeline). */
export async function listPostsByAuthor(
  viewerUid: string,
  authorId: string,
  pageSize = 50,
): Promise<RankedPost[]> {
  const { data, error } = await getSupabase()
    .from('together_posts')
    .select('*')
    .eq('author_id', authorId)
    .contains('viewer_ids', [viewerUid])
    .order('created_at', { ascending: false })
    .limit(pageSize)
  if (error) throw error
  const raw = (data || []).map((d) => mapPost(d as PostRow))
  const hydrated = await hydrateMediaUrls(raw)
  return rankFeedPosts(hydrated)
}

export async function resolveAuthorPhotos(
  authorIds: string[],
): Promise<Record<string, string | null>> {
  const unique = [...new Set(authorIds.filter(Boolean))]
  const out: Record<string, string | null> = {}
  const profiles = await getCloudProfiles(unique)
  await Promise.all(
    profiles.map(async (p) => {
      out[p.uid] = await resolveProfilePhotoUrl(p.photoURL)
    }),
  )
  return out
}

export async function resolveAuthorNames(
  authorIds: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(authorIds)]
  const out: Record<string, string> = {}
  await Promise.all(
    unique.map(async (uid) => {
      try {
        const profile = await getCloudProfile(uid)
        out[uid] = profile?.displayName || 'Friend'
      } catch {
        out[uid] = 'Friend'
      }
    }),
  )
  return out
}
