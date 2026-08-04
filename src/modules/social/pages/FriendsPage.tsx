import { FormEvent, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, UserPlus, Users, X, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { TogetherSetup } from '@/components/TogetherSetup'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import {
  acceptFriend,
  blockUser,
  findUidByFriendCode,
  getCloudProfile,
  listFriendships,
  removeFriendship,
  requestFriend,
} from '@/lib/social/friends'
import type { CloudProfile, Friendship } from '@/lib/social/types'
import { Link } from 'react-router-dom'

export default function FriendsPage() {
  const { cloudEnabled, cloudUser, cloudProfile, cloudLoading, refreshCloudProfile } = useCloudAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [profiles, setProfiles] = useState<Record<string, CloudProfile>>({})
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((n) => n + 1)

  useEffect(() => {
    if (!cloudUser) return
    let cancelled = false
    ;(async () => {
      try {
        const list = await listFriendships(cloudUser.uid)
        if (cancelled) return
        setFriendships(list)
        const ids = new Set<string>()
        for (const f of list) {
          ids.add(f.a === cloudUser.uid ? f.b : f.a)
        }
        const map: Record<string, CloudProfile> = {}
        await Promise.all(
          [...ids].map(async (id) => {
            const p = await getCloudProfile(id)
            if (p) map[id] = p
          }),
        )
        if (!cancelled) setProfiles(map)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Couldn’t load friends')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cloudUser, tick])

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
      await requestFriend(cloudUser.uid, uid)
      setCode('')
      toast.success('Friend request sent')
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t add friend')
    } finally {
      setBusy(false)
    }
  }

  if (!cloudEnabled) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page">
        <PageHeader title="Friends" description="People you trust." eyebrow="Together" />
        <TogetherSetup highlight="friends" className="mb-4" />
        <EmptyState
          title="Cloud isn’t connected yet"
          description="Add free Firebase keys (see FIREBASE_SETUP.md) so friends can find you."
        />
      </motion.div>
    )
  }

  if (cloudLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page">
        <PageHeader title="Friends" description="People you trust." eyebrow="Together" />
        <TogetherSetup highlight="friends" cloudConnected={false} />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/" className="font-medium text-primary underline">
            Sign in on the home screen
          </Link>{' '}
          or in{' '}
          <Link to="/settings" className="font-medium text-primary underline">
            Settings
          </Link>
          .
        </p>
      </motion.div>
    )
  }

  if (!cloudProfile) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page">
        <PageHeader title="Friends" description="People you trust." eyebrow="Together" />
        <EmptyState
          title="Finishing Cloud setup…"
          description="You’re signed in, but your friend profile hasn’t loaded yet. Pull to refresh or open Settings."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => void refreshCloudProfile().then(() => refresh())}>
                Retry
              </Button>
              <Button asChild variant="outline">
                <Link to="/settings">Settings</Link>
              </Button>
            </div>
          }
        />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page">
      <PageHeader title="Friends" description="Invite people you trust." eyebrow="Together" />

      <TogetherSetup highlight="friends" compact cloudConnected className="mb-6" />

      <section className="kp-surface mb-6 p-5">
        <p className="kp-section-label">Your code</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="font-display text-3xl tracking-widest">{cloudProfile.friendCode}</p>
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
            Copy code
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={async () => {
              const url = `${window.location.origin}/invite/friend/${cloudProfile.friendCode}`
              await navigator.clipboard.writeText(url)
              toast.success('Add-me link copied')
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy link
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <img
            alt="QR code to add you as a friend"
            className="h-28 w-28 rounded-xl border border-border/50 bg-white p-1"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${window.location.origin}/invite/friend/${cloudProfile.friendCode}`)}`}
          />
          <p className="max-w-xs text-sm text-muted-foreground">
            Share your link or QR — friends open it, sign in to the cloud, and send you a request in one tap.
          </p>
        </div>
      </section>

      <form onSubmit={onAdd} className="kp-surface mb-6 flex gap-2 p-4">
        <Input
          placeholder="Friend’s code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="flex-1 tracking-widest"
          maxLength={8}
        />
        <Button type="submit" disabled={busy} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add
        </Button>
      </form>

      {incoming.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Requests</h2>
          <ul className="space-y-2">
            {incoming.map((f) => {
              const other = f.requestedBy
              const p = profiles[other]
              return (
                <li key={f.id} className="kp-surface flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{p?.displayName || 'Someone'}</p>
                    <p className="text-xs text-muted-foreground">{p?.friendCode}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        await acceptFriend(cloudUser.uid, f.id)
                        toast.success('You’re friends')
                        refresh()
                      }}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
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
          </ul>
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Waiting</h2>
          <ul className="space-y-2">
            {outgoing.map((f) => {
              const other = f.a === cloudUser.uid ? f.b : f.a
              const p = profiles[other]
              return (
                <li key={f.id} className="kp-surface flex items-center justify-between p-4">
                  <p className="font-medium">{p?.displayName || 'Pending'}</p>
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

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          <Users className="h-4 w-4 text-primary" />
          Your people
        </h2>
        {accepted.length === 0 ? (
          <EmptyState title="No friends yet" description="Share your code or add theirs above." />
        ) : (
          <ul className="space-y-2">
            {accepted.map((f) => {
              const other = f.a === cloudUser.uid ? f.b : f.a
              const p = profiles[other]
              return (
                <li key={f.id} className="kp-surface flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{p?.displayName || 'Friend'}</p>
                    <p className="text-xs text-muted-foreground">{p?.friendCode}</p>
                  </div>
                  <div className="flex gap-1">
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
                        if (!confirm(`Block ${p?.displayName || 'this person'}? They won’t be able to reconnect.`)) return
                        try {
                          await blockUser(cloudUser.uid, other)
                          toast.message('Blocked')
                          refresh()
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Couldn’t block')
                        }
                      }}
                    >
                      <Ban className="mr-1 h-3.5 w-3.5" />
                      Block
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </motion.div>
  )
}
