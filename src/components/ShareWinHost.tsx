import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FeedCardView } from '@/components/FeedCardView'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { listMyCircles } from '@/lib/social/circles'
import { createTogetherPost, FEED_TEXT_MAX, type FeedAudience } from '@/lib/social/feed'
import {
  dismissShareWin,
  getPendingShareWin,
  parkShareWinForConnect,
  resumeParkedShareWin,
  setShareWinNever,
  subscribeShareWin,
  type ShareWinOffer,
} from '@/lib/social/share-win'
import { DEFAULT_SHARE_PREFS } from '@/lib/social/types'
import type { CircleGroup } from '@/lib/social/types'

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
  const [posting, setPosting] = useState(false)
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
  }, [offer])

  useEffect(() => {
    if (!cloudUser || !offer) return
    let cancelled = false
    void listMyCircles(cloudUser.uid).then((list) => {
      if (cancelled) return
      setCircles(list)
      if (list[0]) setCircleId(list[0].id)
    })
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
      await createTogetherPost({
        authorId: cloudUser.uid,
        text: caption,
        audience,
        circleId: audience === 'circle' ? circleId : null,
        card: offer.card,
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

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[min(92vh,40rem)] gap-0 rounded-t-[1.5rem] border-border/50 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {offer ? (
          <>
            <SheetHeader className="border-b border-border/40 px-5 pb-4 pt-2 text-left">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
              <SheetTitle className="font-display text-2xl tracking-tight">{offer.headline}</SheetTitle>
              <SheetDescription>
                Optional — only what you choose goes to friends or a Circle.
              </SheetDescription>
            </SheetHeader>

            <form onSubmit={(e) => void onPost(e)} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-4 overflow-y-auto px-5 py-4">
                <FeedCardView card={offer.card} variant="hero" />

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

                    <Textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      maxLength={FEED_TEXT_MAX}
                      rows={3}
                      placeholder="Add a caption…"
                      className="min-h-[88px] resize-none"
                    />

                    <select
                      className="min-h-11 w-full rounded-xl border border-border/70 bg-card px-3 text-sm"
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
