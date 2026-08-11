import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Loader2, Newspaper, Users } from 'lucide-react'
import { toast } from 'sonner'
import { TogetherSetup } from '@/components/TogetherSetup'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { format } from '@/lib/dates'
import { pageEnterSubtle, staggerContainer } from '@/lib/motion-ui'
import { listMyCircles } from '@/lib/social/circles'
import {
  filterFeedByAudience,
  listPostsByAuthor,
  loadOlderTogetherPosts,
  resolveAuthorNames,
  resolveAuthorPhotos,
  subscribeTogetherFeed,
  type RankedPost,
} from '@/lib/social/feed'
import { filterHiddenPosts } from '@/lib/social/feed-moderation'
import {
  loadEngagementForPosts,
  type PostEngagement,
} from '@/lib/social/feed-engagement'
import { resolveProfilePhotoUrl } from '@/lib/social/friends'
import { offerFeelingShare } from '@/lib/social/share-win'
import type { CircleGroup } from '@/lib/social/types'
import { FeedPostCard } from '@/modules/social/components/FeedPostCard'
import { FriendsPanel } from '@/modules/social/components/FriendsPanel'
import { useSharedSocialInbox } from '@/contexts/SocialInboxContext'
import { cn } from '@/lib/utils'

type SocialTab = 'feed' | 'circles' | 'mine' | 'friends'

const FEELINGS = ['Great', 'Good', 'Okay', 'Low', 'Rough'] as const

/**
 * Social — wins-only posts. Feed is friends chronological;
 * Circles and My posts are separate tabs.
 */
export default function FeedPage() {
  const { user } = useAuth()
  const { cloudEnabled, cloudUser, cloudProfile } = useCloudAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { pendingCount } = useSharedSocialInbox()
  void user

  const tab = parseTab(searchParams.get('tab'))
  const circleFilter = searchParams.get('circle') || 'all'

  const [allPosts, setAllPosts] = useState<RankedPost[]>([])
  const [myPosts, setMyPosts] = useState<RankedPost[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<Record<string, string | null>>({})
  const [selfPhoto, setSelfPhoto] = useState<string | null>(null)
  const [engagement, setEngagement] = useState<Record<string, PostEngagement>>({})
  const [circles, setCircles] = useState<CircleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [mineLoading, setMineLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [feelingOpen, setFeelingOpen] = useState(false)
  const [circleQuery, setCircleQuery] = useState('')

  const selfName = cloudProfile?.displayName || 'You'

  const circleNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of circles) map[c.id] = c.name
    return map
  }, [circles])

  const sortedCircles = useMemo(
    () => [...circles].sort((a, b) => a.name.localeCompare(b.name)),
    [circles],
  )

  const filteredCircleOptions = useMemo(() => {
    const q = circleQuery.trim().toLowerCase()
    if (!q) return sortedCircles
    return sortedCircles.filter((c) => c.name.toLowerCase().includes(q))
  }, [sortedCircles, circleQuery])

  const feedPosts = useMemo(() => filterFeedByAudience(allPosts, 'friends'), [allPosts])
  const circlePosts = useMemo(() => {
    const all = filterFeedByAudience(allPosts, 'circle')
    if (circleFilter === 'all') return all
    return all.filter((p) => p.circleId === circleFilter)
  }, [allPosts, circleFilter])

  const visiblePosts = useMemo(() => {
    const base =
      tab === 'mine' ? myPosts : tab === 'circles' ? circlePosts : tab === 'feed' ? feedPosts : []
    return cloudUser ? filterHiddenPosts(cloudUser.uid, base) : base
  }, [tab, myPosts, circlePosts, feedPosts, cloudUser])

  const activeCircleName =
    circleFilter !== 'all' ? circleNames[circleFilter] || 'Circle' : null

  function patchPost(next: RankedPost) {
    setAllPosts((p) => p.map((x) => (x.id === next.id ? next : x)))
    setMyPosts((p) => p.map((x) => (x.id === next.id ? next : x)))
  }

  function dropPost(postId: string) {
    setAllPosts((p) => p.filter((x) => x.id !== postId))
    setMyPosts((p) => p.filter((x) => x.id !== postId))
  }

  function dropAuthor(authorId: string) {
    setAllPosts((p) => p.filter((x) => x.authorId !== authorId))
    setMyPosts((p) => p.filter((x) => x.authorId !== authorId))
  }

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

  function setTab(next: SocialTab) {
    const params = new URLSearchParams(searchParams)
    if (next === 'feed') params.delete('tab')
    else params.set('tab', next)
    if (next !== 'circles') {
      params.delete('circle')
      setCircleQuery('')
    }
    setSearchParams(params, { replace: true })
  }

  function setCircleFilter(next: string) {
    const params = new URLSearchParams(searchParams)
    params.set('tab', 'circles')
    if (next === 'all') params.delete('circle')
    else params.set('circle', next)
    setSearchParams(params, { replace: true })
  }

  // Drop stale circle filter if you left that circle
  useEffect(() => {
    if (tab !== 'circles' || circleFilter === 'all' || circles.length === 0) return
    if (circles.some((c) => c.id === circleFilter)) return
    const params = new URLSearchParams(searchParams)
    params.set('tab', 'circles')
    params.delete('circle')
    setSearchParams(params, { replace: true })
  }, [tab, circleFilter, circles, searchParams, setSearchParams])

  useEffect(() => {
    if (!cloudUser) {
      setLoading(false)
      setAllPosts([])
      return
    }
    setLoading(true)
    const unsub = subscribeTogetherFeed(
      cloudUser.uid,
      (next) => {
        setAllPosts(next)
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

  useEffect(() => {
    if (!cloudUser || tab !== 'mine') return
    let cancelled = false
    setMineLoading(true)
    void listPostsByAuthor(cloudUser.uid, cloudUser.uid)
      .then(async (list) => {
        if (cancelled) return
        setMyPosts(list)
        const authorIds = list.flatMap((p) => [
          p.authorId,
          ...(p.repost ? [p.repost.authorId] : []),
        ])
        const [extraNames, extraPhotos, eng] = await Promise.all([
          resolveAuthorNames(authorIds),
          resolveAuthorPhotos(authorIds),
          loadEngagementForPosts(
            list.map((p) => p.id),
            cloudUser.uid,
          ),
        ])
        if (cancelled) return
        setNames((n) => ({ ...n, ...extraNames }))
        setPhotos((p) => ({ ...p, ...extraPhotos }))
        setEngagement((e) => ({ ...e, ...eng }))
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Couldn’t load your posts')
      })
      .finally(() => {
        if (!cancelled) setMineLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cloudUser, tab])

  async function loadMore() {
    if (!cloudUser || allPosts.length === 0) return
    const oldest = allPosts.reduce((a, b) => (a.createdAt < b.createdAt ? a : b))
    setLoadingMore(true)
    try {
      const older = await loadOlderTogetherPosts(cloudUser.uid, oldest.createdAt)
      if (older.length === 0) {
        toast.message('That’s the end of your feed')
        return
      }
      setAllPosts((prev) => {
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

  function shareFeeling(mood: (typeof FEELINGS)[number]) {
    offerFeelingShare({
      dateLabel: format(new Date(), 'EEEE · MMM d'),
      moodLabel: mood,
    })
    setFeelingOpen(false)
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

  const listLoading = tab === 'mine' ? mineLoading : loading

  return (
    <motion.div {...pageEnterSubtle} className="relative mx-auto w-full max-w-xl overflow-x-hidden pb-10">
      <SocialHero tab={tab} onTabChange={setTab} pendingFriends={pendingCount} />

      {tab === 'friends' ? (
        <FriendsPanel embedded />
      ) : (
        <>
          <div className="border-b border-border/50 px-4 py-3 sm:px-5">
            <p className="text-sm text-muted-foreground">
              {tab === 'circles'
                ? activeCircleName
                  ? `Wins in ${activeCircleName} — newest first.`
                  : 'Wins shared with your Circles — pick one to focus, or see all.'
                : tab === 'mine'
                  ? 'Your shared wins.'
                  : 'Friends feed · newest first. Wins only — no random posts.'}
            </p>
            {tab === 'circles' && sortedCircles.length > 0 ? (
              <div className="mt-3 space-y-2">
                {sortedCircles.length > 4 ? (
                  <Input
                    value={circleQuery}
                    onChange={(e) => setCircleQuery(e.target.value)}
                    placeholder="Find a circle…"
                    aria-label="Find a circle"
                    className="h-9"
                  />
                ) : null}
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                  <button
                    type="button"
                    onClick={() => setCircleFilter('all')}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                      circleFilter === 'all'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary/80 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    All circles
                  </button>
                  {filteredCircleOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCircleFilter(c.id)}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                        circleFilter === c.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/80 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                {circleQuery.trim() && filteredCircleOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No circles match that name.</p>
                ) : null}
              </div>
            ) : null}
            {tab === 'feed' ? (
              <div className="mt-3">
                {!feelingOpen ? (
                  <button
                    type="button"
                    onClick={() => setFeelingOpen(true)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3.5 text-sm font-medium transition hover:bg-secondary/70"
                  >
                    <Heart className="h-3.5 w-3.5 text-rose-500" />
                    Share how you’re feeling
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Pick a mood — then caption & post.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {FEELINGS.map((mood) => (
                        <Button
                          key={mood}
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="rounded-full"
                          onClick={() => shareFeeling(mood)}
                        >
                          {mood}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => setFeelingOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {listLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="px-4 py-10 sm:px-5">
              <EmptyState
                icon={tab === 'circles' ? Users : Newspaper}
                title={
                  tab === 'circles'
                    ? activeCircleName
                      ? `No wins in ${activeCircleName} yet`
                      : 'No Circle posts yet'
                    : tab === 'mine'
                      ? 'You haven’t shared a win yet'
                      : 'No wins shared yet'
                }
                description={
                  tab === 'circles'
                    ? activeCircleName
                      ? 'Share a win to this Circle, or switch filters above.'
                      : 'When someone posts a win to a Circle, it shows up here.'
                    : 'Finish something in Today — or share how you’re feeling — then post the win card.'
                }
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild>
                      <Link to="/dashboard">Open Today</Link>
                    </Button>
                    {tab === 'feed' ? (
                      <Button variant="outline" onClick={() => setTab('friends')}>
                        Invite a friend
                      </Button>
                    ) : tab === 'circles' ? (
                      <Button asChild variant="outline">
                        <Link to="/circles">Open Circles</Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setTab('feed')
                          setFeelingOpen(true)
                        }}
                      >
                        Share a feeling
                      </Button>
                    )}
                  </div>
                }
              />
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="overflow-hidden border-y border-border/40 sm:rounded-none"
            >
              {visiblePosts.map((post) => (
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
                  onDeleted={() => dropPost(post.id)}
                  onUpdated={patchPost}
                  onHidden={dropPost}
                  onAuthorBlocked={dropAuthor}
                  names={names}
                  photos={photos}
                  onNames={(extra) => setNames((n) => ({ ...n, ...extra }))}
                />
              ))}
              {tab !== 'mine' ? (
                <div className="flex justify-center bg-card/30 py-5">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                  >
                    {loadingMore ? 'Loading…' : 'Load earlier'}
                  </Button>
                </div>
              ) : null}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  )
}

function parseTab(raw: string | null): SocialTab {
  if (raw === 'friends' || raw === 'circles' || raw === 'mine') return raw
  return 'feed'
}

function SocialHero({
  tab,
  onTabChange,
  pendingFriends,
}: {
  tab: SocialTab
  onTabChange: (tab: SocialTab) => void
  pendingFriends: number
}) {
  const tabs: { id: SocialTab; label: string }[] = [
    { id: 'feed', label: 'Feed' },
    { id: 'circles', label: 'Circles' },
    { id: 'mine', label: 'My posts' },
    {
      id: 'friends',
      label: pendingFriends > 0 ? `Friends (${pendingFriends > 9 ? '9+' : pendingFriends})` : 'Friends',
    },
  ]

  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-background/90 backdrop-blur-md">
      <div className="px-4 pt-3 sm:px-5">
        <h1 className="font-display text-xl tracking-tight sm:text-2xl">Social</h1>
        <p className="text-xs text-muted-foreground">
          Cheer real wins — and how you’re feeling — not a general feed.
        </p>
      </div>
      <div className="mt-3 flex gap-0 overflow-x-auto px-2 sm:px-3">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition',
              tab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  )
}
