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
  const msg = err instanceof Error ? err.message : String(err)
  return /relation .* does not exist|Could not find the table|schema cache/i.test(msg)
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
    if (likeErr) throw likeErr
    if (commentErr) throw commentErr

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
    if (!isMissingRelation(err)) throw err
  }

  // Reposts are posts authored by me with repost.postId matching
  try {
    const { data: myReposts, error } = await supabase
      .from('together_posts')
      .select('repost')
      .eq('author_id', userId)
      .not('repost', 'is', null)
    if (error) throw error
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
    if (error) throw error
    return false
  }
  const { error } = await supabase.from('together_post_likes').insert({
    post_id: postId,
    user_id: userId,
  })
  if (error) throw error
  return true
}

export async function listPostComments(postId: string): Promise<FeedComment[]> {
  const { data, error } = await getSupabase()
    .from('together_post_comments')
    .select('id, post_id, author_id, text, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map((r) => ({
    id: r.id,
    postId: r.post_id,
    authorId: r.author_id,
    text: r.text,
    createdAt: r.created_at,
  }))
}

export async function addPostComment(input: {
  postId: string
  authorId: string
  text: string
}): Promise<FeedComment> {
  const text = input.text.trim()
  if (!text) throw new Error('Write a comment first')
  if (text.length > COMMENT_TEXT_MAX) throw new Error(`Keep comments under ${COMMENT_TEXT_MAX} characters`)
  const id = createId()
  const createdAt = new Date().toISOString()
  const { error } = await getSupabase().from('together_post_comments').insert({
    id,
    post_id: input.postId,
    author_id: input.authorId,
    text,
    created_at: createdAt,
  })
  if (error) throw error
  return {
    id,
    postId: input.postId,
    authorId: input.authorId,
    text,
    createdAt,
  }
}

export async function deletePostComment(commentId: string): Promise<void> {
  const { error } = await getSupabase().from('together_post_comments').delete().eq('id', commentId)
  if (error) throw error
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
