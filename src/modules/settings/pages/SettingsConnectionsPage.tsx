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
      description="Calendars, tasks, weather, and health file import — so Today and Ask see the real day."
    >
      <SettingsPanel>
        <p className="text-sm text-muted-foreground">
          .ics feeds, weather, and Apple Health / Fitbit file import are free. Google Calendar, Outlook,
          Google Tasks, and Todoist connect when their env credentials are set on this deploy.
        </p>
        {user ? <ConnectionsPanel userId={user.id} tick={tick} /> : null}
      </SettingsPanel>
    </SettingsDetail>
  )
}
