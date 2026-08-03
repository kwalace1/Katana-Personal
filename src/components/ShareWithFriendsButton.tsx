import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { CloudProfile, SharedKind } from '@/lib/social/types'
import { Link } from 'react-router-dom'

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
  const { cloudUser, cloudProfile } = useCloudAuth()
  const [open, setOpen] = useState(false)
  const [friends, setFriends] = useState<CloudProfile[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

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

  async function onShare(e: FormEvent) {
    e.preventDefault()
    if (!cloudUser || !cloudProfile) return
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
        await publishActivity(cloudUser.uid, `Shared a ${kind}: ${title}`)
      }
      toast.success('Shared with friends')
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
                    />
                    <label htmlFor={`share-${f.uid}`} className="flex-1 cursor-pointer text-sm font-medium">
                      {f.displayName}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <Button type="submit" className="w-full" disabled={busy || friends.length === 0}>
              {busy ? 'Sharing…' : 'Share'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
