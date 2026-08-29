import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  mergeWorkspaceBothWays,
  pullWorkspaceFromCloud,
  subscribeWorkspaceSyncStatus,
  syncWorkspaceNow,
} from '@/lib/workspace-sync'
import { broadcastLocalRefresh } from '@/hooks/useLocalRefresh'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

export function SettingsSyncPage() {
  const [syncAt, setSyncAt] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    return subscribeWorkspaceSyncStatus((s) => {
      setSyncAt(s.lastSyncedAt)
      setSyncBusy(s.busy)
      setSyncError(s.error)
    })
  }, [])

  return (
    <SettingsDetail
      title="Cloud sync"
      description="Tasks, habits, water, calendar, and the rest of your personal space across devices."
    >
      <SettingsPanel>
        <p className="text-xs text-muted-foreground">
          {syncBusy
            ? 'Syncing…'
            : syncAt
              ? `Last synced ${new Date(syncAt).toLocaleString()}`
              : 'Not synced yet — open the app on both devices while signed in.'}
          {syncError ? ` · ${syncError}` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={syncBusy}
            onClick={() => {
              void syncWorkspaceNow()
                .then(() => {
                  broadcastLocalRefresh()
                  toast.success('Synced')
                })
                .catch((err) => toast.error(err instanceof Error ? err.message : 'Sync failed'))
            }}
          >
            Sync now
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={syncBusy}
            onClick={() => {
              void mergeWorkspaceBothWays()
                .then(() => {
                  broadcastLocalRefresh()
                  toast.success('Merged with cloud')
                })
                .catch((err) => toast.error(err instanceof Error ? err.message : 'Merge failed'))
            }}
          >
            Merge with cloud
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={syncBusy}
            onClick={() => {
              if (
                !window.confirm(
                  'Replace this device’s personal data with the cloud copy? Local-only changes on this device may be lost.',
                )
              ) {
                return
              }
              void pullWorkspaceFromCloud()
                .then(() => {
                  broadcastLocalRefresh()
                  toast.success('Downloaded cloud copy')
                })
                .catch((err) => toast.error(err instanceof Error ? err.message : 'Download failed'))
            }}
          >
            Use cloud copy
          </Button>
        </div>
      </SettingsPanel>
    </SettingsDetail>
  )
}
