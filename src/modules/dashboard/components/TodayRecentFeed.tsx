import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Newspaper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import {
  resolveAuthorNames,
  resolveAuthorPhotos,
  subscribeTogetherFeed,
  type RankedPost,
} from '@/lib/social/feed'
import { FeedAvatar, profilePath, relativeWhen } from '@/modules/social/components/feed-ui'

const LIMIT = 5

export function TodayRecentFeed() {
  const { cloudEnabled, cloudUser, cloudProfile } = useCloudAuth()
  const [posts, setPosts] = useState<RankedPost[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(Boolean(cloudEnabled && cloudUser))

  useEffect(() => {
    if (!cloudEnabled || !cloudUser) {
      setPosts([])
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = subscribeTogetherFeed(
      cloudUser.uid,
      (next) => {
        const slice = next.slice(0, LIMIT)
        setPosts(slice)
        setLoading(false)
        const authorIds = slice.map((p) => p.authorId)
        void resolveAuthorNames(authorIds).then(setNames)
        void resolveAuthorPhotos(authorIds).then(setPhotos)
      },
      () => {
        setLoading(false)
      },
      LIMIT,
    )
    return () => unsub()
  }, [cloudEnabled, cloudUser])

  const selfName = cloudProfile?.displayName || 'You'

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
        <div>
          <p className="kp-section-label">Social</p>
          <h2 className="font-display text-lg tracking-tight">Recent</h2>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-primary">
          <Link to="/social">Open Social</Link>
        </Button>
      </div>

      {!cloudEnabled || !cloudUser ? (
        <div className="kp-surface flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Connect to see friends’ wins here — still optional.
          </p>
          <Button asChild size="sm">
            <Link to="/settings#cloud">Connect</Link>
          </Button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="kp-surface flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Newspaper className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No wins yet — finish something today and share when Katana offers it.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/social?tab=friends">Invite</Link>
          </Button>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border/50 divide-y divide-border/40">
          {posts.map((post) => {
            const name =
              post.authorId === cloudUser.uid ? selfName : names[post.authorId] || 'Friend'
            const photo = photos[post.authorId]
            const preview =
              post.text?.trim() ||
              post.card?.title ||
              (post.repost ? 'Reposted a win' : post.media?.length ? 'Shared media' : 'Shared a win')
            return (
              <li key={post.id}>
                <Link
                  to="/social"
                  className="flex gap-3 px-3.5 py-3 transition hover:bg-secondary/40 sm:px-4"
                >
                  <FeedAvatar name={name} photoURL={photo} size="sm" to={profilePath(post.authorId)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                        {relativeWhen(post.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{preview}</p>
                    {post.card ? (
                      <p className="mt-1.5 inline-flex rounded-full bg-secondary/80 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        {post.card.badge || post.card.kind} · {post.card.title}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
