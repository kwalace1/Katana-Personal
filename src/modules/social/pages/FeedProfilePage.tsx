import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Loader2, Newspaper } from 'lucide-react'
import { toast } from 'sonner'
import { TogetherSetup } from '@/components/TogetherSetup'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle, staggerContainer } from '@/lib/motion-ui'
import {
  listPostsByAuthor,
  resolveAuthorNames,
  type RankedPost,
} from '@/lib/social/feed'
import {
  loadEngagementForPosts,
  type PostEngagement,
} from '@/lib/social/feed-engagement'
import { getCloudProfile } from '@/lib/social/friends'
import { FeedPostCard } from '@/modules/social/components/FeedPostCard'
import { FeedAvatar } from '@/modules/social/components/feed-ui'

export default function FeedProfilePage() {
  const { uid: rawUid } = useParams()
  const uid = rawUid ? decodeURIComponent(rawUid) : ''
  const { cloudEnabled, cloudUser, cloudProfile } = useCloudAuth()

  const [posts, setPosts] = useState<RankedPost[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [engagement, setEngagement] = useState<Record<string, PostEngagement>>({})
  const [displayName, setDisplayName] = useState('Friend')
  const [friendCode, setFriendCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isSelf = Boolean(cloudUser && uid === cloudUser.uid)
  const selfName = cloudProfile?.displayName || 'You'

  useEffect(() => {
    if (!cloudUser || !uid) {
      setLoading(false)
      setPosts([])
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        if (isSelf) {
          setDisplayName(selfName)
          setFriendCode(cloudProfile?.friendCode || null)
        } else {
          const profile = await getCloudProfile(uid)
          if (!cancelled) {
            setDisplayName(profile?.displayName || 'Friend')
            setFriendCode(profile?.friendCode || null)
          }
        }
        const list = await listPostsByAuthor(cloudUser.uid, uid)
        if (cancelled) return
        setPosts(list)
        const authorIds = list.flatMap((p) => [
          p.authorId,
          ...(p.repost ? [p.repost.authorId] : []),
        ])
        const [nameMap, eng] = await Promise.all([
          resolveAuthorNames(authorIds),
          loadEngagementForPosts(
            list.map((p) => p.id),
            cloudUser.uid,
          ),
        ])
        if (cancelled) return
        setNames(nameMap)
        setEngagement(eng)
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Couldn’t load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cloudUser, uid, isSelf, selfName, cloudProfile?.friendCode])

  const subtitle = useMemo(() => {
    if (isSelf) return 'Your posts'
    return 'Posts you can both see'
  }, [isSelf])

  if (!cloudEnabled) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-xl px-4 sm:px-6">
        <TogetherSetup />
      </motion.div>
    )
  }

  if (!cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-xl px-4 sm:px-6">
        <EmptyState
          title="Connect to view profiles"
          description="Profiles live on Together cloud."
          action={
            <Button asChild>
              <Link to="/settings#cloud">Connect</Link>
            </Button>
          }
        />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageEnterSubtle} className="mx-auto w-full max-w-xl pb-24">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur-md sm:px-5">
        <div className="flex items-center gap-3">
          <Button asChild type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Back to feed">
            <Link to="/feed">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl tracking-tight">{displayName}</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </header>

      <div className="border-b border-border/50 px-4 py-5 sm:px-5">
        <div className="flex items-end gap-4">
          <FeedAvatar name={displayName} size="lg" className="h-16 w-16 text-base" />
          <div className="min-w-0 flex-1 pb-1">
            <p className="truncate text-lg font-semibold tracking-tight">{displayName}</p>
            {friendCode ? (
              <p className="font-mono text-xs text-muted-foreground">@{friendCode}</p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">
              {posts.length} post{posts.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="px-4 py-10 sm:px-5">
          <EmptyState
            icon={Newspaper}
            title={isSelf ? 'No posts yet' : 'Nothing to show'}
            description={
              isSelf
                ? 'Share an update on the Feed and it’ll show up here.'
                : 'You only see posts shared with you.'
            }
            action={
              isSelf ? (
                <Button asChild>
                  <Link to="/feed">Go to Feed</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show">
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              authorName={isSelf ? selfName : displayName}
              selfUid={cloudUser.uid}
              selfName={selfName}
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
              onNames={(extra) => setNames((n) => ({ ...n, ...extra }))}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
