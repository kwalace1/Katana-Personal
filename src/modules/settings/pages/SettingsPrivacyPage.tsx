import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { DEFAULT_SHARE_PREFS } from '@/lib/social/types'
import { PrivacyDataPanel } from '../components/PrivacyDataPanel'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

export function SettingsPrivacyPage() {
  const { user } = useAuth()
  const { cloudEnabled, cloudUser, cloudProfile } = useCloudAuth()
  const prefs = { ...DEFAULT_SHARE_PREFS, ...cloudProfile?.sharePrefs }

  return (
    <SettingsDetail title="Privacy & data" description="What stays local, what can leave, and why.">
      <SettingsPanel>
        {user ? (
          <PrivacyDataPanel
            userId={user.id}
            cloudEnabled={cloudEnabled}
            cloudSignedIn={Boolean(cloudUser)}
            sharePrefs={prefs}
          />
        ) : null}
      </SettingsPanel>
    </SettingsDetail>
  )
}
