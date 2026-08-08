import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ban, Check, Copy, UserPlus, Users, X, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { TogetherSetup } from '@/components/TogetherSetup'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { useSharedSocialInbox } from '@/contexts/SocialInboxContext'
import {
  acceptFriend,
  blockUser,
  findUidByFriendCode,
  getAddMeUrl,
  getCloudProfile,
  removeFriendship,
  requestFriend,
  resolveProfilePhotoUrl,
} from '@/lib/social/friends'
import { acceptCircleInvite, declineCircleInvite } from '@/lib/social/invites'
import type { CloudProfile } from '@/lib/social/types'
import { FeedAvatar, profilePath } from '@/modules/social/components/feed-ui'
import { cn } from '@/lib/utils'

type Props = {
  /** When true, omit page chrome — used inside Social tabs */
  embedded?: boolean
}

export function FriendsPanel({ embedded }: Props) {
  const { cloudEnabled, cloudUser, cloudProfile, cloudLoading } = useCloudAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [profiles, setProfiles] = useState<Record<string, CloudProfile>>({})
  const [photos, setPhotos] = useState<Record<string, string | null>>({})
  const { friendships, circleInvites, revision, refresh } = useSharedSocialInbox()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash === '#invites') {
      document.getElementById('invites')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [cloudUser, revision, circleInvites.length])

  useEffect(() => {
    if (!cloudProfile?.photoURL) return
    let cancelled = false
    void resolveProfilePhotoUrl(cloudProfile.photoURL).then((url) => {
      if (!cancelled && cloudUser) setPhotos((prev) => ({ ...prev, [cloudUser.uid]: url }))
    })
    return () => {
      cancelled = true
    }
  }, [cloudProfile?.photoURL, cloudUser])

  useEffect(() => {
    if (!cloudUser) return
    let cancelled = false
    void (async () => {
      const ids = new Set<string>()
      for (const f of friendships) {
        ids.add(f.a === cloudUser.uid ? f.b : f.a)
      }
      for (const inv of circleInvites) ids.add(inv.createdBy)
      const fetched: Record<string, CloudProfile> = {}
      const photoMap: Record<string, string | null> = {}
      await Promise.all(
        [...ids].map(async (id) => {
          const p = await getCloudProfile(id)
          if (p) {
            fetched[id] = p
            photoMap[id] = await resolveProfilePhotoUrl(p.photoURL)
          }
        }),
      )
      if (!cancelled) {
        setProfiles((prev) => ({ ...prev, ...fetched }))
        setPhotos((prev) => ({ ...prev, ...photoMap }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cloudUser, friendships, circleInvites, revision])

  const incoming = useMemo(
    () =>
      friendships.filter(
        (f) => f.status === 'pending' && cloudUser && f.requestedBy !== cloudUser.uid,
      ),
    [friendships, cloudUser],
  )
  const outgoing = useMemo(
    () =>
      friendships.filter(
        (f) => f.status === 'pending' && cloudUser && f.requestedBy === cloudUser.uid,
      ),
    [friendships, cloudUser],
  )
  const accepted = useMemo(
    () => friendships.filter((f) => f.status === 'accepted'),
    [friendships],
  )

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!cloudUser) return
    setBusy(true)
    try {
      const uid = await findUidByFriendCode(code)
      if (!uid) throw new Error('No one found with that code.')
      if (uid === cloudUser.uid) throw new Error('That’s your own code.')
      await requestFriend(cloudUser.uid, uid)
      setCode('')
      toast.success('Friend request sent')
      refresh()
      // After request, open their profile so Social feels connected
      navigate(profilePath(uid))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t add friend')
    } finally {
      setBusy(false)
    }
  }

  if (!cloudEnabled) {
    return (
      <div className={cn(embedded ? 'px-4 py-6 sm:px-5' : '')}>
        <TogetherSetup highlight="friends" className="mb-4" />
        <EmptyState
          title="Cloud isn’t connected yet"
          description="Connect cloud in Settings so friends can find you with a link or code."
          action={
            <Button asChild>
              <Link to="/settings">Connect cloud</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (cloudLoading || !cloudUser) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">Loading…</p>
    )
  }

  if (!cloudProfile) {
    return (
      <div className="px-4 py-6 sm:px-5">
        <EmptyState title="Almost there" description="Finish cloud setup to invite friends." />
      </div>
    )
  }

  const hasInbox = incoming.length > 0 || circleInvites.length > 0
  const selfPhoto = photos[cloudUser.uid]

  return (
    <div className={cn('space-y-5', embedded ? 'px-4 py-4 sm:px-5' : '')}>
      <p className="text-sm text-muted-foreground">
        Grow with people on the same path — invite, support, and show up for each other.
      </p>

      <section className="rounded-2xl border border-border/50 bg-card/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your code</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            to={profilePath(cloudUser.uid)}
            className="font-display text-3xl tracking-widest hover:text-primary"
          >
            {cloudProfile.friendCode}
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={async () => {
              await navigator.clipboard.writeText(cloudProfile.friendCode)
              toast.success('Code copied')
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={async () => {
              await navigator.clipboard.writeText(getAddMeUrl(cloudProfile.friendCode))
              toast.success('Add-me link copied')
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Link
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <img
            alt="QR code to add you as a friend"
            className="h-24 w-24 rounded-xl border border-border/50 bg-white p-1"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getAddMeUrl(cloudProfile.friendCode))}`}
          />
          <div className="flex min-w-0 items-center gap-3">
            <FeedAvatar
              name={cloudProfile.displayName}
              photoURL={selfPhoto}
              size="lg"
              to={profilePath(cloudUser.uid)}
            />
            <p className="max-w-xs text-sm text-muted-foreground">
              Share your link or QR. When someone adds you, they can open your profile, posts, and bio.
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={(e) => void onAdd(e)} className="flex gap-2 rounded-2xl border border-border/50 bg-card/50 p-3">
        <Input
          placeholder="Friend’s code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="flex-1 tracking-widest"
          maxLength={8}
          aria-label="Friend code"
        />
        <Button type="submit" disabled={busy || code.trim().length < 4} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add
        </Button>
      </form>

      {hasInbox ? (
        <section id="invites" className="scroll-mt-24 space-y-2">
          <h2 className="font-semibold">Invites</h2>
          <ul className="space-y-2">
            {incoming.map((f) => {
              const other = f.a === cloudUser.uid ? f.b : f.a
              const p = profiles[other]
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/50 p-3"
                >
                  <Link to={profilePath(other)} className="flex min-w-0 items-center gap-3">
                    <FeedAvatar name={p?.displayName || 'Someone'} photoURL={photos[other]} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Friend request
                      </p>
                      <p className="truncate font-medium hover:underline">{p?.displayName || 'Someone'}</p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={async () => {
                        await acceptFriend(cloudUser.uid, f.id)
                        toast.success('You’re friends')
                        refresh()
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await removeFriendship(cloudUser.uid, f.id)
                        refresh()
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              )
            })}
            {circleInvites.map((inv) => {
              const from = profiles[inv.createdBy]
              return (
                <li
                  key={inv.token}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Trophy className="h-3 w-3" />
                      Circle invite
                    </p>
                    <p className="font-medium">
                      {from?.displayName || 'A friend'} · “{inv.circleName}”
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          const circle = await acceptCircleInvite(inv.token, cloudUser.uid)
                          toast.success(`Joined “${circle.name}”`)
                          refresh()
                          navigate(`/circles?id=${circle.id}`)
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Couldn’t join')
                        }
                      }}
                    >
                      Join
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await declineCircleInvite(inv.token, cloudUser.uid)
                          toast.message('Declined')
                          refresh()
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Couldn’t decline')
                        }
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Waiting</h2>
          <ul className="space-y-2">
            {outgoing.map((f) => {
              const other = f.a === cloudUser.uid ? f.b : f.a
              const p = profiles[other]
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/50 p-3"
                >
                  <Link to={profilePath(other)} className="flex min-w-0 items-center gap-3">
                    <FeedAvatar name={p?.displayName || 'Pending'} photoURL={photos[other]} />
                    <p className="truncate font-medium hover:underline">{p?.displayName || 'Pending'}</p>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await removeFriendship(cloudUser.uid, f.id)
                      refresh()
                    }}
                  >
                    Cancel
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-primary" />
          Your people
        </h2>
        {accepted.length === 0 ? (
          <EmptyState
            title="No friends yet"
            description="Share your Add-me link or code — once they accept, you can cheer each other on in Social."
          />
        ) : (
          <ul className="space-y-2">
            {accepted.map((f) => {
              const other = f.a === cloudUser.uid ? f.b : f.a
              const p = profiles[other]
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/50 p-3"
                >
                  <Link to={profilePath(other)} className="flex min-w-0 flex-1 items-center gap-3">
                    <FeedAvatar name={p?.displayName || 'Friend'} photoURL={photos[other]} />
                    <div className="min-w-0">
                      <p className="truncate font-medium hover:underline">{p?.displayName || 'Friend'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p?.bio?.trim() || (p?.friendCode ? `@${p.friendCode}` : '')}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await removeFriendship(cloudUser.uid, f.id)
                        toast.message('Removed')
                        refresh()
                      }}
                    >
                      Remove
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        if (
                          !confirm(
                            `Block ${p?.displayName || 'this person'}? They won’t be able to reconnect.`,
                          )
                        )
                          return
                        try {
                          await blockUser(cloudUser.uid, other)
                          toast.message('Blocked')
                          refresh()
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Couldn’t block')
                        }
                      }}
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
