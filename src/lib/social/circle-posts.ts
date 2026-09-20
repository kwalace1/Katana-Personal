import { getSupabase } from '@/lib/supabase'
import { createId } from '@/lib/id'
import { getCircle } from './circles'
import { getCloudProfile, type Unsubscribe } from './friends'
import { notifyCirclePost } from './notifications'

export interface CirclePost {
  id: string
  circleId: string
  authorId: string
  message: string
  createdAt: string
}

type PostRow = {
  id: string
  circle_id: string
  author_id: string
  message: string
  created_at: string
}

function mapPost(row: PostRow): CirclePost {
  return {
    id: row.id,
    circleId: row.circle_id,
    authorId: row.author_id,
    message: row.message,
    createdAt: row.created_at,
  }
}

export async function listCirclePosts(circleId: string): Promise<CirclePost[]> {
  const { data, error } = await getSupabase()
    .from('circle_posts')
    .select('*')
    .eq('circle_id', circleId)
  if (error) throw error
  return (data || [])
    .map((d) => mapPost(d as PostRow))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function subscribeCirclePosts(
  circleId: string,
  onChange: (posts: CirclePost[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const supabase = getSupabase()
  let cancelled = false

  const refresh = () => {
    void listCirclePosts(circleId)
      .then((posts) => {
        if (!cancelled) onChange(posts)
      })
      .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))))
  }

  refresh()

  const topic = `circle_posts:${circleId}:${crypto.randomUUID?.() || String(Date.now())}`
  try {
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'circle_posts', filter: `circle_id=eq.${circleId}` },
        refresh,
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  } catch (err) {
    console.warn('Realtime circle posts unavailable', err)
    onError?.(err instanceof Error ? err : new Error(String(err)))
    return () => {
      cancelled = true
    }
  }
}

export async function createCirclePost(input: {
  circleId: string
  authorId: string
  message: string
}): Promise<CirclePost> {
  const message = input.message.trim()
  if (!message) throw new Error('Write something first.')
  if (message.length > 500) throw new Error('Keep it under 500 characters.')
  const createdAt = new Date().toISOString()
  const id = createId()
  const row = {
    id,
    circle_id: input.circleId,
    author_id: input.authorId,
    message,
    created_at: createdAt,
  }
  const { data, error } = await getSupabase().from('circle_posts').insert(row).select('*').single()
  if (error) throw error
  const post = mapPost(data as PostRow)

  try {
    const [circle, author] = await Promise.all([
      getCircle(input.circleId),
      getCloudProfile(input.authorId),
    ])
    if (circle) {
      void notifyCirclePost({
        authorId: input.authorId,
        authorName: author?.displayName || 'Someone',
        recipientIds: circle.memberIds,
        circleId: circle.id,
        circleName: circle.name,
        preview: message,
      })
    }
  } catch {
    // Never block posting on notification failure
  }

  return post
}

export async function deleteCirclePost(id: string): Promise<void> {
  const { error } = await getSupabase().from('circle_posts').delete().eq('id', id)
  if (error) throw error
}
