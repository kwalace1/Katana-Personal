import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Newspaper,
  PenLine,
  Plus,
  Target,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { FeedCardView } from '@/components/FeedCardView'
import { TogetherSetup } from '@/components/TogetherSetup'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle, springSnappy, staggerContainer, staggerItem } from '@/lib/motion-ui'
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

type ComposeKind = 'photo' | 'video' | 'update' | 'card'

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

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials =
    parts.length === 0
      ? '?'
      : parts.length === 1
        ? parts[0]!.slice(0, 2).toUpperCase()
        : `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/90 to-[hsl(200_40%_32%)] font-semibold text-primary-foreground shadow-[inset_0_0_0_2px_hsl(var(--background))]',
        size === 'sm' && 'h-8 w-8 text-[0.65rem]',
        size === 'md' && 'h-10 w-10 text-[0.7rem]',
        size === 'lg' && 'h-12 w-12 text-sm',
      )}
    >
      {initials}
    </div>
  )
}

function PostCard({
  post,
  authorName,
  selfUid,
  circleName,
  onDeleted,
}: {
  post: RankedPost
  authorName: string
  selfUid: string
  circleName?: string
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const hasMedia = Boolean(post.media?.length)

  return (
    <motion.article variants={staggerItem} className="border-b border-border/50 bg-card/40">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <Avatar name={authorName} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold tracking-tight">{authorName}</p>
          <p className="text-xs text-muted-foreground">
            {relativeWhen(post.createdAt)}
            {post.audience === 'circle' ? (
              <>
                <span className="mx-1.5 text-border">·</span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {circleName || 'Circle'}
                </span>
              </>
            ) : (
              <>
                <span className="mx-1.5 text-border">·</span>
                Friends
              </>
            )}
          </p>
        </div>
        {post.authorId === selfUid ? (
          <div className="relative">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-muted-foreground"
              aria-label="Post options"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  transition={springSnappy}
                  className="absolute right-0 top-10 z-10 min-w-[8.5rem] overflow-hidden rounded-xl border border-border/60 bg-card py-1 shadow-lg"
                >
                  <button
                    type="button"
                    disabled={busy}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-secondary/80"
                    onClick={() => {
                      setBusy(true)
                      void deleteTogetherPost(post.id)
                        .then(() => {
                          toast.message('Post removed')
                          onDeleted()
                        })
                        .catch((err) =>
                          toast.error(err instanceof Error ? err.message : 'Couldn’t delete'),
                        )
                        .finally(() => {
                          setBusy(false)
                          setMenuOpen(false)
                        })
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </header>

      {hasMedia ? (
        <div
          className={cn(
            'grid gap-px bg-border/40',
            post.media!.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          {post.media!.map((m) =>
            m.type === 'video' ? (
              <video
                key={m.path}
                src={m.url}
                controls
                playsInline
                className={cn(
                  'w-full bg-black object-contain',
                  post.media!.length === 1 ? 'max-h-[min(72vh,36rem)] aspect-square' : 'aspect-square object-cover',
                )}
              />
            ) : (
              <img
                key={m.path}
                src={m.url}
                alt=""
                className={cn(
                  'w-full bg-secondary object-cover',
                  post.media!.length === 1 ? 'max-h-[min(72vh,36rem)] aspect-square' : 'aspect-square',
                )}
              />
            ),
          )}
        </div>
      ) : null}

      {post.card ? <FeedCardView card={post.card} /> : null}

      {post.text ? (
        <div className="px-4 py-3 sm:px-5">
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">
            <span className="mr-1.5 font-semibold tracking-tight">{authorName}</span>
            {post.text}
          </p>
        </div>
      ) : !hasMedia && !post.card ? (
        <div className="px-4 pb-4 sm:px-5">
          <p className="text-sm text-muted-foreground">Empty post</p>
        </div>
      ) : (
        <div className="h-3" />
      )}
    </motion.article>
  )
}

function ComposeTypeButton({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof ImagePlus
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-border/50 bg-card/80 px-4 py-3.5 text-left transition hover:border-primary/30 hover:bg-primary/[0.04]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold tracking-tight">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeKind, setComposeKind] = useState<ComposeKind>('update')
  const photoRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const composePhotoRef = useRef<HTMLInputElement>(null)
  const composeVideoRef = useRef<HTMLInputElement>(null)

  const feedCardsAllowed = Boolean(cloudProfile?.sharePrefs?.feedCards)
  const selfName = cloudProfile?.displayName || 'You'

  const circleNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of circles) map[c.id] = c.name
    return map
  }, [circles])

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
        badge: 'Goal',
        title: g.title,
        subtitle: g.target ? `${g.progress}/${g.target}` : undefined,
        stats: 'In progress on Katana',
      },
    }))
    const habits = habitsApi.list(localUserId).slice(0, 8).map((h) => ({
      card: {
        kind: 'habit' as const,
        badge: 'Habit',
        title: h.title,
        subtitle: habitsApi.isDoneToday(localUserId, h.id) ? 'Checked in today' : 'In progress',
        stats: `${habitsApi.streak(localUserId, h.id)} day streak`,
      },
    }))
    const lifts = liftApi.listSessions(localUserId).slice(0, 5).map((s) => ({
      card: {
        kind: 'workout' as const,
        badge: 'Lift',
        title: s.title || 'Lift session',
        subtitle: formatShortDate(s.date),
        stats: 'Logged in Health',
      },
    }))
    const workouts = healthApi
      .listWorkouts(localUserId)
      .filter((w) => !w.lift_session_id)
      .slice(0, 5)
      .map((w) => ({
        card: {
          kind: 'workout' as const,
          badge: 'Cardio',
          title: w.activity || 'Workout',
          subtitle: formatShortDate(w.date),
          stats: w.duration_minutes ? `${w.duration_minutes} min` : 'Logged in Health',
        },
      }))
    return [...goals, ...habits, ...lifts, ...workouts]
  }, [localUserId, attachOpen, composeOpen])

  function resetCompose() {
    setDraft('')
    setFiles([])
    setCard(null)
    setAttachOpen(false)
    setComposeKind('update')
  }

  function openCompose(kind: ComposeKind) {
    setComposeKind(kind)
    setPickerOpen(false)
    if (kind === 'card') {
      setAttachOpen(true)
      setComposeOpen(true)
      return
    }
    if (kind === 'photo') {
      setComposeOpen(true)
      requestAnimationFrame(() => photoRef.current?.click())
      return
    }
    if (kind === 'video') {
      setComposeOpen(true)
      requestAnimationFrame(() => videoRef.current?.click())
      return
    }
    setComposeOpen(true)
  }

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
      resetCompose()
      setComposeOpen(false)
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
      <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-xl px-0 sm:px-6">
        <FeedHero />
        <div className="px-4 sm:px-0">
          <TogetherSetup />
        </div>
      </motion.div>
    )
  }

  if (!cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-xl px-0 sm:px-6">
        <FeedHero />
        <div className="px-4 sm:px-0">
          <EmptyState
            title="Connect to open Feed"
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

  const canPost = Boolean(draft.trim() || files.length > 0 || card)

  return (
    <motion.div {...pageEnterSubtle} className="relative mx-auto w-full max-w-xl overflow-x-hidden pb-28">
      <FeedHero />

      {/* Story-style composer strip */}
      <div className="mb-1 flex items-center gap-3 border-b border-border/50 px-4 py-3 sm:px-5">
        <Avatar name={selfName} size="lg" />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex min-h-11 flex-1 items-center rounded-full border border-border/60 bg-secondary/50 px-4 text-left text-sm text-muted-foreground transition hover:border-primary/25 hover:bg-secondary"
        >
          Share something with friends…
        </button>
        <Button
          type="button"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-full shadow-md shadow-primary/20"
          aria-label="New post"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="px-4 py-10 sm:px-5">
          <EmptyState
            icon={Newspaper}
            title="Your feed is waiting"
            description="Post a photo, a quick update, or a win from Goals & Habits. Circles show up first — private life stays on this device."
            action={
              <Button className="gap-1.5" onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4" />
                Create your first post
              </Button>
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
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              authorName={
                post.authorId === cloudUser.uid ? selfName : names[post.authorId] || 'Friend'
              }
              selfUid={cloudUser.uid}
              circleName={post.circleId ? circleNames[post.circleId] : undefined}
              onDeleted={() => setPosts((p) => p.filter((x) => x.id !== post.id))}
            />
          ))}
          <div className="flex justify-center bg-card/30 py-5">
            <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? 'Loading…' : 'Load earlier'}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Floating create button */}
      <motion.button
        type="button"
        aria-label="New post"
        onClick={() => setPickerOpen(true)}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.94 }}
        transition={springSnappy}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_28px_hsl(172_48%_28%/0.35)] md:right-[max(1.5rem,calc((100vw-36rem)/2+1rem))]"
      >
        <Plus className="h-6 w-6" strokeWidth={2.25} />
      </motion.button>

      {/* Hidden file inputs for picker → compose */}
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

      {/* What to post */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[min(88vh,36rem)] gap-0 rounded-t-[1.5rem] border-border/50 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="border-b border-border/40 px-5 pb-4 pt-2 text-left">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <SheetTitle className="font-display text-2xl tracking-tight">New post</SheetTitle>
            <SheetDescription>Choose what you want to share. Only what you pick goes out.</SheetDescription>
          </SheetHeader>
          <div className="space-y-2.5 overflow-y-auto px-5 py-4">
            <ComposeTypeButton
              icon={ImagePlus}
              title="Photo"
              description="Share a moment — up to 4 images"
              onClick={() => openCompose('photo')}
            />
            <ComposeTypeButton
              icon={Video}
              title="Video"
              description="Short clips for friends or a Circle"
              onClick={() => openCompose('video')}
            />
            <ComposeTypeButton
              icon={PenLine}
              title="Update"
              description="A quick note — no media needed"
              onClick={() => openCompose('update')}
            />
            <ComposeTypeButton
              icon={Target}
              title="Share progress"
              description={
                feedCardsAllowed
                  ? 'Attach a goal, habit, or workout card'
                  : 'Turn on Feed cards in Settings first'
              }
              onClick={() => {
                if (!feedCardsAllowed) {
                  toast.message('Turn on Feed cards in Settings to attach goals, habits, or workouts')
                  return
                }
                openCompose('card')
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Compose sheet */}
      <Sheet
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open)
          if (!open) resetCompose()
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[min(92vh,40rem)] gap-0 rounded-t-[1.5rem] border-border/50 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="border-b border-border/40 px-5 pb-4 pt-2 text-left">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <SheetTitle className="font-display text-2xl tracking-tight">
              {composeKind === 'photo'
                ? 'New photo'
                : composeKind === 'video'
                  ? 'New video'
                  : composeKind === 'card'
                    ? 'Share progress'
                    : 'New update'}
            </SheetTitle>
            <SheetDescription>Visible to the audience you choose below.</SheetDescription>
          </SheetHeader>

          <form onSubmit={(e) => void onSubmit(e)} className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-3 overflow-y-auto px-5 py-4">
              <div className="flex gap-3">
                <Avatar name={selfName} />
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    composeKind === 'card'
                      ? 'Add a caption for your win…'
                      : composeKind === 'photo' || composeKind === 'video'
                        ? 'Write a caption…'
                        : 'What’s going on?'
                  }
                  maxLength={FEED_TEXT_MAX}
                  rows={4}
                  autoFocus
                  className="min-h-[100px] flex-1 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>

              {previews.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {previews.map((src, i) => (
                    <div key={src} className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-secondary">
                      {files[i]?.type.startsWith('video/') ? (
                        <video src={src} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      )}
                      <button
                        type="button"
                        className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 shadow"
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
                  <FeedCardView card={card} className="mx-0 mt-0" />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2 h-8 w-8 bg-black/20 text-white hover:bg-black/35 hover:text-white"
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
                  ref={composePhotoRef}
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
                  ref={composeVideoRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => composePhotoRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Photo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => composeVideoRef.current?.click()}
                >
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
              </div>

              {attachOpen && feedCardsAllowed ? (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-border/50 p-2">
                  {attachOptions.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      No goals, habits, or workouts to attach yet.
                    </p>
                  ) : (
                    attachOptions.map((opt, i) => (
                      <button
                        key={`${opt.card.kind}-${opt.card.title}-${i}`}
                        type="button"
                        className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm hover:bg-secondary/80"
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
            </div>

            <div className="border-t border-border/40 px-5 py-3">
              <Button type="submit" className="min-h-11 w-full" disabled={posting || !canPost}>
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Share'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}

function FeedHero() {
  return (
    <header className="relative overflow-hidden px-4 pb-5 pt-6 sm:px-5 sm:pt-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_70%_at_20%_0%,hsl(var(--primary)/0.14),transparent_55%),radial-gradient(ellipse_60%_50%_at_100%_20%,hsl(200_40%_70%/0.18),transparent_50%)]"
      />
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">Together</p>
      <h1 className="mt-1 font-display text-[2.35rem] leading-[1.05] tracking-tight sm:text-5xl">
        Feed
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Moments from friends and Circles — only what people choose to share.
      </p>
    </header>
  )
}
