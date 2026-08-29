import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { DEFAULT_SHARE_PREFS, type SharePrefs } from '@/lib/social/types'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

const SHARE_TOGGLES: { key: keyof SharePrefs; label: string; hint: string }[] = [
  { key: 'activityFeed', label: 'Activity pings', hint: 'Check-ins & shares show on Circles timelines' },
  { key: 'feedCards', label: 'Feed cards', hint: 'Share win cards to Feed after lifts, streaks, and goals' },
  { key: 'healthWater', label: 'Hydration streaks', hint: 'Glasses & water streaks on Circles' },
  { key: 'healthSleep', label: 'Sleep streaks', hint: 'Sleep days on Circles' },
  { key: 'healthNutrition', label: 'Nutrition streaks', hint: 'Logged meals streak' },
  { key: 'healthLifts', label: 'Lift streaks', hint: 'Strength session days on Circles' },
  { key: 'healthWorkouts', label: 'Move streaks', hint: 'Cardio / general workout days' },
  { key: 'habits', label: 'Habit streaks', hint: 'Best habit streak' },
  { key: 'goals', label: 'Goals progress', hint: 'Let friends see goal momentum' },
  { key: 'journalMood', label: 'Journal mood', hint: 'Mood only — never full entries' },
  { key: 'notes', label: 'Notes', hint: 'Allow sharing notes with friends' },
  { key: 'files', label: 'Files', hint: 'Allow sharing files with friends' },
]

export function SettingsSharingPage() {
  const { cloudUser, cloudProfile, saveSharePrefs, syncStreaksToCloud } = useCloudAuth()
  const [prefs, setPrefs] = useState<SharePrefs>(DEFAULT_SHARE_PREFS)

  useEffect(() => {
    if (cloudProfile?.sharePrefs) setPrefs({ ...DEFAULT_SHARE_PREFS, ...cloudProfile.sharePrefs })
  }, [cloudProfile])

  if (!cloudUser) {
    return (
      <SettingsDetail title="Sharing" description="Sign in to Together first.">
        <SettingsPanel>
          <p className="text-sm text-muted-foreground">Control what friends can see after you connect your cloud account.</p>
        </SettingsPanel>
      </SettingsDetail>
    )
  }

  return (
    <SettingsDetail title="What friends can see" description="Everything off by default. Flip on what you’re OK sharing.">
      <SettingsPanel>
        <ul className="space-y-3">
          {SHARE_TOGGLES.map((t) => (
            <li key={t.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.hint}</p>
              </div>
              <Switch
                checked={!!prefs[t.key]}
                onCheckedChange={(v) => {
                  const next = { ...prefs, [t.key]: v }
                  setPrefs(next)
                  void saveSharePrefs(next)
                    .then(() => syncStreaksToCloud())
                    .then(() => toast.success('Sharing updated'))
                    .catch((err) => toast.error(err instanceof Error ? err.message : 'Couldn’t save'))
                }}
              />
            </li>
          ))}
        </ul>
      </SettingsPanel>
    </SettingsDetail>
  )
}
