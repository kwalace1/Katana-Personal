import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Newspaper } from 'lucide-react'
import { toast } from 'sonner'
import { TogetherSetup } from '@/components/TogetherSetup'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle, staggerContainer } from '@/lib/motion-ui'
import { listMyCircles } from '@/lib/social/circles'
import {
  loadOlderTogetherPosts,
  resolveAuthorNames,
  resolveAuthorPhotos,
  subscribeTogetherFeed,
  type RankedPost,
} from '@/lib/social/feed'
import {
  loadEngagementForPosts,
  type PostEngagement,
} from '@/lib/social/feed-engagement'
import { resolveProfilePhotoUrl } from '@/lib/social/friends'
import type { CircleGroup } from '@/lib/social/types'
import { FeedPostCard } from '@/modules/social/components/FeedPostCard'
import { FriendsPanel } from '@/modules/social/components/FriendsPanel'
import { useSharedSocialInbox } from '@/contexts/SocialInboxContext'
import { cn } from '@/lib/utils'

/**
 * Social feed — cheer wins shared from the day loop (ShareWin).
 * Freeform photo/video/update compose is intentionally not available here.
 */
export default function FeedPage() {
  const { user } = useAuth()
  const { cloudEnabled, cloudUser, cloudProfile } = useCloudAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { pendingCount } = useSharedSocialInbox()
  void user
  const tab = searchParams.get('tab') === 'friends' ? 'friends' : 'feed'

  const [posts, setPosts] = useState<RankedPost[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<Record<string, string | null>>({})
  const [selfPhoto, setSelfPhoto] = useState<string | null>(null)
  const [engagement, setEngagement] = useState<Record<string, PostEngagement>>({})
  const [circles, setCircles] = useState<CircleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const selfName = cloudProfile?.displayName || 'You'

  const circleNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of circles) map[c.id] = c.name
    return map
  }, [circles])

  useEffect(() => {
    if (!cloudProfile?.photoURL) {
      setSelfPhoto(null)
      return
    }
    let cancelled = false
    void resolveProfilePhotoUrl(cloudProfile.photoURL).then((url) => {
      if (!cancelled) setSelfPhoto(url)
    })
    return () => {
      cancelled = true
    }
  }, [cloudProfile?.photoURL])

  function setTab(next: 'feed' | 'friends') {
    const params = new URLSearchParams(searchParams)
    if (next === 'friends') params.set('tab', 'friends')
    else params.delete('tab')
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    if (!cloudUser) {
      setLoading(false)
      setPosts([])
      return
    }
    setLoading(true)
    const unsub = subscribeTogetherFeed(
      cloudUser.uid,
      (next) => {
        setPosts(next)
        setLoading(false)
        const authorIds = next.flatMap((p) => [
          p.authorId,
          ...(p.repost ? [p.repost.authorId] : []),
        ])
        void resolveAuthorNames(authorIds).then(setNames)
        void resolveAuthorPhotos(authorIds).then(setPhotos)
        void loadEngagementForPosts(
          next.map((p) => p.id),
          cloudUser.uid,
        ).then(setEngagement)
      },
      (err) => {
        toast.error(err.message || 'Feed failed to load')
        setLoading(false)
      },
    )
    return () => unsub()
  }, [cloudUser])

  useEffect(() => {
    if (!cloudUser) return
    let cancelled = false
    void listMyCircles(cloudUser.uid).then((list) => {
      if (!cancelled) setCircles(list)
    })
    return () => {
      cancelled = true
    }
  }, [cloudUser])

  async function loadMore() {
    if (!cloudUser || posts.length === 0) return
    const oldest = posts.reduce((a, b) => (a.createdAt < b.createdAt ? a : b))
    setLoadingMore(true)
    try {
      const older = await loadOlderTogetherPosts(cloudUser.uid, oldest.createdAt)
      if (older.length === 0) {
        toast.message('That’s the end of your feed')
        return
      }
      setPosts((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]))
        for (const p of older) map.set(p.id, p)
        return Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      })
      const authorIds = older.flatMap((p) => [
        p.authorId,
        ...(p.repost ? [p.repost.authorId] : []),
      ])
      void resolveAuthorNames(authorIds).then((extra) => setNames((n) => ({ ...n, ...extra })))
      void resolveAuthorPhotos(authorIds).then((extra) => setPhotos((p) => ({ ...p, ...extra })))
      void loadEngagementForPosts(
        older.map((p) => p.id),
        cloudUser.uid,
      ).then((extra) => setEngagement((e) => ({ ...e, ...extra })))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t load more')
    } finally {
      setLoadingMore(false)
    }
  }

  if (!cloudEnabled) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-xl px-0 sm:px-6">
        <SocialHero tab={tab} onTabChange={setTab} pendingFriends={0} />
        <div className="px-4 sm:px-0">
          <TogetherSetup />
        </div>
      </motion.div>
    )
  }

  if (!cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-xl px-0 sm:px-6">
        <SocialHero tab={tab} onTabChange={setTab} pendingFriends={0} />
        <div className="px-4 sm:px-0">
          <EmptyState
            title="Connect to open Social"
            description="Friends and Circles stay opt-in. Private life stays on this device."
            action={
              <Button asChild>
                <Link to="/settings#cloud">Connect</Link>
              </Button>
            }
          />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div {...pageEnterSubtle} className="relative mx-auto w-full max-w-xl overflow-x-hidden pb-10">
      <SocialHero tab={tab} onTabChange={setTab} pendingFriends={pendingCount} />

      {tab === 'friends' ? (
        <FriendsPanel embedded />
      ) : (
        <>
          <p className="border-b border-border/50 px-4 py-3 text-sm text-muted-foreground sm:px-5">
            Wins from Today, tasks, calendar, habits, journal, health, and day close show up here — no random posts.
          </p>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <div className="px-4 py-10 sm:px-5">
              <EmptyState
                icon={Newspaper}
                title="No wins shared yet"
                description="Create or finish something in Today, Tasks, Calendar, Habits, Goals, Journal, or Health — then share the win when Katana offers it."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild>
                      <Link to="/dashboard">Open Today</Link>
                    </Button>
                    <Button variant="outline" onClick={() => setTab('friends')}>
                      Invite a friend
                    </Button>
                  </div>
                }
              />
              <p className="mt-6 text-center text-xs text-muted-foreground">
                How Together works:{' '}
                <button type="button" className="text-primary underline" onClick={() => setTab('friends')}>
                  Friends
                </button>
                {' · '}
                <Link to="/shared" className="text-primary underline">
                  Plans
                </Link>
                {' · '}
                <Link to="/circles" className="text-primary underline">
                  Circles
                </Link>
              </p>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="overflow-hidden border-y border-border/40 sm:rounded-none"
            >
              {posts.map((post) => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  authorName={
                    post.authorId === cloudUser.uid ? selfName : names[post.authorId] || 'Friend'
                  }
                  authorPhotoURL={
                    post.authorId === cloudUser.uid ? selfPhoto : photos[post.authorId]
                  }
                  selfUid={cloudUser.uid}
                  selfName={selfName}
                  circleName={post.circleId ? circleNames[post.circleId] : undefined}
                  engagement={
                    engagement[post.id] || {
                      likeCount: 0,
                      commentCount: 0,
                      likedByMe: false,
                      repostedByMe: false,
                    }
                  }
                  onEngagementChange={(next) =>
                    setEngagement((e) => ({ ...e, [post.id]: next }))
                  }
                  onDeleted={() => setPosts((p) => p.filter((x) => x.id !== post.id))}
                  names={names}
                  photos={photos}
                  onNames={(extra) => setNames((n) => ({ ...n, ...extra }))}
                />
              ))}
              <div className="flex justify-center bg-card/30 py-5">
                <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? 'Loading…' : 'Load earlier'}
                </Button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}

function SocialHero({
  tab,
  onTabChange,
  pendingFriends,
}: {
  tab: 'feed' | 'friends'
  onTabChange: (tab: 'feed' | 'friends') => void
  pendingFriends: number
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-background/90 backdrop-blur-md">
      <div className="px-4 pt-3 sm:px-5">
        <h1 className="font-display text-xl tracking-tight sm:text-2xl">Social</h1>
        <p className="text-xs text-muted-foreground">
          Cheer real wins from the day loop — not a general feed.
        </p>
      </div>
      <div className="mt-3 flex px-2 sm:px-3">
        <button
          type="button"
          onClick={() => onTabChange('feed')}
          className={cn(
            'flex-1 border-b-2 px-3 py-2.5 text-sm font-semibold transition',
            tab === 'feed'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Feed
        </button>
        <button
          type="button"
          onClick={() => onTabChange('friends')}
          className={cn(
            'flex-1 border-b-2 px-3 py-2.5 text-sm font-semibold transition',
            tab === 'friends'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Friends{pendingFriends > 0 ? ` (${pendingFriends > 9 ? '9+' : pendingFriends})` : ''}
        </button>
      </div>
    </header>
  )
}
