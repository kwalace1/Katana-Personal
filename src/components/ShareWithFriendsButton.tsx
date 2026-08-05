import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { ShareAudiencePicker, type ShareAudienceSelection } from '@/components/ShareAudiencePicker'
import { shareSuccessMessage, shareWithAudience } from '@/lib/social/share-with-audience'
import type { SharedKind, SharePrefs } from '@/lib/social/types'
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
  const [selectedFriends, setSelectedFriends] = useState<Record<string, boolean>>({})
  const [selectedCircles, setSelectedCircles] = useState<Record<string, boolean>>({})
  const [audience, setAudience] = useState<ShareAudienceSelection>({
    friendIds: [],
    circles: [],
    hasAny: false,
  })
  const [busy, setBusy] = useState(false)
  const [unlocking, setUnlocking] = useState(false)

  const prefKey = prefForKind(kind)
  const prefOk = !prefKey || Boolean(cloudProfile?.sharePrefs?.[prefKey])

  const onAudienceChange = useCallback((sel: ShareAudienceSelection) => {
    setAudience(sel)
  }, [])

  useEffect(() => {
    if (!open) {
      setSelectedFriends({})
      setSelectedCircles({})
      setAudience({ friendIds: [], circles: [], hasAny: false })
    }
  }, [open])

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
    if (!audience.hasAny) {
      toast.message('Pick a circle or at least one friend')
      return
    }

    setBusy(true)
    try {
      const result = await shareWithAudience({
        kind,
        title,
        body,
        data,
        ownerId: cloudUser.uid,
        friendIds: audience.friendIds,
        circles: audience.circles,
        activityFeed: cloudProfile.sharePrefs.activityFeed,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(shareSuccessMessage(result), {
        action: {
          label: 'View Shared',
          onClick: () => navigate('/shared'),
        },
      })
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t share')
    } finally {
      setBusy(false)
    }
  }

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

            <ShareAudiencePicker
              uid={cloudUser.uid}
              enabled={Boolean(prefOk)}
              selectedFriends={selectedFriends}
              selectedCircles={selectedCircles}
              onFriendsChange={setSelectedFriends}
              onCirclesChange={setSelectedCircles}
              onAudienceChange={onAudienceChange}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={busy || !audience.hasAny || Boolean(prefKey && !prefOk)}
            >
              {busy ? 'Sharing…' : 'Share'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
