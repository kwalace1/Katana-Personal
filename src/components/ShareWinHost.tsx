import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { listMyCircles } from '@/lib/social/circles'
import { createTogetherPost, FEED_TEXT_MAX, type FeedAudience } from '@/lib/social/feed'
import {
  dismissShareWin,
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
  const [offer, setOffer] = useState<ShareWinOffer | null>(null)
  const [caption, setCaption] = useState('')
  const [audience, setAudience] = useState<FeedAudience>('friends')
  const [circleId, setCircleId] = useState('')
  const [circles, setCircles] = useState<CircleGroup[]>([])
  const [posting, setPosting] = useState(false)
  const [unlocking, setUnlocking] = useState(false)

  const feedCardsOn = Boolean(cloudProfile?.sharePrefs?.feedCards)

  useEffect(() => subscribeShareWin(setOffer), [])

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

  async function enableFeedCards() {
    if (!cloudProfile) return
    setUnlocking(true)
    try {
      await saveSharePrefs({
        ...DEFAULT_SHARE_PREFS,
        ...cloudProfile.sharePrefs,
        feedCards: true,
      })
      toast.success('Feed cards on — wins can go to your Feed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t update settings')
    } finally {
      setUnlocking(false)
    }
  }

  async function onPost(e: FormEvent) {
    e.preventDefault()
    if (!cloudUser || !offer) return
    if (!feedCardsOn) {
      toast.message('Turn on Feed cards below to post this win')
      return
    }
    setPosting(true)
    try {
      await createTogetherPost({
        authorId: cloudUser.uid,
        text: caption,
        audience,
        circleId: audience === 'circle' ? circleId : null,
        card: offer.card,
      })
      toast.success('Posted to Feed')
      close()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t post')
    } finally {
      setPosting(false)
    }
  }

  const open = Boolean(offer)

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

                {!cloudEnabled || !cloudUser ? (
                  <div className="rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm">
                    <p className="font-medium">Connect cloud to post</p>
                    <p className="mt-1 text-muted-foreground">
                      Wins stay private until you connect and choose to share.
                    </p>
                    <Button asChild className="mt-3" size="sm">
                      <Link to="/settings#cloud" onClick={close}>
                        Open Settings
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    {!feedCardsOn ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Allow Feed cards</p>
                          <p className="text-xs text-muted-foreground">
                            Needed once so wins can appear on your Feed.
                          </p>
                        </div>
                        <Switch
                          checked={false}
                          disabled={unlocking}
                          onCheckedChange={(on) => {
                            if (on) void enableFeedCards()
                          }}
                          aria-label="Allow Feed cards"
                        />
                      </div>
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
                  <Button
                    type="submit"
                    className="min-h-11 w-full"
                    disabled={posting || !feedCardsOn}
                  >
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post to Feed'}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" className="min-h-11 w-full" onClick={close}>
                  Not now
                </Button>
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
              </div>
            </form>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
