import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { listFriendProfiles } from '@/lib/social/friends'
import { listMyCircles } from '@/lib/social/circles'
import { createSharedItem } from '@/lib/social/shared'
import { publishActivity } from '@/lib/social/streaks'
import type { CircleGroup, CloudProfile, SharedKind, SharePrefs } from '@/lib/social/types'
import { DEFAULT_SHARE_PREFS } from '@/lib/social/types'
import { cn } from '@/lib/utils'

function prefForKind(kind: SharedKind): keyof SharePrefs | null {
  if (kind === 'habit') return 'habits'
  if (kind === 'goal') return 'goals'
  if (kind === 'journal') return 'journalMood'
  if (kind === 'note') return 'notes'
  if (kind === 'file') return 'files'
  return null
}

function prefLabel(key: keyof SharePrefs): string {
  const map: Partial<Record<keyof SharePrefs, string>> = {
    habits: 'habit sharing',
    goals: 'goal sharing',
    journalMood: 'journal mood sharing',
    notes: 'note sharing',
    files: 'file sharing',
  }
  return map[key] || 'sharing'
}

export function ShareWithFriendsButton({
  kind,
  title,
  body,
  data,
  label = 'Share',
  className,
  fullWidth = false,
}: {
  kind: SharedKind
  title: string
  body?: string
  data?: Record<string, unknown>
  label?: string
  className?: string
  fullWidth?: boolean
}) {
  const navigate = useNavigate()
  const { cloudUser, cloudProfile, saveSharePrefs, syncStreaksToCloud } = useCloudAuth()
  const [open, setOpen] = useState(false)
  const [friends, setFriends] = useState<CloudProfile[]>([])
  const [circles, setCircles] = useState<CircleGroup[]>([])
  const [selectedFriends, setSelectedFriends] = useState<Record<string, boolean>>({})
  const [selectedCircles, setSelectedCircles] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [unlocking, setUnlocking] = useState(false)

  const prefKey = prefForKind(kind)
  const prefOk = !prefKey || Boolean(cloudProfile?.sharePrefs?.[prefKey])

  const shareableCircles = useMemo(
    () => circles.filter((c) => c.memberIds.some((id) => id !== cloudUser?.uid)),
    [circles, cloudUser?.uid],
  )

  useEffect(() => {
    if (!open || !cloudUser) return
    void listFriendProfiles(cloudUser.uid).then(setFriends).catch(() => setFriends([]))
    void listMyCircles(cloudUser.uid).then(setCircles).catch(() => setCircles([]))
  }, [open, cloudUser])

  if (!cloudUser) {
    return (
      <Button asChild size="sm" variant="outline" className={cn(fullWidth && 'w-full', className)}>
        <Link to="/settings">Connect to share with circles</Link>
      </Button>
    )
  }

  async function enablePref() {
    if (!prefKey || !cloudProfile) return
    setUnlocking(true)
    try {
      const next = {
        ...DEFAULT_SHARE_PREFS,
        ...cloudProfile.sharePrefs,
        [prefKey]: true,
      }
      await saveSharePrefs(next)
      await syncStreaksToCloud().catch(() => undefined)
      toast.success(`${prefLabel(prefKey)} is on`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t enable sharing')
    } finally {
      setUnlocking(false)
    }
  }

  async function onShare(e: FormEvent) {
    e.preventDefault()
    if (!cloudUser || !cloudProfile) return
    if (prefKey && !cloudProfile.sharePrefs?.[prefKey]) {
      toast.message('Turn on sharing below first')
      return
    }

    const pickedCircles = shareableCircles.filter((c) => selectedCircles[c.id])
    const friendIds = Object.entries(selectedFriends)
      .filter(([, v]) => v)
      .map(([id]) => id)

    const memberIds = new Set<string>()
    for (const id of friendIds) memberIds.add(id)
    for (const circle of pickedCircles) {
      for (const id of circle.memberIds) {
        if (id !== cloudUser.uid) memberIds.add(id)
      }
    }

    if (memberIds.size === 0) {
      toast.message('Pick a circle or at least one friend')
      return
    }

    setBusy(true)
    try {
      const circleNames = pickedCircles.map((c) => c.name)
      await createSharedItem({
        kind,
        title,
        body,
        data: {
          ...(data || {}),
          ...(pickedCircles.length
            ? {
                sharedCircleIds: pickedCircles.map((c) => c.id),
                sharedCircleNames: circleNames,
              }
            : {}),
        },
        ownerId: cloudUser.uid,
        memberIds: [...memberIds],
      })
      if (cloudProfile.sharePrefs.activityFeed) {
        const audience =
          circleNames.length > 0
            ? `with ${circleNames.join(', ')}`
            : 'with friends'
        const ping =
          kind === 'journal'
            ? `Shared mood ${audience}: ${body || title}`
            : `Shared a ${kind} ${audience}: ${title}`
        await publishActivity(cloudUser.uid, ping)
      }
      const toastLabel =
        circleNames.length > 0 && friendIds.length === 0
          ? `Shared with ${circleNames.join(', ')}`
          : circleNames.length > 0
            ? 'Shared with circles & friends'
            : 'Shared with friends'
      toast.success(toastLabel, {
        action: {
          label: 'View Shared',
          onClick: () => navigate('/shared'),
        },
      })
      setOpen(false)
      setSelectedFriends({})
      setSelectedCircles({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t share')
    } finally {
      setBusy(false)
    }
  }

  const hasTargets = friends.length > 0 || shareableCircles.length > 0
  const canSubmit = hasTargets && !busy && !Boolean(prefKey && !prefOk)

  return (
    <>
      <Button
        size={fullWidth ? 'default' : 'sm'}
        variant="outline"
        className={cn('gap-1.5', fullWidth && 'w-full justify-center', className)}
        onClick={() => setOpen(true)}
      >
        <Users className="h-3.5 w-3.5" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share with circles or friends</DialogTitle>
          </DialogHeader>
          <form onSubmit={onShare} className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Sharing</Label>
              <Input value={title} readOnly className="mt-1" />
            </div>

            {prefKey && !prefOk ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Allow {prefLabel(prefKey)}</p>
                  <p className="text-xs text-muted-foreground">Opt-in — you control what friends can see.</p>
                </div>
                <Switch
                  checked={false}
                  disabled={unlocking}
                  onCheckedChange={(v) => {
                    if (v) void enablePref()
                  }}
                />
              </div>
            ) : null}

            {!hasTargets ? (
              <p className="text-sm text-muted-foreground">
                Add friends or create a circle with members first.{' '}
                <Link to="/friends" className="text-primary underline">
                  Friends
                </Link>
                {' · '}
                <Link to="/circles" className="text-primary underline">
                  Circles
                </Link>
              </p>
            ) : (
              <div className="max-h-64 space-y-4 overflow-y-auto">
                {shareableCircles.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Circles
                    </p>
                    <ul className="space-y-2">
                      {shareableCircles.map((c) => {
                        const others = c.memberIds.filter((id) => id !== cloudUser.uid).length
                        return (
                          <li key={c.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2">
                            <Checkbox
                              checked={!!selectedCircles[c.id]}
                              onCheckedChange={(v) =>
                                setSelectedCircles((s) => ({ ...s, [c.id]: Boolean(v) }))
                              }
                              id={`share-circle-${c.id}`}
                              disabled={Boolean(prefKey && !prefOk)}
                            />
                            <label
                              htmlFor={`share-circle-${c.id}`}
                              className="min-w-0 flex-1 cursor-pointer"
                            >
                              <span className="block text-sm font-medium">{c.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {others} member{others === 1 ? '' : 's'} (besides you)
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}

                {friends.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Friends
                    </p>
                    <ul className="space-y-2">
                      {friends.map((f) => (
                        <li key={f.uid} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2">
                          <Checkbox
                            checked={!!selectedFriends[f.uid]}
                            onCheckedChange={(v) =>
                              setSelectedFriends((s) => ({ ...s, [f.uid]: Boolean(v) }))
                            }
                            id={`share-friend-${f.uid}`}
                            disabled={Boolean(prefKey && !prefOk)}
                          />
                          <label
                            htmlFor={`share-friend-${f.uid}`}
                            className="flex-1 cursor-pointer text-sm font-medium"
                          >
                            {f.displayName}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {circles.length > 0 && shareableCircles.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Your circles only have you so far — invite friends on Circles to share there.
                  </p>
                ) : null}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {busy ? 'Sharing…' : 'Share'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
