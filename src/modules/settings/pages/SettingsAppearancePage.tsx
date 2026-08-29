import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { HueWheel } from '@/components/HueWheel'
import { SimpleThemeToggle } from '@/components/SimpleThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import {
  DEFAULT_ACCENT_HUE,
  normalizeHue,
  resolveAccentHue,
  syncAccentToDocument,
  writeStoredAccentHue,
} from '@/lib/accent'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

export function SettingsAppearancePage() {
  const { profile, updatePreferences } = useAuth()
  const [accentHue, setAccentHue] = useState(
    () => resolveAccentHue(profile?.preferences) ?? DEFAULT_ACCENT_HUE,
  )

  useEffect(() => {
    const hue = resolveAccentHue(profile?.preferences)
    if (hue != null) setAccentHue(hue)
  }, [profile?.preferences])

  function persistAccentHue(hue: number | null) {
    const dark = document.documentElement.classList.contains('dark')
    if (hue == null) {
      writeStoredAccentHue(null)
      updatePreferences({ accent_hue: null })
      syncAccentToDocument(null, dark)
      setAccentHue(DEFAULT_ACCENT_HUE)
      return
    }
    const n = normalizeHue(hue) ?? DEFAULT_ACCENT_HUE
    writeStoredAccentHue(n)
    updatePreferences({ accent_hue: n })
    syncAccentToDocument(n, dark)
    setAccentHue(n)
  }

  return (
    <SettingsDetail title="Appearance" description="Accent color and light or dark mode.">
      <SettingsPanel>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <HueWheel
            hue={accentHue}
            onChange={(h) => {
              setAccentHue(h)
              syncAccentToDocument(h, document.documentElement.classList.contains('dark'))
            }}
            onCommit={(h) => persistAccentHue(h)}
          />
          <div className="space-y-3 sm:pt-2">
            <div className="flex items-center gap-3">
              <span
                className="h-10 w-10 rounded-full border border-border/50 shadow-sm"
                style={{ background: `hsl(${accentHue} 48% 40%)` }}
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium">Accent</p>
                <p className="text-xs text-muted-foreground">{accentHue}° · full spectrum</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SimpleThemeToggle />
              <Button type="button" variant="outline" size="sm" onClick={() => persistAccentHue(null)}>
                Reset to teal
              </Button>
            </div>
          </div>
        </div>
      </SettingsPanel>
    </SettingsDetail>
  )
}
