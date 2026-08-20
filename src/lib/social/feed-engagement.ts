import { getSupabase } from '@/lib/supabase'
import { createId } from '@/lib/id'
import {
  createTogetherPost,
  type FeedAudience,
  type FeedCard,
  type FeedMedia,
  type TogetherPost,
} from '@/lib/social/feed'

export const COMMENT_TEXT_MAX = 280

export type PostEngagement = {
  likeCount: number
  commentCount: number
  likedByMe: boolean
  repostedByMe: boolean
}

export type FeedComment = {
  id: string
  postId: string
  authorId: string
  text: string
  createdAt: string
  parentId: string | null
  likeCount: number
  likedByMe: boolean
}

export type NestedFeedComments = {
  roots: FeedComment[]
  repliesByParent: Record<string, FeedComment[]>
}

export function nestFeedComments(comments: FeedComment[]): NestedFeedComments {
  const byId = new Map(comments.map((c) => [c.id, c]))
  const repliesByParent: Record<string, FeedComment[]> = {}
  const roots: FeedComment[] = []
  for (const comment of comments) {
    const parent = comment.parentId ? byId.get(comment.parentId) : null
    const rootId = parent?.parentId ? parent.parentId : comment.parentId
    if (!rootId || !byId.has(rootId)) {
      roots.push(comment)
      continue
    }
    if (!repliesByParent[rootId]) repliesByParent[rootId] = []
    repliesByParent[rootId].push(comment)
  }
  return { roots, repliesByParent }
}

function mapComment(row: {
  id: string
  post_id: string
  author_id: string
  text: string
  created_at: string
  parent_id?: string | null
}): FeedComment {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    text: row.text,
    createdAt: row.created_at,
    parentId: row.parent_id ?? null,
    likeCount: 0,
    likedByMe: false,
  }
}

export type RepostSnapshot = {
  postId: string
  authorId: string
  text: string
  media: FeedMedia[]
  card?: FeedCard | null
  createdAt: string
}

const emptyEngagement = (): PostEngagement => ({
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  repostedByMe: false,
})

function isMissingRelation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message || err)
  return /relation .* does not exist|Could not find the table|schema cache/i.test(msg)
}

function asError(err: unknown): Error {
  if (err instanceof Error) return err
  const msg =
    typeof err === 'object' && err && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err)
  return new Error(msg || 'Request failed')
}

export async function loadEngagementForPosts(
  postIds: string[],
  userId: string,
): Promise<Record<string, PostEngagement>> {
  const out: Record<string, PostEngagement> = {}
  for (const id of postIds) out[id] = emptyEngagement()
  if (postIds.length === 0) return out

  const supabase = getSupabase()
  try {
    const [{ data: likes, error: likeErr }, { data: comments, error: commentErr }] =
      await Promise.all([
        supabase.from('together_post_likes').select('post_id, user_id').in('post_id', postIds),
        supabase.from('together_post_comments').select('post_id').in('post_id', postIds),
      ])
    if (likeErr) throw asError(likeErr)
    if (commentErr) throw asError(commentErr)

    for (const row of likes || []) {
      const e = out[row.post_id] || emptyEngagement()
      e.likeCount += 1
      if (row.user_id === userId) e.likedByMe = true
      out[row.post_id] = e
    }
    for (const row of comments || []) {
      const e = out[row.post_id] || emptyEngagement()
      e.commentCount += 1
      out[row.post_id] = e
    }
  } catch (err) {
    if (!isMissingRelation(err) && !/permission denied/i.test(asError(err).message)) throw asError(err)
  }

  // Reposts are posts authored by me with repost.postId matching
  try {
    const { data: myReposts, error } = await supabase
      .from('together_posts')
      .select('repost')
      .eq('author_id', userId)
      .not('repost', 'is', null)
    if (error) throw asError(error)
    for (const row of myReposts || []) {
      const snap = row.repost as RepostSnapshot | null
      if (snap?.postId && out[snap.postId]) out[snap.postId].repostedByMe = true
    }
  } catch {
    // column may be missing until migration
  }

  return out
}

export async function togglePostLike(postId: string, userId: string, currentlyLiked: boolean) {
  const supabase = getSupabase()
  if (currentlyLiked) {
    const { error } = await supabase
      .from('together_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) throw asError(error)
    return false
  }
  const { error } = await supabase.from('together_post_likes').insert({
    post_id: postId,
    user_id: userId,
  })
  if (error) throw asError(error)
  return true
}

export async function listPostComments(postId: string, userId?: string): Promise<FeedComment[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('together_post_comments')
    .select('id, post_id, author_id, text, created_at, parent_id')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) {
    if (/parent_id|schema cache|column/i.test(error.message)) {
      const fallback = await supabase
        .from('together_post_comments')
        .select('id, post_id, author_id, text, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
      if (fallback.error) throw asError(fallback.error)
      return attachCommentLikes(
        (fallback.data || []).map((r) => mapComment(r)),
        userId,
      )
    }
    throw asError(error)
  }
  return attachCommentLikes((data || []).map((r) => mapComment(r)), userId)
}

async function attachCommentLikes(comments: FeedComment[], userId?: string): Promise<FeedComment[]> {
  if (comments.length === 0) return comments
  try {
    const { data, error } = await getSupabase()
      .from('together_comment_likes')
      .select('comment_id, user_id')
      .in(
        'comment_id',
        comments.map((c) => c.id),
      )
    if (error) throw asError(error)
    const counts = new Map<string, { likeCount: number; likedByMe: boolean }>()
    for (const row of data || []) {
      const cur = counts.get(row.comment_id) || { likeCount: 0, likedByMe: false }
      cur.likeCount += 1
      if (userId && row.user_id === userId) cur.likedByMe = true
      counts.set(row.comment_id, cur)
    }
    return comments.map((c) => {
      const extra = counts.get(c.id)
      return extra ? { ...c, ...extra } : c
    })
  } catch (err) {
    if (isMissingRelation(err) || /permission denied/i.test(asError(err).message)) return comments
    throw asError(err)
  }
}

export async function toggleCommentLike(commentId: string, userId: string, currentlyLiked: boolean) {
  const supabase = getSupabase()
  if (currentlyLiked) {
    const { error } = await supabase
      .from('together_comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId)
    if (error) throw asError(error)
    return false
  }
  const { error } = await supabase.from('together_comment_likes').insert({
    comment_id: commentId,
    user_id: userId,
  })
  if (error) throw asError(error)
  return true
}

export async function addPostComment(input: {
  postId: string
  authorId: string
  text: string
  parentId?: string | null
}): Promise<FeedComment> {
  const text = input.text.trim()
  if (!text) throw new Error('Write a comment first')
  if (text.length > COMMENT_TEXT_MAX) throw new Error(`Keep comments under ${COMMENT_TEXT_MAX} characters`)
  const id = createId()
  const createdAt = new Date().toISOString()
  const parentId = input.parentId || null
  const row = {
    id,
    post_id: input.postId,
    author_id: input.authorId,
    text,
    created_at: createdAt,
    ...(parentId ? { parent_id: parentId } : {}),
  }
  const { error } = await getSupabase().from('together_post_comments').insert(row)
  if (error) {
    if (parentId && /parent_id|schema cache|column/i.test(error.message)) {
      const retry = await getSupabase().from('together_post_comments').insert({
        id,
        post_id: input.postId,
        author_id: input.authorId,
        text,
        created_at: createdAt,
      })
      if (retry.error) throw asError(retry.error)
      return {
        id,
        postId: input.postId,
        authorId: input.authorId,
        text,
        createdAt,
        parentId: null,
        likeCount: 0,
        likedByMe: false,
      }
    }
    throw asError(error)
  }
  return {
    id,
    postId: input.postId,
    authorId: input.authorId,
    text,
    createdAt,
    parentId,
    likeCount: 0,
    likedByMe: false,
  }
}

export async function deletePostComment(commentId: string): Promise<void> {
  const { error } = await getSupabase().from('together_post_comments').delete().eq('id', commentId)
  if (error) throw asError(error)
}

export async function createRepost(input: {
  userId: string
  original: TogetherPost
  audience?: FeedAudience
  circleId?: string | null
  quote?: string
}): Promise<TogetherPost> {
  if (input.original.authorId === input.userId) {
    throw new Error('You already posted this')
  }
  const snapshot: RepostSnapshot = {
    postId: input.original.id,
    authorId: input.original.authorId,
    text: input.original.text,
    media: (input.original.media || []).map(({ type, path, contentType, width, height, durationMs }) => ({
      type,
      path,
      contentType,
      ...(width != null ? { width } : {}),
      ...(height != null ? { height } : {}),
      ...(durationMs != null ? { durationMs } : {}),
    })),
    card: input.original.card ?? null,
    createdAt: input.original.createdAt,
  }

  return createTogetherPost({
    authorId: input.userId,
    text: (input.quote || '').trim(),
    audience: input.audience || 'friends',
    circleId: input.circleId,
    card: null,
    files: [],
    repost: snapshot,
  })
}
