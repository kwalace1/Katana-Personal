import { FormEvent, useEffect, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { FeedMediaAttach } from '@/components/FeedMediaAttach'
import { Button } from '@/components/ui/button'
import { createTogetherPost, FEED_TEXT_MAX, type FeedAudience } from '@/lib/social/feed'
import { listFriendProfiles } from '@/lib/social/friends'
import type { CircleGroup, CloudProfile } from '@/lib/social/types'
import { MentionTextarea, type MentionCandidate } from './MentionTextarea'

export function FeedComposer({
  selfUid,
  circles,
  onPosted,
}: {
  selfUid: string
  circles: CircleGroup[]
  onPosted?: () => void
}) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [mentions, setMentions] = useState<MentionCandidate[]>([])
  const [audience, setAudience] = useState<FeedAudience>('friends')
  const [circleId, setCircleId] = useState(circles[0]?.id || '')
  const [friends, setFriends] = useState<CloudProfile[]>([])
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!circleId && circles[0]) setCircleId(circles[0].id)
  }, [circleId, circles])

  useEffect(() => {
    let cancelled = false
    void listFriendProfiles(selfUid).then((list) => {
      if (!cancelled) setFriends(list)
    })
    return () => {
      cancelled = true
    }
  }, [selfUid])

  const mentionCandidates: MentionCandidate[] =
    audience === 'circle'
      ? (circles.find((circle) => circle.id === circleId)?.memberIds || [])
          .filter((uid) => uid !== selfUid)
          .map((uid) => {
            const profile = friends.find((friend) => friend.uid === uid)
            return { uid, name: profile?.displayName || 'Member' }
          })
      : friends.map((friend) => ({ uid: friend.uid, name: friend.displayName }))

  async function onPost(e: FormEvent) {
    e.preventDefault()
    if (posting) return
    if (!text.trim() && files.length === 0) {
      toast.error('Write something or add a photo.')
      return
    }
    setPosting(true)
    try {
      await createTogetherPost({
        authorId: selfUid,
        text,
        audience,
        circleId: audience === 'circle' ? circleId : null,
        files,
        mentions,
        card:
          audience === 'friends' && files.length === 0
            ? {
                kind: 'journal',
                badge: 'Update',
                title: text.trim().slice(0, 72) || 'Shared on Social',
                subtitle: 'From the feed',
              }
            : null,
      })
      setText('')
      setFiles([])
      setMentions([])
      toast.success('Posted to Social')
      onPosted?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t post')
    } finally {
      setPosting(false)
    }
  }

  return (
    <form onSubmit={(e) => void onPost(e)} className="space-y-2 border-b border-border/50 px-4 py-3 sm:px-5">
      <MentionTextarea
        value={text}
        onChange={setText}
        candidates={mentionCandidates}
        mentions={mentions}
        onMentionsChange={setMentions}
        maxLength={FEED_TEXT_MAX}
        rows={3}
        placeholder="Share a win, a photo, or how you’re feeling…"
        className="min-h-[4.5rem] resize-none"
      />
      <FeedMediaAttach files={files} onChange={setFiles} disabled={posting} />
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="min-h-10 flex-1 rounded-xl border border-border/70 bg-card px-3 text-sm"
          value={audience === 'friends' ? 'friends' : `circle:${circleId}`}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'friends') {
              setAudience('friends')
              setMentions([])
              return
            }
            setAudience('circle')
            setCircleId(v.replace(/^circle:/, ''))
            setMentions([])
          }}
          aria-label="Audience"
        >
          <option value="friends">Social feed</option>
          {circles.map((circle) => (
            <option key={circle.id} value={`circle:${circle.id}`}>
              Circle · {circle.name}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={posting || (!text.trim() && files.length === 0)}>
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
          Post
        </Button>
      </div>
    </form>
  )
}
