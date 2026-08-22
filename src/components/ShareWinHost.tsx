import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FeedCardView } from '@/components/FeedCardView'
import { FeedMediaAttach } from '@/components/FeedMediaAttach'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { listMyCircles } from '@/lib/social/circles'
import { createTogetherPost, FEED_TEXT_MAX, type FeedAudience } from '@/lib/social/feed'
import {
  dismissShareWin,
  getPendingShareWin,
  parkShareWinForConnect,
  resolveLiftShareOffer,
  resumeParkedShareWin,
  setShareWinNever,
  subscribeShareWin,
  type LiftShareChoice,
  type ShareWinOffer,
} from '@/lib/social/share-win'
import { DEFAULT_SHARE_PREFS } from '@/lib/social/types'
import type { CircleGroup, CloudProfile } from '@/lib/social/types'
import { getCloudProfiles, listFriendProfiles } from '@/lib/social/friends'
import {
  MentionTextarea,
  type MentionCandidate,
} from '@/modules/social/components/MentionTextarea'

/**
 * Global host: listens for win offers and opens a celebratory share sheet.
 * Mount once in AppShell.
 */
export function ShareWinHost() {
  const { cloudEnabled, cloudUser, cloudProfile, saveSharePrefs } = useCloudAuth()
  const navigate = useNavigate()
  const [offer, setOffer] = useState<ShareWinOffer | null>(null)
  const [caption, setCaption] = useState('')
  const [audience, setAudience] = useState<FeedAudience>('friends')
  const [circleId, setCircleId] = useState('')
  const [circles, setCircles] = useState<CircleGroup[]>([])
  const [friends, setFriends] = useState<CloudProfile[]>([])
  const [circleProfiles, setCircleProfiles] = useState<CloudProfile[]>([])
  const [mentions, setMentions] = useState<MentionCandidate[]>([])
  const [posting, setPosting] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [liftChoice, setLiftChoice] = useState<LiftShareChoice>('workout')
  const [liftPicks, setLiftPicks] = useState<string[]>([])
  const resumedRef = useRef(false)

  const feedCardsOn = Boolean(cloudProfile?.sharePrefs?.feedCards)

  useEffect(() => subscribeShareWin(setOffer), [])

  // After cloud connect, restore a win that was parked for Settings
  useEffect(() => {
    if (!cloudUser || resumedRef.current) return
    if (getPendingShareWin()) return
    const parked = resumeParkedShareWin()
    if (parked) resumedRef.current = true
  }, [cloudUser])

  useEffect(() => {
    if (!offer) return
    setCaption(offer.defaultCaption)
    setAudience('friends')
    setMentions([])
    setFiles([])
    setLiftChoice(offer.liftShare?.pr ? 'pr' : 'workout')
    setLiftPicks(offer.liftShare?.exercises.map((lift) => lift.name) || [])
  }, [offer])

  useEffect(() => {
    if (!cloudUser || !offer) return
    let cancelled = false
    void Promise.all([listMyCircles(cloudUser.uid), listFriendProfiles(cloudUser.uid)]).then(
      async ([list, friendList]) => {
        if (cancelled) return
        setCircles(list)
        setFriends(friendList)
        if (list[0]) setCircleId(list[0].id)
        const memberIds = [...new Set(list.flatMap((circle) => circle.memberIds))]
        const profiles = await getCloudProfiles(memberIds)
        if (!cancelled) setCircleProfiles(profiles)
      },
    )
    return () => {
      cancelled = true
    }
  }, [cloudUser, offer])

  function close() {
    dismissShareWin()
  }

  async function ensureFeedCards(): Promise<boolean> {
    if (!cloudProfile) return false
    if (cloudProfile.sharePrefs?.feedCards) return true
    try {
      await saveSharePrefs({
        ...DEFAULT_SHARE_PREFS,
        ...cloudProfile.sharePrefs,
        feedCards: true,
      })
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t enable Feed cards')
      return false
    }
  }

  async function onPost(e: FormEvent) {
    e.preventDefault()
    if (!cloudUser || !offer) return
    setPosting(true)
    try {
      const ok = await ensureFeedCards()
      if (!ok) return
      const resolved = offer.liftShare
        ? resolveLiftShareOffer(offer.liftShare, liftChoice, liftPicks)
        : offer
      await createTogetherPost({
        authorId: cloudUser.uid,
        text: caption,
        audience,
        circleId: audience === 'circle' ? circleId : null,
        card: resolved.card,
        mentions,
        files,
      })
      toast.success('Posted to Social')
      close()
      navigate('/social')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t post')
    } finally {
      setPosting(false)
    }
  }

  const open = Boolean(offer)
  const needsCloud = !cloudEnabled || !cloudUser
  const resolvedOffer =
    offer?.liftShare ? resolveLiftShareOffer(offer.liftShare, liftChoice, liftPicks) : offer
  const mentionCandidates: MentionCandidate[] =
    audience === 'circle'
      ? (circles.find((circle) => circle.id === circleId)?.memberIds || [])
          .filter((uid) => uid !== cloudUser?.uid)
          .map((uid) => {
            const profile = circleProfiles.find((candidate) => candidate.uid === uid)
            return { uid, name: profile?.displayName || 'Member' }
          })
      : friends.map((friend) => ({ uid: friend.uid, name: friend.displayName }))

  function applyLiftChoice(next: LiftShareChoice) {
    if (!offer?.liftShare) return
    setLiftChoice(next)
    const resolved = resolveLiftShareOffer(offer.liftShare, next, liftPicks)
    setCaption(resolved.defaultCaption)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[min(92vh,46rem)] gap-0 rounded-t-[1.5rem] border-border/50 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {offer ? (
          <>
            <SheetHeader className="border-b border-border/40 px-5 pb-4 pt-2 text-left">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
              <SheetTitle className="font-display text-2xl tracking-tight">
                {resolvedOffer?.headline || offer.headline}
              </SheetTitle>
              <SheetDescription>
                Optional — post to your Social feed or a Circle.
              </SheetDescription>
            </SheetHeader>

            <form onSubmit={(e) => void onPost(e)} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-4 overflow-y-auto px-5 py-4">
                <FeedCardView card={resolvedOffer?.card || offer.card} variant="hero" />

                {offer.liftShare ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">What to post</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={liftChoice === 'workout' ? 'default' : 'outline'}
                        className="rounded-full"
                        onClick={() => applyLiftChoice('workout')}
                      >
                        Full workout
                      </Button>
                      {offer.liftShare.pr ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={liftChoice === 'pr' ? 'default' : 'outline'}
                          className="rounded-full"
                          onClick={() => applyLiftChoice('pr')}
                        >
                          PR only
                        </Button>
                      ) : null}
                      {offer.liftShare.exercises.length > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={liftChoice === 'exercises' ? 'default' : 'outline'}
                          className="rounded-full"
                          onClick={() => applyLiftChoice('exercises')}
                        >
                          Pick exercises
                        </Button>
                      ) : null}
                    </div>
                    {liftChoice === 'exercises' ? (
                      <ul className="space-y-1.5 rounded-xl border border-border/60 bg-secondary/30 p-3">
                        {offer.liftShare.exercises.map((lift) => {
                          const on = liftPicks.includes(lift.name)
                          return (
                            <li key={lift.name}>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={on}
                                  onChange={() => {
                                    const next = on
                                      ? liftPicks.filter((name) => name !== lift.name)
                                      : [...liftPicks, lift.name]
                                    setLiftPicks(next)
                                    if (offer.liftShare) {
                                      setCaption(
                                        resolveLiftShareOffer(offer.liftShare, 'exercises', next)
                                          .defaultCaption,
                                      )
                                    }
                                  }}
                                />
                                <span>{lift.name}</span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {needsCloud ? (
                  <div className="rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm">
                    <p className="font-medium">Connect to share this win</p>
                    <p className="mt-1 text-muted-foreground">
                      We’ll bring this celebration back after you connect — nothing is lost.
                    </p>
                    <Button
                      type="button"
                      className="mt-3"
                      size="sm"
                      onClick={() => {
                        parkShareWinForConnect()
                        navigate('/settings#cloud')
                      }}
                    >
                      Connect cloud
                    </Button>
                  </div>
                ) : (
                  <>
                    {!feedCardsOn ? (
                      <p className="text-xs text-muted-foreground">
                        First share turns on Feed cards automatically — you can change that in
                        Settings anytime.
                      </p>
                    ) : null}

                    <MentionTextarea
                      value={caption}
                      onChange={setCaption}
                      candidates={mentionCandidates}
                      mentions={mentions}
                      onMentionsChange={setMentions}
                      maxLength={FEED_TEXT_MAX}
                      rows={3}
                      placeholder="Add a caption… type @ to mention someone"
                      className="min-h-[88px] resize-none"
                    />

                    <FeedMediaAttach files={files} onChange={setFiles} disabled={posting} />

                    <select
                      className="min-h-11 w-full rounded-xl border border-border/70 bg-card px-3 text-sm"
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
                      {circles.map((c) => (
                        <option key={c.id} value={`circle:${c.id}`}>
                          Circle · {c.name}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <div className="space-y-2 border-t border-border/40 px-5 py-3">
                {cloudUser ? (
                  <Button type="submit" className="min-h-11 w-full" disabled={posting}>
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post to Social'}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" className="min-h-11 w-full" onClick={close}>
                  Not now
                </Button>
                {offer.card.kind !== 'day' ? (
                  <button
                    type="button"
                    className="w-full py-1 text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      setShareWinNever(true)
                      toast.message('Won’t ask to share wins')
                      close()
                    }}
                  >
                    Don’t ask me to share wins
                  </button>
                ) : null}
              </div>
            </form>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
