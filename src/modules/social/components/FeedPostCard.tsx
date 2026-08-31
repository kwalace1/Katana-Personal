import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Flag,
  Heart,
  ImagePlus,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { FeedCardView } from '@/components/FeedCardView'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { springSnappy, staggerItem } from '@/lib/motion-ui'
import {
  addPostComment,
  COMMENT_TEXT_MAX,
  createRepost,
  deletePostComment,
  listPostComments,
  nestFeedComments,
  toggleCommentLike,
  togglePostLike,
  type FeedComment,
  type PostEngagement,
} from '@/lib/social/feed-engagement'
import { notifyCommentEngagement, notifyPostEngagement } from '@/lib/social/notifications'
import {
  assertFeedMedia,
  deleteTogetherPost,
  FEED_TEXT_MAX,
  reportTogetherPost,
  resolveAuthorNames,
  updateTogetherPost,
  type FeedMedia,
  type RankedPost,
} from '@/lib/social/feed'
import {
  hideReportedPost,
  REPORT_REASONS,
  type ReportReason,
} from '@/lib/social/feed-moderation'
import { blockUser } from '@/lib/social/friends'
import { cn } from '@/lib/utils'
import { FeedMediaBlock, FeedMediaEditPreview } from '@/modules/social/components/FeedMediaBlock'
import { FeedAvatar, profilePath, relativeWhen } from './feed-ui'

type Props = {
  post: RankedPost
  authorName: string
  authorPhotoURL?: string | null
  selfUid: string
  selfName: string
  circleName?: string
  engagement: PostEngagement
  onEngagementChange: (next: PostEngagement) => void
  onDeleted: () => void
  onUpdated?: (next: RankedPost) => void
  onHidden?: (postId: string) => void
  onAuthorBlocked?: (authorId: string) => void
  names: Record<string, string>
  photos?: Record<string, string | null>
  onNames: (extra: Record<string, string>) => void
}

function MentionedPostText({
  text,
  mentions,
}: {
  text: string
  mentions: RankedPost['mentions']
}) {
  if (!mentions.length) return <>{text}</>
  const escaped = mentions
    .map((mention) => mention.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length)
  const regex = new RegExp(`(@(?:${escaped.join('|')}))`, 'gi')
  const byName = new Map(mentions.map((mention) => [mention.name.toLowerCase(), mention]))
  return (
    <>
      {text.split(regex).map((part, index) => {
        if (!part.startsWith('@')) return <span key={index}>{part}</span>
        const mention = byName.get(part.slice(1).toLowerCase())
        return mention ? (
          <Link
            key={`${mention.uid}-${index}`}
            to={profilePath(mention.uid)}
            className="font-semibold text-primary hover:underline"
          >
            {part}
          </Link>
        ) : (
          <span key={index}>{part}</span>
        )
      })}
    </>
  )
}

function DoubleTapLikeZone({
  onLike,
  children,
  className,
}: {
  onLike: () => void
  children: React.ReactNode
  className?: string
}) {
  const lastTap = useRef(0)
  const [burst, setBurst] = useState(false)

  function handleTap() {
    const now = Date.now()
    if (now - lastTap.current < 320) {
      lastTap.current = 0
      onLike()
      setBurst(true)
      window.setTimeout(() => setBurst(false), 700)
      return
    }
    lastTap.current = now
  }

  return (
    <div
      className={cn('relative', className)}
      onDoubleClick={(e) => {
        e.preventDefault()
        onLike()
        setBurst(true)
        window.setTimeout(() => setBurst(false), 700)
      }}
      onTouchEnd={(e) => {
        // Ignore multi-touch; don’t block video controls (target check).
        if (e.target instanceof HTMLVideoElement || (e.target as HTMLElement).closest('video')) {
          return
        }
        handleTap()
      }}
    >
      {children}
      <AnimatePresence>
        {burst ? (
          <motion.div
            key="like-burst"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={springSnappy}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <Heart className="h-16 w-16 fill-rose-500 text-rose-500 drop-shadow-lg" />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function FeedPostCard({
  post,
  authorName,
  authorPhotoURL,
  selfUid,
  selfName,
  circleName,
  engagement,
  onEngagementChange,
  onDeleted,
  onUpdated,
  onHidden,
  onAuthorBlocked,
  names,
  photos,
  onNames,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [liking, setLiking] = useState(false)
  const [reposting, setReposting] = useState(false)
  const [repostOpen, setRepostOpen] = useState(false)
  const [repostCaption, setRepostCaption] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [editText, setEditText] = useState(post.text)
  const [keepMedia, setKeepMedia] = useState<FeedMedia[]>(post.media || [])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [reportReason, setReportReason] = useState<ReportReason | null>(null)
  const [reportNote, setReportNote] = useState('')
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentBusy, setCommentBusy] = useState(false)
  const [likingCommentId, setLikingCommentId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const onNamesRef = useRef(onNames)
  onNamesRef.current = onNames

  const isMine = post.authorId === selfUid
  const profileTo = profilePath(post.authorId)
  const mediaSlotsLeft = Math.max(0, 4 - keepMedia.length - newFiles.length)

  useEffect(() => {
    if (!editOpen) return
    setEditText(post.text)
    setKeepMedia(post.media || [])
    setNewFiles([])
  }, [editOpen, post.text, post.media])

  useEffect(() => {
    if (!reportOpen) return
    setReportReason(null)
    setReportNote('')
  }, [reportOpen])

  async function onDelete() {
    setMenuOpen(false)
    if (!window.confirm('Delete this post? This can’t be undone.')) return
    setBusy(true)
    try {
      await deleteTogetherPost(post.id)
      toast.message('Post removed')
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t delete')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      for (const file of newFiles) await assertFeedMedia(file)
      const updated = await updateTogetherPost({
        postId: post.id,
        authorId: selfUid,
        text: editText,
        keepMedia,
        newFiles,
      })
      onUpdated?.({ ...post, ...updated, score: post.score })
      toast.success('Post updated')
      setEditOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t update')
    } finally {
      setBusy(false)
    }
  }

  async function onSubmitReport(e: FormEvent) {
    e.preventDefault()
    if (busy || !reportReason) return
    setBusy(true)
    try {
      await reportTogetherPost({
        postId: post.id,
        reporterId: selfUid,
        authorId: post.authorId,
        reason: reportReason,
        note: reportNote,
      })
      hideReportedPost(selfUid, post.id)
      setReportOpen(false)
      onHidden?.(post.id)
      toast.message('Thanks — we got your report')
      if (window.confirm('Also block this person? They won’t be able to connect with you.')) {
        try {
          await blockUser(selfUid, post.authorId)
          onAuthorBlocked?.(post.authorId)
          toast.message('Blocked')
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Couldn’t block')
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t report')
    } finally {
      setBusy(false)
    }
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return
    const incoming = [...files]
    const room = Math.max(0, 4 - keepMedia.length - newFiles.length)
    if (room <= 0) {
      toast.error('Up to 4 media files per post.')
      return
    }
    const slice = incoming.slice(0, room)
    try {
      for (const file of slice) await assertFeedMedia(file)
      setNewFiles((prev) => [...prev, ...slice])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t add media')
    }
  }

  useEffect(() => {
    if (!commentsOpen) return
    let cancelled = false
    setCommentsLoading(true)
    setComments([])
    void listPostComments(post.id, selfUid)
      .then(async (list) => {
        if (cancelled) return
        setComments(list)
        if (list.length > 0) {
          const extra = await resolveAuthorNames(list.map((c) => c.authorId))
          if (!cancelled) onNamesRef.current(extra)
        }
      })
      .catch((err) => {
        if (cancelled) return
        toast.error(
          err instanceof Error && /does not exist|schema cache|permission denied/i.test(err.message)
            ? 'Comments need a cloud update — run the latest Supabase migration'
            : err instanceof Error
              ? err.message
              : 'Couldn’t load comments',
        )
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [commentsOpen, post.id])

  async function onLike(opts?: { likeOnly?: boolean }) {
    if (liking) return
    if (opts?.likeOnly && engagement.likedByMe) return
    setLiking(true)
    const prev = engagement
    const optimistic: PostEngagement = {
      ...prev,
      likedByMe: !prev.likedByMe,
      likeCount: Math.max(0, prev.likeCount + (prev.likedByMe ? -1 : 1)),
    }
    onEngagementChange(optimistic)
    try {
      const liked = await togglePostLike(post.id, selfUid, prev.likedByMe)
      onEngagementChange({
        ...prev,
        likedByMe: liked,
        likeCount: Math.max(0, prev.likeCount + (liked === prev.likedByMe ? 0 : liked ? 1 : -1)),
      })
      if (liked && !prev.likedByMe) {
        void notifyPostEngagement({
          authorId: post.authorId,
          actorId: selfUid,
          actorName: selfName,
          kind: 'post_like',
          postId: post.id,
          preview: post.text,
        })
      }
    } catch (err) {
      onEngagementChange(prev)
      toast.error(
        err instanceof Error && /does not exist|schema cache/i.test(err.message)
          ? 'Likes need a cloud update — run the latest Supabase migration'
          : err instanceof Error
            ? err.message
            : 'Couldn’t like',
      )
    } finally {
      setLiking(false)
    }
  }

  async function submitRepost(e: FormEvent) {
    e.preventDefault()
    if (reposting || engagement.repostedByMe || isMine) return
    setReposting(true)
    try {
      const caption = repostCaption.trim()
      await createRepost({
        userId: selfUid,
        original: post,
        audience: 'friends',
        quote: caption,
      })
      onEngagementChange({ ...engagement, repostedByMe: true })
      void notifyPostEngagement({
        authorId: post.authorId,
        actorId: selfUid,
        actorName: selfName,
        kind: 'post_repost',
        postId: post.id,
        preview: caption || post.text,
      })
      setRepostOpen(false)
      setRepostCaption('')
      toast.success(caption ? 'Reposted with your caption' : 'Reposted to friends')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t repost')
    } finally {
      setReposting(false)
    }
  }

  function openRepost() {
    if (reposting || engagement.repostedByMe || isMine) return
    setRepostCaption('')
    setRepostOpen(true)
  }

  async function onComment(e: FormEvent) {
    e.preventDefault()
    if (commentBusy) return
    setCommentBusy(true)
    try {
      const parent = replyTo
        ? comments.find((item) => item.id === (replyTo.parentId || replyTo.id)) || replyTo
        : null
      const c = await addPostComment({
        postId: post.id,
        authorId: selfUid,
        text: commentDraft,
        parentId: parent?.id || null,
      })
      setComments((list) => [...list, c])
      setCommentDraft('')
      setReplyTo(null)
      onEngagementChange({ ...engagement, commentCount: engagement.commentCount + 1 })
      onNamesRef.current({ [selfUid]: selfName })
      void notifyPostEngagement({
        authorId: post.authorId,
        actorId: selfUid,
        actorName: selfName,
        kind: 'post_comment',
        postId: post.id,
        preview: c.text,
      })
      if (parent && parent.authorId !== post.authorId) {
        void notifyCommentEngagement({
          authorId: parent.authorId,
          actorId: selfUid,
          actorName: selfName,
          kind: 'comment_reply',
          postId: post.id,
          preview: c.text,
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t comment')
    } finally {
      setCommentBusy(false)
    }
  }

  async function onCommentLike(comment: FeedComment) {
    if (likingCommentId) return
    setLikingCommentId(comment.id)
    const prev = comment
    const optimistic: FeedComment = {
      ...prev,
      likedByMe: !prev.likedByMe,
      likeCount: Math.max(0, prev.likeCount + (prev.likedByMe ? -1 : 1)),
    }
    setComments((list) => list.map((item) => (item.id === comment.id ? optimistic : item)))
    try {
      const liked = await toggleCommentLike(comment.id, selfUid, prev.likedByMe)
      setComments((list) =>
        list.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                likedByMe: liked,
                likeCount: Math.max(0, prev.likeCount + (liked === prev.likedByMe ? 0 : liked ? 1 : -1)),
              }
            : item,
        ),
      )
      if (liked && !prev.likedByMe) {
        void notifyCommentEngagement({
          authorId: comment.authorId,
          actorId: selfUid,
          actorName: selfName,
          kind: 'comment_like',
          postId: post.id,
          preview: comment.text,
        })
      }
    } catch (err) {
      setComments((list) => list.map((item) => (item.id === comment.id ? prev : item)))
      toast.error(
        err instanceof Error && /does not exist|schema cache/i.test(err.message)
          ? 'Comment likes need a cloud update — run the latest Supabase migration'
          : err instanceof Error
            ? err.message
            : 'Couldn’t like',
      )
    } finally {
      setLikingCommentId(null)
    }
  }

  function displayName(authorId: string) {
    return authorId === selfUid ? selfName : names[authorId] || 'Friend'
  }

  function renderComment(c: FeedComment, nested = false) {
    const name = displayName(c.authorId)
    return (
      <div key={c.id} className={cn('flex gap-2.5', nested && 'ml-8')}>
        <FeedAvatar
          name={name}
          photoURL={photos?.[c.authorId]}
          size="sm"
          to={profilePath(c.authorId)}
        />
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl bg-secondary/50 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <Link to={profilePath(c.authorId)} className="text-sm font-semibold hover:underline">
                {name}
              </Link>
              <span className="text-[0.65rem] text-muted-foreground">{relativeWhen(c.createdAt)}</span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 px-1">
            <button
              type="button"
              disabled={likingCommentId === c.id}
              className={cn(
                'inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground transition hover:text-rose-600',
                c.likedByMe && 'text-rose-600',
              )}
              aria-label={c.likedByMe ? 'Unlike comment' : 'Like comment'}
              onClick={() => void onCommentLike(c)}
            >
              <Heart className={cn('h-3.5 w-3.5', c.likedByMe && 'fill-current')} />
              {c.likeCount > 0 ? c.likeCount : 'Like'}
            </button>
            <button
              type="button"
              className="text-[0.7rem] text-muted-foreground hover:text-foreground"
              onClick={() => setReplyTo(c)}
            >
              Reply
            </button>
            {c.authorId === selfUid ? (
              <button
                type="button"
                className="text-[0.7rem] text-muted-foreground hover:text-destructive"
                onClick={() => {
                  const removeIds = new Set([
                    c.id,
                    ...comments.filter((item) => item.parentId === c.id).map((item) => item.id),
                  ])
                  void deletePostComment(c.id)
                    .then(() => {
                      setComments((list) => list.filter((x) => !removeIds.has(x.id)))
                      if (replyTo && removeIds.has(replyTo.id)) setReplyTo(null)
                      onEngagementChange({
                        ...engagement,
                        commentCount: Math.max(0, engagement.commentCount - removeIds.size),
                      })
                    })
                    .catch(() => toast.error('Couldn’t delete comment'))
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const nestedComments = nestFeedComments(comments)
  const originalAuthorName = post.repost
    ? post.repost.authorId === selfUid
      ? selfName
      : names[post.repost.authorId] || 'Friend'
    : null
  const repostPreviewText = post.repost?.text || post.text
  const repostPreviewMedia = post.repost?.media || post.media
  const repostPreviewCard = post.repost?.card || post.card
  const repostPreviewAuthor = originalAuthorName || authorName

  return (
    <motion.article
      variants={staggerItem}
      className="border-b border-border/50 px-4 py-3 transition hover:bg-secondary/[0.25] sm:px-5"
    >
      {post.repost ? (
        <p className="mb-1 flex items-center gap-1.5 pl-10 text-xs font-medium text-muted-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
          {isMine ? 'You reposted' : `${authorName} reposted`}
        </p>
      ) : null}

      <div className="flex gap-3">
        <FeedAvatar name={authorName} photoURL={authorPhotoURL} to={profileTo} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <Link
                  to={profileTo}
                  className="truncate font-semibold tracking-tight hover:underline"
                >
                  {authorName}
                </Link>
                <span className="text-sm text-muted-foreground">· {relativeWhen(post.createdAt)}</span>
                {post.audience === 'circle' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {circleName || 'Circle'}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="relative">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground"
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
                    className="absolute right-0 top-9 z-10 min-w-[9rem] overflow-hidden rounded-xl border border-border/60 bg-card py-1 shadow-lg"
                  >
                    {isMine ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/80"
                          onClick={() => {
                            setMenuOpen(false)
                            setEditOpen(true)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-secondary/80"
                          onClick={() => void onDelete()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/80"
                        onClick={() => {
                          setMenuOpen(false)
                          setReportOpen(true)
                        }}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        Report
                      </button>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          <DoubleTapLikeZone onLike={() => void onLike({ likeOnly: true })}>
            {post.text ? (
              <p className="mt-1 whitespace-pre-wrap text-[0.95rem] leading-relaxed">
                <MentionedPostText text={post.text} mentions={post.mentions} />
              </p>
            ) : null}

            {post.repost ? (
              <div className="mt-2 rounded-2xl border border-border/60 bg-card/60 p-3">
                <div className="flex items-center gap-2">
                  <FeedAvatar
                    name={originalAuthorName || 'Friend'}
                    photoURL={
                      post.repost.authorId === selfUid
                        ? authorPhotoURL
                        : photos?.[post.repost.authorId]
                    }
                    size="sm"
                    to={profilePath(post.repost.authorId)}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{originalAuthorName}</p>
                    <p className="text-xs text-muted-foreground">{relativeWhen(post.repost.createdAt)}</p>
                  </div>
                </div>
                {post.repost.text ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.repost.text}</p>
                ) : null}
                <FeedMediaBlock media={post.repost.media} compact />
                {post.repost.card ? (
                  <div className="mt-2">
                    <FeedCardView card={post.repost.card} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {!post.repost ? <FeedMediaBlock media={post.media} /> : null}
            {!post.repost && post.card ? (
              <div className="mt-2">
                <FeedCardView card={post.card} />
              </div>
            ) : null}
          </DoubleTapLikeZone>

          <div className="mt-2 flex max-w-md items-center justify-between gap-2 text-muted-foreground">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition hover:bg-sky-500/10 hover:text-sky-600"
              onClick={() => setCommentsOpen(true)}
            >
              <MessageCircle className="h-4 w-4" />
              {engagement.commentCount > 0 ? engagement.commentCount : ''}
            </button>
            <button
              type="button"
              disabled={reposting || isMine}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition hover:bg-emerald-500/10 hover:text-emerald-600 disabled:opacity-40',
                engagement.repostedByMe && 'text-emerald-600',
              )}
              onClick={openRepost}
              aria-label="Repost"
            >
              {reposting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              disabled={liking}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition hover:bg-rose-500/10 hover:text-rose-600',
                engagement.likedByMe && 'text-rose-600',
              )}
              onClick={() => void onLike()}
              aria-label={engagement.likedByMe ? 'Unlike' : 'Like'}
            >
              <Heart className={cn('h-4 w-4', engagement.likedByMe && 'fill-current')} />
              {engagement.likeCount > 0 ? engagement.likeCount : ''}
            </button>
          </div>
        </div>
      </div>

      <Sheet
        open={commentsOpen}
        onOpenChange={(open) => {
          setCommentsOpen(open)
          if (!open) {
            setReplyTo(null)
            setCommentDraft('')
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[min(88vh,34rem)] gap-0 rounded-t-[1.5rem] border-border/50 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="border-b border-border/40 px-5 pb-3 pt-2 text-left">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <SheetTitle className="text-lg">Comments</SheetTitle>
            <SheetDescription className="line-clamp-2">
              On {authorName}
              {post.text ? `’s post` : '’s post'}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
            {commentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : comments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No comments yet — say something.</p>
            ) : (
              nestedComments.roots.map((c) => (
                <div key={c.id} className="space-y-2">
                  {renderComment(c)}
                  {(nestedComments.repliesByParent[c.id] || []).map((reply) =>
                    renderComment(reply, true),
                  )}
                </div>
              ))
            )}
          </div>
          <form onSubmit={(e) => void onComment(e)} className="space-y-2 border-t border-border/40 px-5 py-3">
            {replyTo ? (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Replying to {displayName(replyTo.authorId)}
                </span>
                <button type="button" className="hover:text-foreground" onClick={() => setReplyTo(null)}>
                  Cancel
                </button>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value.slice(0, COMMENT_TEXT_MAX))}
                placeholder={replyTo ? `Reply to ${displayName(replyTo.authorId)}…` : 'Write a comment…'}
                rows={2}
                className="min-h-[2.75rem] resize-none"
              />
              <Button type="submit" disabled={commentBusy || !commentDraft.trim()} className="self-end">
                {commentBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : replyTo ? 'Reply' : 'Comment'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={repostOpen}
        onOpenChange={(open) => {
          setRepostOpen(open)
          if (!open) setRepostCaption('')
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[min(88vh,34rem)] gap-0 rounded-t-[1.5rem] border-border/50 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="border-b border-border/40 px-5 pb-3 pt-2 text-left">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <SheetTitle className="text-lg">Repost</SheetTitle>
            <SheetDescription>Add a caption, then share to friends.</SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void submitRepost(e)} className="space-y-3 overflow-y-auto px-5 py-4">
            <Textarea
              value={repostCaption}
              onChange={(e) => setRepostCaption(e.target.value.slice(0, FEED_TEXT_MAX))}
              rows={3}
              placeholder="Say something about this…"
              className="resize-none"
              autoFocus
            />
            <p className="text-right text-[0.7rem] text-muted-foreground">
              {repostCaption.length}/{FEED_TEXT_MAX}
            </p>
            <div className="rounded-2xl border border-border/60 bg-secondary/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">{repostPreviewAuthor}</p>
              {repostPreviewText ? (
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed">
                  {repostPreviewText}
                </p>
              ) : null}
              <FeedMediaBlock media={repostPreviewMedia} compact />
              {repostPreviewCard ? (
                <div className="mt-2">
                  <FeedCardView card={repostPreviewCard} />
                </div>
              ) : null}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={reposting}
                onClick={() => setRepostOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={reposting}>
                {reposting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Repost'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[min(88vh,36rem)] gap-0 rounded-t-[1.5rem] border-border/50 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="border-b border-border/40 px-5 pb-3 pt-2 text-left">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <SheetTitle className="text-lg">Edit post</SheetTitle>
            <SheetDescription>
              Update the caption
              {post.card ? ' or media' : ''}. Win cards stay as-is.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void onSaveEdit(e)} className="space-y-3 overflow-y-auto px-5 py-4">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value.slice(0, FEED_TEXT_MAX))}
              rows={4}
              placeholder="Say something…"
              className="resize-none"
            />
            <p className="text-right text-[0.7rem] text-muted-foreground">
              {editText.length}/{FEED_TEXT_MAX}
            </p>

            {keepMedia.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {keepMedia.map((m) => (
                  <div
                    key={m.path}
                    className="relative h-20 w-20 overflow-hidden rounded-xl border border-border/50 bg-secondary/40"
                  >
                    <FeedMediaEditPreview item={m} />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 text-muted-foreground hover:text-destructive"
                      aria-label="Remove media"
                      onClick={() => setKeepMedia((list) => list.filter((x) => x.path !== m.path))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {newFiles.length > 0 ? (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {newFiles.map((f, i) => (
                  <li key={`${f.name}-${f.lastModified}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-destructive"
                      onClick={() => setNewFiles((list) => list.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              multiple
              className="hidden"
              onChange={(e) => {
                void onPickFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!post.card || mediaSlotsLeft <= 0 || busy}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
              {post.card ? 'Add media' : 'Media with wins only'}
            </Button>
            {!post.card ? (
              <p className="text-[0.7rem] text-muted-foreground">
                Photos attach when you share an accomplishment — not on free-form posts.
              </p>
            ) : null}

            {post.card ? (
              <div className="opacity-80">
                <FeedCardView card={post.card} />
                <p className="mt-1 text-[0.7rem] text-muted-foreground">Win card can’t be edited here.</p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={reportOpen} onOpenChange={setReportOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[min(88vh,32rem)] gap-0 rounded-t-[1.5rem] border-border/50 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="border-b border-border/40 px-5 pb-3 pt-2 text-left">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <SheetTitle className="text-lg">Report post</SheetTitle>
            <SheetDescription>
              Reports help keep Social safe. We’ll hide this post for you.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void onSubmitReport(e)} className="space-y-4 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReportReason(r.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    reportReason === r.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/80 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Textarea
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value.slice(0, 280))}
              rows={3}
              placeholder="Anything else we should know? (optional)"
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setReportOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !reportReason}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit report'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </motion.article>
  )
}
