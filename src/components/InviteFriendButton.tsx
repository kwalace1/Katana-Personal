import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Copy, Link2, Share2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { getAddMeUrl, shareAddMeLink } from '@/lib/social/friends'
import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

function preferSheet(): boolean {
  if (typeof window === 'undefined') return false
  const narrow = window.matchMedia('(max-width: 767px)').matches
  const canShare = typeof navigator.share === 'function'
  return narrow || !canShare
}

/** One-tap Add-me share/copy — mobile uses a bottom sheet with QR. */
export function InviteFriendButton({
  className,
  size = 'default',
  variant = 'default',
}: {
  className?: string
  size?: 'default' | 'sm' | 'lg'
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
}) {
  const { cloudEnabled, cloudUser, cloudProfile } = useCloudAuth()
  const [busy, setBusy] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  if (!cloudEnabled || !cloudUser || !cloudProfile?.friendCode) {
    return (
      <Button asChild size={size} variant={!cloudEnabled ? 'outline' : variant} className={cn('min-h-11 gap-1.5', className)}>
        <Link to="/settings#cloud">
          <Users className="h-4 w-4" />
          Connect to invite
        </Link>
      </Button>
    )
  }

  const code = cloudProfile.friendCode
  const url = getAddMeUrl(code)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function runShare() {
    setBusy(true)
    try {
      const how = await shareAddMeLink(code)
      toast.success(how === 'shared' ? 'Invite shared' : 'Add-me link copied')
      setSheetOpen(false)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast.error(err instanceof Error ? err.message : 'Couldn’t share invite')
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    const ok = await copyToClipboard(url)
    if (ok) {
      toast.success('Add-me link copied')
      setSheetOpen(false)
    } else {
      toast.error('Couldn’t copy link')
    }
  }

  function onInviteClick() {
    if (preferSheet()) {
      setSheetOpen(true)
      return
    }
    void runShare()
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn('min-h-11 gap-1.5', className)}
        disabled={busy}
        onClick={onInviteClick}
      >
        {canNativeShare ? <Share2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {busy ? 'Working…' : 'Invite someone'}
      </Button>

      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerHeader>
            <DrawerTitle>Invite someone</DrawerTitle>
            <DrawerDescription>
              Share your Add-me link. Only what you choose to share leaves this device.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col items-center gap-4 px-4 pb-2">
            <img
              alt={`QR code for friend code ${code}`}
              className="h-40 w-40 rounded-xl border border-border/50 bg-white p-2"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`}
            />
            <p className="font-display text-2xl tracking-widest text-primary">{code}</p>
          </div>
          <DrawerFooter className="gap-2">
            {canNativeShare ? (
              <Button className="min-h-12 gap-2" disabled={busy} onClick={() => void runShare()}>
                <Share2 className="h-4 w-4" />
                {busy ? 'Working…' : 'Share link'}
              </Button>
            ) : null}
            <Button variant="outline" className="min-h-12 gap-2" onClick={() => void copyLink()}>
              <Copy className="h-4 w-4" />
              Copy Add-me link
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
