import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Trash2,
  Users,
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
  togglePostLike,
  type FeedComment,
  type PostEngagement,
} from '@/lib/social/feed-engagement'
import { notifyPostEngagement } from '@/lib/social/notifications'
import { deleteTogetherPost, resolveAuthorNames, type RankedPost } from '@/lib/social/feed'
import { cn } from '@/lib/utils'
import { FeedAvatar, profilePath, relativeWhen } from './feed-ui'

type Props = {
  post: RankedPost
  authorName: string
  selfUid: string
  selfName: string
  circleName?: string
  engagement: PostEngagement
  onEngagementChange: (next: PostEngagement) => void
  onDeleted: () => void
  names: Record<string, string>
  onNames: (extra: Record<string, string>) => void
}

function MediaBlock({
  media,
  compact,
}: {
  media: RankedPost['media']
  compact?: boolean
}) {
  if (!media?.length) return null
  return (
    <div
      className={cn(
        'mt-2 overflow-hidden rounded-2xl border border-border/50',
        media.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-2 gap-px bg-border/40',
      )}
    >
      {media.map((m) =>
        m.type === 'video' ? (
          <video
            key={m.path}
            src={m.url}
            controls
            playsInline
            className={cn(
              'w-full bg-black object-contain',
              media.length === 1
                ? compact
                  ? 'max-h-64'
                  : 'max-h-[min(70vh,28rem)]'
                : 'aspect-square object-cover',
            )}
          />
        ) : (
          <img
            key={m.path}
            src={m.url}
            alt=""
            className={cn(
              'w-full bg-secondary object-cover',
              media.length === 1
                ? compact
                  ? 'max-h-64'
                  : 'max-h-[min(70vh,28rem)]'
                : 'aspect-square',
            )}
          />
        ),
      )}
    </div>
  )
}

export function FeedPostCard({
  post,
  authorName,
  selfUid,
  selfName,
  circleName,
  engagement,
  onEngagementChange,
  onDeleted,
  names,
  onNames,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [liking, setLiking] = useState(false)
  const [reposting, setReposting] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentBusy, setCommentBusy] = useState(false)
  const onNamesRef = useRef(onNames)
  onNamesRef.current = onNames

  const isMine = post.authorId === selfUid
  const profileTo = profilePath(post.authorId)

  useEffect(() => {
    if (!commentsOpen) return
    let cancelled = false
    setCommentsLoading(true)
    setComments([])
    void listPostComments(post.id)
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

  async function onLike() {
    if (liking) return
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

  async function onRepost() {
    if (reposting || engagement.repostedByMe || isMine) return
    setReposting(true)
    try {
      await createRepost({ userId: selfUid, original: post, audience: 'friends' })
      onEngagementChange({ ...engagement, repostedByMe: true })
      void notifyPostEngagement({
        authorId: post.authorId,
        actorId: selfUid,
        actorName: selfName,
        kind: 'post_repost',
        postId: post.id,
        preview: post.text,
      })
      toast.success('Reposted to friends')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t repost')
    } finally {
      setReposting(false)
    }
  }

  async function onComment(e: FormEvent) {
    e.preventDefault()
    if (commentBusy) return
    setCommentBusy(true)
    try {
      const c = await addPostComment({ postId: post.id, authorId: selfUid, text: commentDraft })
      setComments((list) => [...list, c])
      setCommentDraft('')
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t comment')
    } finally {
      setCommentBusy(false)
    }
  }

  const originalAuthorName = post.repost
    ? post.repost.authorId === selfUid
      ? selfName
      : names[post.repost.authorId] || 'Friend'
    : null

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
        <FeedAvatar name={authorName} to={profileTo} />
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
            {isMine ? (
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
                      className="absolute right-0 top-9 z-10 min-w-[8.5rem] overflow-hidden rounded-xl border border-border/60 bg-card py-1 shadow-lg"
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
          </div>

          {post.text ? (
            <p className="mt-1 whitespace-pre-wrap text-[0.95rem] leading-relaxed">{post.text}</p>
          ) : null}

          {post.repost ? (
            <div className="mt-2 rounded-2xl border border-border/60 bg-card/60 p-3">
              <div className="flex items-center gap-2">
                <FeedAvatar name={originalAuthorName || 'Friend'} size="sm" to={profilePath(post.repost.authorId)} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{originalAuthorName}</p>
                  <p className="text-xs text-muted-foreground">{relativeWhen(post.repost.createdAt)}</p>
                </div>
              </div>
              {post.repost.text ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{post.repost.text}</p>
              ) : null}
              <MediaBlock media={post.repost.media} compact />
              {post.repost.card ? <div className="mt-2"><FeedCardView card={post.repost.card} /></div> : null}
            </div>
          ) : null}

          {!post.repost ? <MediaBlock media={post.media} /> : null}
          {!post.repost && post.card ? (
            <div className="mt-2">
              <FeedCardView card={post.card} />
            </div>
          ) : null}

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
              onClick={() => void onRepost()}
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

      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[min(88vh,34rem)] gap-0 rounded-t-[1.5rem] border-border/50 pb-[max(1rem,env(safe-area-inset-bottom))]"
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
              comments.map((c) => {
                const name = c.authorId === selfUid ? selfName : names[c.authorId] || 'Friend'
                return (
                  <div key={c.id} className="flex gap-2.5">
                    <FeedAvatar name={name} size="sm" to={profilePath(c.authorId)} />
                    <div className="min-w-0 flex-1 rounded-2xl bg-secondary/50 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <Link to={profilePath(c.authorId)} className="text-sm font-semibold hover:underline">
                          {name}
                        </Link>
                        <span className="text-[0.65rem] text-muted-foreground">{relativeWhen(c.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
                      {c.authorId === selfUid ? (
                        <button
                          type="button"
                          className="mt-1 text-[0.7rem] text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            void deletePostComment(c.id)
                              .then(() => {
                                setComments((list) => list.filter((x) => x.id !== c.id))
                                onEngagementChange({
                                  ...engagement,
                                  commentCount: Math.max(0, engagement.commentCount - 1),
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
                )
              })
            )}
          </div>
          <form onSubmit={(e) => void onComment(e)} className="flex gap-2 border-t border-border/40 px-5 py-3">
            <Textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value.slice(0, COMMENT_TEXT_MAX))}
              placeholder="Write a reply…"
              rows={2}
              className="min-h-[2.75rem] resize-none"
            />
            <Button type="submit" disabled={commentBusy || !commentDraft.trim()} className="self-end">
              {commentBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reply'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </motion.article>
  )
}
