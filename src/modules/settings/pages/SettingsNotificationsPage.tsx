import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { NotificationsPanel } from '../components/NotificationsPanel'
import { SettingsDetail } from '../components/settings-ui'

export function SettingsNotificationsPage() {
  const { profile, updatePreferences } = useAuth()
  const { cloudUser, enablePushNotifications } = useCloudAuth()

  return (
    <SettingsDetail title="Notifications" description="Gentle reminders and proactive orchestration nudges.">
      <NotificationsPanel
        preferences={profile?.preferences}
        cloudSignedIn={Boolean(cloudUser)}
        onUpdatePreferences={updatePreferences}
        enablePushNotifications={enablePushNotifications}
      />
    </SettingsDetail>
  )
}
