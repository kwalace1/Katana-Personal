import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Cloud, Download, Merge, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { useLocalRefresh, broadcastLocalRefresh } from '@/hooks/useLocalRefresh'
import {
  cloudWorkspaceHasData,
  localWorkspaceHasData,
  markWorkspaceMergeDone,
  mergeWorkspaceBothWays,
  needsWorkspaceMergeChoice,
  pullWorkspaceFromCloud,
  pushWorkspaceToCloud,
  registerWorkspaceSync,
  syncWorkspaceNow,
} from '@/lib/workspace-sync'

/**
 * After cloud sign-in: register sync, prompt once if both devices have data,
 * otherwise auto link (upload empty cloud or download empty local).
 */
export function WorkspaceSyncHost() {
  const { user } = useAuth()
  const { cloudUser } = useCloudAuth()
  const { refresh } = useLocalRefresh()
  const [choice, setChoice] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!cloudUser || !user) {
      registerWorkspaceSync(null)
      setChoice(false)
      return
    }
    registerWorkspaceSync({ cloudUid: cloudUser.uid, localUserId: user.id })

    let cancelled = false
    void (async () => {
      try {
        const cloudHas = await cloudWorkspaceHasData(cloudUser.uid)
        const localHas = localWorkspaceHasData(user.id)
        if (cancelled) return

        if (!needsWorkspaceMergeChoice(cloudUser.uid)) {
          await syncWorkspaceNow()
          if (!cancelled) broadcastLocalRefresh()
          return
        }

        if (localHas && cloudHas) {
          setChoice(true)
          return
        }
        if (localHas && !cloudHas) {
          await pushWorkspaceToCloud()
          toast.success('This device is now syncing to the cloud')
        } else if (!localHas && cloudHas) {
          await pullWorkspaceFromCloud()
          broadcastLocalRefresh()
          toast.success('Downloaded your cloud workspace')
        } else {
          markWorkspaceMergeDone(cloudUser.uid)
        }
      } catch {
        // offline / rules not published yet
      }
    })()

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void syncWorkspaceNow()
          .then(() => broadcastLocalRefresh())
          .catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [cloudUser?.uid, user?.id])

  if (!choice || !cloudUser || !user) return null

  async function run(kind: 'upload' | 'download' | 'merge') {
    setBusy(true)
    try {
      if (kind === 'upload') await pushWorkspaceToCloud()
      else if (kind === 'download') {
        await pullWorkspaceFromCloud()
        broadcastLocalRefresh()
      } else {
        await mergeWorkspaceBothWays()
        broadcastLocalRefresh()
      }
      setChoice(false)
      toast.success(
        kind === 'upload'
          ? 'Uploaded this device'
          : kind === 'download'
            ? 'Downloaded cloud copy'
            : 'Merged both devices',
      )
      refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed — publish Firestore rules?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg md:bottom-8">
      <div className="kp-surface border border-primary/25 p-4 shadow-xl sm:p-5">
        <div className="flex items-start gap-3">
          <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Link this device to the cloud</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Both this device and the cloud already have personal data. Choose how to combine them
              so phone and computer stay in sync.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                className="min-h-11 gap-1.5"
                disabled={busy}
                onClick={() => void run('merge')}
              >
                <Merge className="h-4 w-4" />
                Smart merge
              </Button>
              <Button
                variant="outline"
                className="min-h-11 gap-1.5"
                disabled={busy}
                onClick={() => void run('upload')}
              >
                <Upload className="h-4 w-4" />
                Use this device
              </Button>
              <Button
                variant="outline"
                className="min-h-11 gap-1.5"
                disabled={busy}
                onClick={() => void run('download')}
              >
                <Download className="h-4 w-4" />
                Use cloud copy
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
