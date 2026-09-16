import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { eraseLocalWorkspace } from '@/lib/erase-space'
import { SettingsPanel } from './settings-ui'

export function DeleteSpacePanel() {
  const { user } = useAuth()
  const { cloudUser, deleteTogetherAccount } = useCloudAuth()
  const [open, setOpen] = useState<'device' | 'account' | null>(null)
  const [busy, setBusy] = useState(false)

  async function eraseDevice() {
    setBusy(true)
    try {
      await eraseLocalWorkspace(user?.id)
      toast.success('This device is clear')
      window.location.replace('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t erase this device')
      setBusy(false)
    }
  }

  async function deleteAccount() {
    setBusy(true)
    try {
      const result = await deleteTogetherAccount()
      await eraseLocalWorkspace(user?.id)
      if (result.error) {
        toast.message('This device is clear', { description: result.error })
      } else {
        toast.success('Together account and this device are gone')
      }
      window.location.replace('/')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t delete the account')
      setBusy(false)
    }
  }

  return (
    <SettingsPanel className="mt-4">
      <h3 className="text-sm font-semibold">Erase & delete</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Save a copy first if you might want this space back. Erasing this device does not cancel a store
        subscription.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setOpen('device')}>
          Erase this device
        </Button>
        {cloudUser ? (
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            disabled={busy}
            onClick={() => setOpen('account')}
          >
            Delete Together account
          </Button>
        ) : null}
      </div>
      <nav className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Legal">
        <Link to="/settings/legal/privacy" className="min-h-11 inline-flex items-center text-primary underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        <Link to="/settings/legal/terms" className="min-h-11 inline-flex items-center text-primary underline-offset-2 hover:underline">
          Terms of Use
        </Link>
      </nav>

      <AlertDialog open={open === 'device'} onOpenChange={(next) => !busy && setOpen(next ? 'device' : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erase this device?</AlertDialogTitle>
            <AlertDialogDescription>
              Tasks, health logs, notes, and everything else on this phone will be removed. Together (if
              signed in) stays until you delete that account separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void eraseDevice()}>
              Erase this device
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={open === 'account'} onOpenChange={(next) => !busy && setOpen(next ? 'account' : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your Together account?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your cloud profile, friends, Circles posts, and synced workspace, then erases
              this device. You can open a new local space afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep account</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void deleteAccount()}>
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsPanel>
  )
}
