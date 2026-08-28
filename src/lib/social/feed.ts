import { getSupabase } from '@/lib/supabase'
import { createId } from '@/lib/id'
import { listMyCircles } from '@/lib/social/circles'
import {
  feedMediaStoragePaths,
  signFeedMediaTimeline,
  uploadTogetherFile,
} from '@/lib/social/feed-media-storage'
import { listFriendProfiles, getCloudProfile, getCloudProfiles, resolveProfilePhotoUrl, type Unsubscribe } from '@/lib/social/friends'
import { createNotification } from '@/lib/social/notifications'

export const FEED_TEXT_MAX = 500
/** Hard reject — uploads are compressed well below this. */
export const FEED_IMAGE_MAX_BYTES = 5 * 1024 * 1024
/** Target size for stored display image (full view on tap). */
export const FEED_IMAGE_DISPLAY_MAX_BYTES = 450 * 1024
/** Target size for feed timeline thumbnails. */
export const FEED_IMAGE_THUMB_MAX_BYTES = 120 * 1024
/** Keep clips short — limits Storage + egress. */
export const FEED_VIDEO_MAX_SECONDS = 15
export const FEED_VIDEO_MAX_MS = FEED_VIDEO_MAX_SECONDS * 1000
export const FEED_VIDEO_MAX_BYTES = 6 * 1024 * 1024
export const FEED_VIDEO_POSTER_MAX_BYTES = 100 * 1024
/** Default feed page — smaller pages = less media per open. */
export const FEED_PAGE_SIZE = 15
export const CIRCLE_BOOST_MS = 12 * 60 * 60 * 1000 // kept for older clients; main Feed is chronological now

export type FeedAudience = 'friends' | 'circle'
export type FeedMediaType = 'image' | 'video'
export type FeedCardKind = 'goal' | 'habit' | 'workout' | 'day' | 'task' | 'event' | 'journal'


export interface FeedMedia {
  type: FeedMediaType
  /** Full display file — signed only on tap / play. */
  path: string
  /** Small JPEG for feed timeline (images). */
  thumbPath?: string
  /** Still frame for feed timeline (videos). */
  posterPath?: string
  contentType: string
  /** Timeline thumb/poster URL after hydrate — not the full file. */
  url?: string
  width?: number
  height?: number
  durationMs?: number
}

export interface FeedCardLiftSet {
  weight: number
  reps: number
}

export interface FeedCardLift {
  name: string
  sets: FeedCardLiftSet[]
}

export interface FeedCard {
  kind: FeedCardKind
  title: string
  subtitle?: string
  stats?: string
  /** Short celebratory label shown on the card (e.g. “Goal crushed”). */
  badge?: string
  /** Optional journal line — used on day cards. */
  quote?: string
  /** Logged exercises for workout cards — shown when the card is expanded. */
  lifts?: FeedCardLift[]
}

export function formatFeedCardLiftLine(lift: FeedCardLift): string {
  const sets = (lift.sets || [])
    .filter((s) => Number(s.reps) > 0 || Number(s.weight) > 0)
    .map((s) => `${s.weight} lb × ${s.reps}`)
  return sets.length > 0 ? `${lift.name}: ${sets.join(' · ')}` : lift.name
}

export function summarizeFeedCardLifts(lifts: FeedCardLift[] | undefined): string {
  const rows = (lifts || []).filter((l) => l.name.trim())
  if (rows.length === 0) return ''
  const sets = rows.reduce((n, l) => n + (l.sets?.length || 0), 0)
  return `${rows.length} exercise${rows.length === 1 ? '' : 's'} · ${sets} set${sets === 1 ? '' : 's'}`
}

export interface FeedMention {
  uid: string
  name: string
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
  mentions: FeedMention[]
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
  mentions?: FeedMention[] | null
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
    mentions: row.mentions || [],
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
  const { prepareFeedMedia } = await import('@/lib/social/feed-media-compress')
  const prepared = await prepareFeedMedia(input.file)
  const file = prepared.file
  const type = prepared.type
  const durationMs = prepared.durationMs
  const stamp = Date.now()
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80) || `${type}`
  const objectPath = storageObjectPath(input.authorId, input.postId, `${stamp}_${safeName}`)
  await uploadTogetherFile(objectPath, file, file.type)

  let thumbPath: string | undefined
  let posterPath: string | undefined

  if (prepared.thumbFile) {
    thumbPath = storageObjectPath(input.authorId, input.postId, `${stamp}_thumb.jpg`)
    await uploadTogetherFile(thumbPath, prepared.thumbFile, prepared.thumbFile.type)
  }
  if (prepared.posterFile) {
    posterPath = storageObjectPath(input.authorId, input.postId, `${stamp}_poster.jpg`)
    await uploadTogetherFile(posterPath, prepared.posterFile, prepared.posterFile.type)
  }

  const media: FeedMedia = {
    type,
    path: objectPath,
    contentType: file.type,
    ...(thumbPath ? { thumbPath } : {}),
    ...(posterPath ? { posterPath } : {}),
    ...(durationMs != null ? { durationMs } : {}),
  }
  const url = await signFeedMediaTimeline(media)
  return url ? { ...media, url } : media
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
  mentions?: FeedMention[]
}): Promise<TogetherPost> {
  const text = input.text.trim()
  if (text.length > FEED_TEXT_MAX) throw new Error(`Keep it under ${FEED_TEXT_MAX} characters.`)
  const files = input.files || []
  // Photos/videos only ride along with a win card (or repost) — not free-form gallery posts.
  if (files.length > 0 && !input.card && !input.repost) {
    throw new Error('Photos go with a win — finish something, then add media when you share.')
  }
  // Friends Social is wins-first: a win card or a repost.
  if (input.audience === 'friends' && !input.card && !input.repost) {
    throw new Error('Social is for wins — finish something, then share the card.')
  }
  if (!text && files.length === 0 && !input.card && !input.repost) {
    throw new Error('Write something or attach a win card.')
  }
  if (files.length > 4) throw new Error('Up to 4 media files per post.')

  const viewerIds = await resolveViewerIds({
    authorId: input.authorId,
    audience: input.audience,
    circleId: input.circleId,
  })
  const viewerSet = new Set(viewerIds)
  const mentions = (input.mentions || [])
    .filter((mention) => mention.uid !== input.authorId && viewerSet.has(mention.uid))
    .filter(
      (mention, index, all) => all.findIndex((candidate) => candidate.uid === mention.uid) === index,
    )

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
    media: serializeMedia(media),
    card: input.card || null,
    repost: input.repost || null,
    mentions,
  }

  const { error } = await getSupabase().from('together_posts').insert(row)
  if (error) throw error
  const author = await getCloudProfile(input.authorId)
  await Promise.all(
    mentions.map((mention) =>
      createNotification({
        uid: mention.uid,
        kind: 'post_mention',
        title: `${author?.displayName || 'A friend'} mentioned you`,
        body: text.slice(0, 180) || 'Open Social to see the post',
        href: '/social',
        meta: { postId: id, actorId: input.authorId },
      }).catch(() => undefined),
    ),
  )
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
    mentions,
  }
}

export async function deleteTogetherPost(id: string): Promise<void> {
  const { error } = await getSupabase().from('together_posts').delete().eq('id', id)
  if (error) throw error
}

function serializeMedia(media: FeedMedia[]) {
  return media.map(({ type, path, thumbPath, posterPath, contentType, width, height, durationMs }) => ({
    type,
    path,
    contentType,
    ...(thumbPath ? { thumbPath } : {}),
    ...(posterPath ? { posterPath } : {}),
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
    ...(durationMs != null ? { durationMs } : {}),
  }))
}

/** Edit text + media only (win card / audience / repost unchanged). */
export async function updateTogetherPost(input: {
  postId: string
  authorId: string
  text: string
  keepMedia: FeedMedia[]
  newFiles?: File[]
}): Promise<TogetherPost> {
  const text = input.text.trim()
  if (text.length > FEED_TEXT_MAX) throw new Error(`Keep it under ${FEED_TEXT_MAX} characters.`)
  const newFiles = input.newFiles || []
  if (input.keepMedia.length + newFiles.length > 4) {
    throw new Error('Up to 4 media files per post.')
  }

  const supabase = getSupabase()
  const { data: existingRow, error: loadErr } = await supabase
    .from('together_posts')
    .select('*')
    .eq('id', input.postId)
    .eq('author_id', input.authorId)
    .maybeSingle()
  if (loadErr) throw loadErr
  if (!existingRow) throw new Error('Post not found.')
  const existing = mapPost(existingRow as PostRow)

  if (newFiles.length > 0 && !existing.card && !existing.repost) {
    throw new Error('Photos go with a win — add media when you share an accomplishment.')
  }

  if (
    !text &&
    input.keepMedia.length + newFiles.length === 0 &&
    !existing.card &&
    !existing.repost
  ) {
    throw new Error('Write something or keep media.')
  }

  const uploaded: FeedMedia[] = []
  for (const file of newFiles) {
    await assertFeedMedia(file)
    uploaded.push(
      await uploadFeedMedia({ authorId: input.authorId, postId: input.postId, file }),
    )
  }
  const media = [...input.keepMedia, ...uploaded]
  const mentions = existing.mentions.filter((mention) =>
    text.toLowerCase().includes(`@${mention.name.toLowerCase()}`),
  )
  const keptPaths = new Set(media.flatMap((m) => feedMediaStoragePaths(m)))
  const removedPaths = existing.media
    .flatMap((m) => feedMediaStoragePaths(m))
    .filter((p) => !keptPaths.has(p))

  const { data, error } = await supabase
    .from('together_posts')
    .update({
      text,
      media: serializeMedia(media),
      mentions,
    })
    .eq('id', input.postId)
    .eq('author_id', input.authorId)
    .select('*')
    .maybeSingle()

  if (error) {
    if (/permission denied|row-level security|policy/i.test(error.message)) {
      throw new Error('Editing needs a cloud update — run the latest Supabase migration.')
    }
    throw error
  }
  if (!data) throw new Error('Couldn’t update that post.')

  if (removedPaths.length > 0) {
    void supabase.storage.from('together').remove(removedPaths)
  }

  const post = mapPost(data as PostRow)
  return {
    ...post,
    media: media.map((m) => ({ ...m })),
  }
}

/** Persist a report. Caller should hide locally and optionally offer block. */
export async function reportTogetherPost(input: {
  postId: string
  reporterId: string
  authorId: string
  reason: string
  note?: string
}): Promise<void> {
  if (input.reporterId === input.authorId) {
    throw new Error('You can’t report your own post.')
  }
  const reason = input.reason.trim()
  if (!reason) throw new Error('Pick a reason.')
  const note = (input.note || '').trim().slice(0, 280)
  const { error } = await getSupabase().from('together_post_reports').insert({
    id: createId(),
    post_id: input.postId,
    reporter_id: input.reporterId,
    author_id: input.authorId,
    reason,
    note,
    created_at: new Date().toISOString(),
  })
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new Error('You already reported this post.')
    }
    if (/does not exist|schema cache|permission denied|row-level security|policy/i.test(error.message)) {
      throw new Error('Reporting needs a cloud update — run the latest Supabase migration.')
    }
    throw error
  }
}

/** Newest first — no circle boost (Circles live in their own Social tab). */
export function rankFeedPosts(posts: TogetherPost[]): RankedPost[] {
  return posts
    .map((p) => {
      const createdAtMs = Date.parse(p.createdAt) || 0
      return { ...p, score: createdAtMs }
    })
    .sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
}

export function filterFeedByAudience(
  posts: RankedPost[],
  audience: FeedAudience,
): RankedPost[] {
  return posts.filter((p) => p.audience === audience)
}

/** Sign thumb/poster URLs only — full files load on tap or play. */
async function hydrateMediaUrls(posts: TogetherPost[]): Promise<TogetherPost[]> {
  const signOne = async (m: FeedMedia): Promise<FeedMedia> => {
    if (m.url) return m
    try {
      const url = await signFeedMediaTimeline(m)
      return url ? { ...m, url } : m
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

const FEED_REFRESH_DEBOUNCE_MS = 1500

export function subscribeTogetherFeed(
  viewerUid: string,
  onChange: (posts: RankedPost[]) => void,
  onError?: (err: Error) => void,
  pageSize = FEED_PAGE_SIZE,
): Unsubscribe {
  const supabase = getSupabase()
  let cancelled = false
  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  const runRefresh = () => {
    void queryFeed(viewerUid, pageSize)
      .then(async (raw) => {
        const hydrated = await hydrateMediaUrls(raw)
        if (!cancelled) onChange(rankFeedPosts(hydrated))
      })
      .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))))
  }

  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      runRefresh()
    }, FEED_REFRESH_DEBOUNCE_MS)
  }

  runRefresh()

  const topic = `together_feed:${viewerUid}:${crypto.randomUUID?.() || String(Date.now())}`
  try {
    const channel = supabase
      .channel(topic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'together_posts' }, scheduleRefresh)
      .subscribe()

    return () => {
      cancelled = true
      if (refreshTimer) clearTimeout(refreshTimer)
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
  pageSize = FEED_PAGE_SIZE,
): Promise<RankedPost[]> {
  const raw = await queryFeed(viewerUid, pageSize, beforeCreatedAt)
  const hydrated = await hydrateMediaUrls(raw)
  return rankFeedPosts(hydrated)
}

/** Posts by one author that the viewer is allowed to see (own profile or friend timeline). */
export async function listPostsByAuthor(
  viewerUid: string,
  authorId: string,
  pageSize = 20,
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
