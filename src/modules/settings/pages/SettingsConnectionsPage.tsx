import { useAuth } from '@/contexts/AuthContext'
import { ConnectionsPanel } from '../components/ConnectionsPanel'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'

export function SettingsConnectionsPage() {
  const { user } = useAuth()
  const { tick } = useLocalRefresh()

  return (
    <SettingsDetail
      title="Connections"
      description="Link calendars and health apps so Today and Ask see your real schedule."
    >
      <SettingsPanel>
        <p className="text-sm text-muted-foreground">
          Data stays on this device unless you enable cloud backup. Google, Fitbit, and Strava are Plus
          features; .ics feeds are free.
        </p>
        {user ? <ConnectionsPanel userId={user.id} tick={tick} /> : null}
      </SettingsPanel>
    </SettingsDetail>
  )
}
