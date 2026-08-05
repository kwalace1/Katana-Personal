import { FormEvent, useEffect, useState } from 'react'
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
import { createSharedItem } from '@/lib/social/shared'
import { publishActivity } from '@/lib/social/streaks'
import type { CloudProfile, SharedKind, SharePrefs } from '@/lib/social/types'
import { DEFAULT_SHARE_PREFS } from '@/lib/social/types'

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
}: {
  kind: SharedKind
  title: string
  body?: string
  data?: Record<string, unknown>
  label?: string
}) {
  const navigate = useNavigate()
  const { cloudUser, cloudProfile, saveSharePrefs, syncStreaksToCloud } = useCloudAuth()
  const [open, setOpen] = useState(false)
  const [friends, setFriends] = useState<CloudProfile[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [unlocking, setUnlocking] = useState(false)

  const prefKey = prefForKind(kind)
  const prefOk = !prefKey || Boolean(cloudProfile?.sharePrefs?.[prefKey])

  useEffect(() => {
    if (!open || !cloudUser) return
    void listFriendProfiles(cloudUser.uid).then(setFriends).catch(() => setFriends([]))
  }, [open, cloudUser])

  if (!cloudUser) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to="/settings">Connect to share</Link>
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
    const memberIds = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([id]) => id)
    if (memberIds.length === 0) {
      toast.message('Pick at least one friend')
      return
    }
    setBusy(true)
    try {
      await createSharedItem({
        kind,
        title,
        body,
        data,
        ownerId: cloudUser.uid,
        memberIds,
      })
      if (cloudProfile.sharePrefs.activityFeed) {
        const ping =
          kind === 'journal'
            ? `Shared mood: ${body || title}`
            : `Shared a ${kind}: ${title}`
        await publishActivity(cloudUser.uid, ping)
      }
      toast.success('Shared with friends', {
        action: {
          label: 'View Shared',
          onClick: () => navigate('/shared'),
        },
      })
      setOpen(false)
      setSelected({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t share')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Users className="h-3.5 w-3.5" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share with friends</DialogTitle>
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

            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add friends first.{' '}
                <Link to="/friends" className="text-primary underline">
                  Open Friends
                </Link>
              </p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {friends.map((f) => (
                  <li key={f.uid} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2">
                    <Checkbox
                      checked={!!selected[f.uid]}
                      onCheckedChange={(v) =>
                        setSelected((s) => ({ ...s, [f.uid]: Boolean(v) }))
                      }
                      id={`share-${f.uid}`}
                      disabled={Boolean(prefKey && !prefOk)}
                    />
                    <label htmlFor={`share-${f.uid}`} className="flex-1 cursor-pointer text-sm font-medium">
                      {f.displayName}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || friends.length === 0 || Boolean(prefKey && !prefOk)}
            >
              {busy ? 'Sharing…' : 'Share'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
