import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Dumbbell,
  Flame,
  ImagePlus,
  Loader2,
  Newspaper,
  Target,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { TogetherSetup } from '@/components/TogetherSetup'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { listMyCircles } from '@/lib/social/circles'
import {
  createTogetherPost,
  deleteTogetherPost,
  FEED_TEXT_MAX,
  loadOlderTogetherPosts,
  resolveAuthorNames,
  subscribeTogetherFeed,
  type FeedAudience,
  type FeedCard,
  type RankedPost,
} from '@/lib/social/feed'
import type { CircleGroup } from '@/lib/social/types'
import { goalsApi } from '@/modules/goals/api'
import { habitsApi } from '@/modules/habits/api'
import { liftApi } from '@/modules/health/lift-api'
import { healthApi } from '@/modules/health/api'
import { cn } from '@/lib/utils'
import { formatShortDate } from '@/lib/dates'

function relativeWhen(iso: string) {
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return ''
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return formatShortDate(iso)
}

function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials =
    parts.length === 0
      ? '?'
      : parts.length === 1
        ? parts[0]!.slice(0, 2).toUpperCase()
        : `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.7rem] font-semibold">
      {initials}
    </div>
  )
}

function FeedCardView({ card }: { card: FeedCard }) {
  const Icon = card.kind === 'goal' ? Target : card.kind === 'habit' ? Flame : Dumbbell
  return (
    <div className="mt-3 flex gap-3 rounded-2xl border border-border/60 bg-secondary/40 px-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {card.kind}
        </p>
        <p className="font-medium leading-snug">{card.title}</p>
        {card.subtitle ? <p className="text-sm text-muted-foreground">{card.subtitle}</p> : null}
        {card.stats ? <p className="mt-0.5 text-xs text-muted-foreground">{card.stats}</p> : null}
      </div>
    </div>
  )
}

function PostCard({
  post,
  authorName,
  selfUid,
  onDeleted,
}: {
  post: RankedPost
  authorName: string
  selfUid: string
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <article className="kp-surface border-border/50 p-4 sm:p-5">
      <div className="flex gap-3">
        <Avatar name={authorName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="font-semibold tracking-tight">{authorName}</p>
            <p className="text-xs text-muted-foreground">{relativeWhen(post.createdAt)}</p>
          </div>
          {post.text ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed sm:text-[0.95rem]">{post.text}</p>
          ) : null}
          {post.media?.length ? (
            <div
              className={cn(
                'mt-3 grid gap-2',
                post.media.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
              )}
            >
              {post.media.map((m) =>
                m.type === 'video' ? (
                  <video
                    key={m.path}
                    src={m.url}
                    controls
                    playsInline
                    className="max-h-80 w-full rounded-2xl bg-black object-contain"
                  />
                ) : (
                  <img
                    key={m.path}
                    src={m.url}
                    alt=""
                    className="max-h-80 w-full rounded-2xl object-cover"
                  />
                ),
              )}
            </div>
          ) : null}
          {post.card ? <FeedCardView card={post.card} /> : null}
          {post.authorId === selfUid ? (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void deleteTogetherPost(post.id)
                    .then(() => {
                      toast.message('Post removed')
                      onDeleted()
                    })
                    .catch((err) => toast.error(err instanceof Error ? err.message : 'Couldn’t delete'))
                    .finally(() => setBusy(false))
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function FeedPage() {
  const { user } = useAuth()
  const { cloudEnabled, cloudUser, cloudProfile } = useCloudAuth()
  const [searchParams] = useSearchParams()
  const localUserId = user!.id

  const [posts, setPosts] = useState<RankedPost[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [circles, setCircles] = useState<CircleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [draft, setDraft] = useState('')
  const [audience, setAudience] = useState<FeedAudience>('friends')
  const [circleId, setCircleId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [card, setCard] = useState<FeedCard | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  const feedCardsAllowed = Boolean(cloudProfile?.sharePrefs?.feedCards)

  useEffect(() => {
    const pre = searchParams.get('circle')
    if (pre) {
      setAudience('circle')
      setCircleId(pre)
    }
  }, [searchParams])

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
        void resolveAuthorNames(next.map((p) => p.authorId)).then(setNames)
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
      if (!cancelled) {
        setCircles(list)
        if (!circleId && list[0]) setCircleId(list[0].id)
      }
    })
    return () => {
      cancelled = true
    }
  }, [cloudUser])

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  const attachOptions = useMemo(() => {
    const goals = goalsApi.active(localUserId, 8).map((g) => ({
      card: {
        kind: 'goal' as const,
        title: g.title,
        subtitle: g.target ? `${g.progress}/${g.target}` : undefined,
        stats: 'Goal from Katana',
      },
    }))
    const habits = habitsApi.list(localUserId).slice(0, 8).map((h) => ({
      card: {
        kind: 'habit' as const,
        title: h.title,
        subtitle: habitsApi.isDoneToday(localUserId, h.id) ? 'Checked in today' : 'In progress',
        stats: `${habitsApi.streak(localUserId, h.id)} day streak`,
      },
    }))
    const lifts = liftApi.listSessions(localUserId).slice(0, 5).map((s) => ({
      card: {
        kind: 'workout' as const,
        title: s.title || 'Lift session',
        subtitle: formatShortDate(s.date),
        stats: 'Lift from Health',
      },
    }))
    const workouts = healthApi
      .listWorkouts(localUserId)
      .filter((w) => !w.lift_session_id)
      .slice(0, 5)
      .map((w) => ({
        card: {
          kind: 'workout' as const,
          title: w.activity || 'Workout',
          subtitle: formatShortDate(w.date),
          stats: w.duration_minutes ? `${w.duration_minutes} min` : 'Workout from Health',
        },
      }))
    return [...goals, ...habits, ...lifts, ...workouts]
  }, [localUserId, attachOpen])

  function addFiles(list: FileList | null) {
    if (!list?.length) return
    const next = [...files, ...Array.from(list)].slice(0, 4)
    setFiles(next)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cloudUser) return
    setPosting(true)
    try {
      await createTogetherPost({
        authorId: cloudUser.uid,
        text: draft,
        audience,
        circleId: audience === 'circle' ? circleId : null,
        files,
        card,
      })
      setDraft('')
      setFiles([])
      setCard(null)
      toast.success('Posted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t post')
    } finally {
      setPosting(false)
    }
  }

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
        return [...map.values()].sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt))
      })
      void resolveAuthorNames(older.map((p) => p.authorId)).then((extra) =>
        setNames((n) => ({ ...n, ...extra })),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t load more')
    } finally {
      setLoadingMore(false)
    }
  }

  if (!cloudEnabled) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Together"
          title="Feed"
          description="Share moments with friends and Circles — only what you choose."
        />
        <TogetherSetup />
      </motion.div>
    )
  }

  if (!cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Together"
          title="Feed"
          description="Connect cloud to post and see friends & Circles."
        />
        <EmptyState
          title="Connect to open Feed"
          description="Friends and Circles stay opt-in. Private life stays on this device."
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
    <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Together"
        title="Feed"
        description="Circles lead, then friends — one continuous timeline. Only what you choose to share."
      />

      <form onSubmit={(e) => void onSubmit(e)} className="kp-surface mb-6 space-y-3 p-4 sm:p-5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What’s going on?"
          maxLength={FEED_TEXT_MAX}
          rows={3}
          className="min-h-[88px] resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
        {previews.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <div key={src} className="relative h-20 w-20 overflow-hidden rounded-xl bg-secondary">
                {files[i]?.type.startsWith('video/') ? (
                  <video src={src} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={src} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"
                  aria-label="Remove"
                  onClick={() => setFiles((f) => f.filter((_, idx) => idx !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {card ? (
          <div className="relative">
            <FeedCardView card={card} />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1 h-8 w-8"
              onClick={() => setCard(null)}
              aria-label="Remove card"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="min-h-10 rounded-xl border border-border/70 bg-card px-3 text-sm"
            value={audience === 'friends' ? 'friends' : `circle:${circleId}`}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'friends') {
                setAudience('friends')
                return
              }
              setAudience('circle')
              setCircleId(v.replace(/^circle:/, ''))
            }}
            aria-label="Audience"
          >
            <option value="friends">Friends</option>
            {circles.map((c) => (
              <option key={c.id} value={`circle:${c.id}`}>
                Circle · {c.name}
              </option>
            ))}
          </select>
          <input
            ref={photoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            multiple
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => photoRef.current?.click()}>
            <ImagePlus className="h-3.5 w-3.5" />
            Photo
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => videoRef.current?.click()}>
            <Video className="h-3.5 w-3.5" />
            Video
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              if (!feedCardsAllowed) {
                toast.message('Turn on Feed cards in Settings to attach goals, habits, or workouts')
                return
              }
              setAttachOpen((v) => !v)
            }}
          >
            <Target className="h-3.5 w-3.5" />
            Attach
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {draft.length}/{FEED_TEXT_MAX}
          </span>
          <Button type="submit" className="min-h-10" disabled={posting || (!draft.trim() && files.length === 0 && !card)}>
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
          </Button>
        </div>

        {attachOpen && feedCardsAllowed ? (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/50 p-2">
            {attachOptions.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No goals, habits, or workouts to attach yet.</p>
            ) : (
              attachOptions.map((opt, i) => (
                <button
                  key={`${opt.card.kind}-${opt.card.title}-${i}`}
                  type="button"
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary/80"
                  onClick={() => {
                    setCard(opt.card)
                    setAttachOpen(false)
                  }}
                >
                  <span className="font-medium">{opt.card.title}</span>
                  <span className="text-xs text-muted-foreground">· {opt.card.kind}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Nothing in your feed yet"
          description="Post to friends or a Circle. Circles show up first — private life stays on this device."
        />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              authorName={
                post.authorId === cloudUser.uid
                  ? cloudProfile?.displayName || 'You'
                  : names[post.authorId] || 'Friend'
              }
              selfUid={cloudUser.uid}
              onDeleted={() => setPosts((p) => p.filter((x) => x.id !== post.id))}
            />
          ))}
          <div className="flex justify-center pt-2">
            <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? 'Loading…' : 'Load earlier'}
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
