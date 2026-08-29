import { Navigate, Route, Routes } from 'react-router-dom'
import { SettingsHashRedirect } from './SettingsHashRedirect'
import { SettingsHub } from './SettingsHub'
import { SettingsProfilePage } from './SettingsProfilePage'
import { SettingsAppearancePage } from './SettingsAppearancePage'
import { SettingsNotificationsPage } from './SettingsNotificationsPage'
import { SettingsConnectionsPage } from './SettingsConnectionsPage'
import { SettingsPrivacyPage } from './SettingsPrivacyPage'
import { SettingsAskPage } from './SettingsAskPage'
import { SettingsPlusPage } from './SettingsPlusPage'
import { SettingsTogetherPage } from './SettingsTogetherPage'
import { SettingsSharingPage } from './SettingsSharingPage'
import { SettingsSyncPage } from './SettingsSyncPage'
import { SettingsBackupPage } from './SettingsBackupPage'
import { SettingsAdvancedPage } from './SettingsAdvancedPage'

export default function SettingsRouter() {
  return (
    <>
      <SettingsHashRedirect />
      <Routes>
        <Route index element={<SettingsHub />} />
        <Route path="profile" element={<SettingsProfilePage />} />
        <Route path="appearance" element={<SettingsAppearancePage />} />
        <Route path="notifications" element={<SettingsNotificationsPage />} />
        <Route path="connections" element={<SettingsConnectionsPage />} />
        <Route path="privacy" element={<SettingsPrivacyPage />} />
        <Route path="ask" element={<SettingsAskPage />} />
        <Route path="plus" element={<SettingsPlusPage />} />
        <Route path="together" element={<SettingsTogetherPage />} />
        <Route path="sharing" element={<SettingsSharingPage />} />
        <Route path="sync" element={<SettingsSyncPage />} />
        <Route path="backup" element={<SettingsBackupPage />} />
        <Route path="advanced" element={<SettingsAdvancedPage />} />
        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>
    </>
  )
}
