import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { HueWheel } from '@/components/HueWheel'
import { Segmented } from '@/components/ui/segmented'
import { useAuth } from '@/contexts/AuthContext'
import {
  DEFAULT_ACCENT_HUE,
  normalizeHue,
  resolveAccentHue,
  syncAccentToDocument,
  writeStoredAccentHue,
} from '@/lib/accent'
import { cn } from '@/lib/utils'
import { highContrastPalette, MORE_CONTRAST_QUERY } from '@/theme/contrast'
import { themeLabel, themeSwatch, THEME_CHOICES, THEME_GROUPS } from '@/theme/families'
import { readThemePreferences, writeThemePreferences } from '@/theme/preferences'
import { paintEffectiveTheme, setPreviewFamily, subscribeThemeClock } from '@/theme/preview'
import { SEASON_LABELS, seasonAt, seasonRanges } from '@/theme/seasons'
import {
  PERIOD_LABELS,
  PERIOD_RANGES,
  activeChangePoint,
  changesFor,
  formatClock,
  periodAt,
  isUsableSchedule,
  presetChanges,
  schedulesMatch,
  suggestChangeMinutes,
  validateCustomSchedule,
  type ThemeChangeDraft,
} from '@/theme/rotation'
import {
  DAY_PERIODS,
  DEFAULT_SEASON_ASSIGNMENTS,
  SEASONS,
  type Appearance,
  type ContrastPreference,
  type DayPeriod,
  type Hemisphere,
  type RotationMode,
  type ScheduleKind,
  type Season,
  type SeasonAssignments,
  type ThemeChange,
  type ThemeFamily,
  type ThemeSchedule,
} from '@/theme/types'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

const APPEARANCE_OPTIONS: { id: Appearance; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

const CONTRAST_OPTIONS: { id: ContrastPreference; label: string }[] = [
  { id: 'system', label: 'Follow device' },
  { id: 'high', label: 'High contrast' },
]

const ROTATION_OPTIONS: { id: RotationMode; label: string }[] = [
  { id: 'off', label: 'Manual' },
  { id: 'time-of-day', label: 'Time of day' },
  { id: 'seasonal', label: 'Seasonal' },
]

const HEMISPHERE_OPTIONS: { id: Hemisphere; label: string }[] = [
  { id: 'northern', label: 'Northern' },
  { id: 'southern', label: 'Southern' },
]

const SCHEDULE_OPTIONS: { id: ScheduleKind; label: string }[] = [
  { id: 'preset', label: 'Preset' },
  { id: 'custom', label: 'Custom' },
]

function clockValue(minutes: number | null) {
  if (minutes == null) return ''
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function minutesFromClock(value: string): number | null {
  if (!value) return null
  const [hour, minute] = value.split(':').map((part) => Number(part))
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  return hour * 60 + minute
}

type LocalDraft = ThemeChangeDraft & { id: string }

function asDraft(changes: ThemeChangeDraft[]): LocalDraft[] {
  return changes.map((change) => ({
    minutes: change.minutes,
    theme: change.theme,
    id: crypto.randomUUID(),
  }))
}

export function SettingsAppearancePage() {
  const { profile, updatePreferences } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [savedFamily, setSavedFamily] = useState<ThemeFamily>(() => readThemePreferences().family)
  const [preview, setPreview] = useState<ThemeFamily | null>(null)
  const [rotation, setRotation] = useState<RotationMode>(() => readThemePreferences().rotation)
  const [schedule, setSchedule] = useState<ThemeSchedule>(() => readThemePreferences().schedule)
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>(() => readThemePreferences().scheduleKind)
  const [customSchedule, setCustomSchedule] = useState<ThemeChange[]>(() => readThemePreferences().customSchedule)
  const [customDraft, setCustomDraft] = useState<LocalDraft[] | null>(null)
  const [customError, setCustomError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [hemisphere, setHemisphere] = useState<Hemisphere>(() => readThemePreferences().hemisphere)
  const [seasons, setSeasons] = useState<SeasonAssignments>(() => readThemePreferences().seasons)
  const [confirmSeasonReset, setConfirmSeasonReset] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [contrast, setContrast] = useState<ContrastPreference>(() => readThemePreferences().contrast)
  const [systemMoreContrast, setSystemMoreContrast] = useState(false)
  const [schemeDark, setSchemeDark] = useState(
    () => document.documentElement.classList.contains('dark'),
  )
  const [accentHue, setAccentHue] = useState(
    () => resolveAccentHue(profile?.preferences) ?? DEFAULT_ACCENT_HUE,
  )

  useEffect(() => {
    setMounted(true)
    const contrastMedia = window.matchMedia(MORE_CONTRAST_QUERY)
    const schemeMedia = window.matchMedia('(prefers-color-scheme: dark)')
    const syncContrast = () => setSystemMoreContrast(contrastMedia.matches)
    const syncScheme = () => setSchemeDark(schemeMedia.matches)
    syncContrast()
    syncScheme()
    contrastMedia.addEventListener('change', syncContrast)
    schemeMedia.addEventListener('change', syncScheme)
    const unsubscribe = subscribeThemeClock(() => setClock(new Date()))
    return () => {
      contrastMedia.removeEventListener('change', syncContrast)
      schemeMedia.removeEventListener('change', syncScheme)
      unsubscribe()
      setPreviewFamily(null)
    }
  }, [])

  useEffect(() => {
    const hue = resolveAccentHue(profile?.preferences)
    if (hue != null) setAccentHue(hue)
  }, [profile?.preferences])

  const dailyActive = rotation === 'time-of-day'
  const seasonalActive = rotation === 'seasonal'
  const rotationActive = rotation !== 'off'
  const currentSeason = seasonAt(clock, hemisphere)
  const usingCustom = scheduleKind === 'custom' && isUsableSchedule(customSchedule)
  const activePoint = activeChangePoint(
    changesFor({ scheduleKind, schedule, customSchedule }),
    clock,
  )
  const rotatedFamily = dailyActive && activePoint
    ? activePoint.theme
    : seasonalActive
      ? seasons[currentSeason]
      : savedFamily
  const editingCustom = customDraft != null
  const customBaseline = scheduleKind === 'custom' ? customSchedule : presetChanges(schedule)
  const customDirty = customDraft != null && !schedulesMatch(customDraft, customBaseline)
  const shown = preview ?? rotatedFamily
  const rotationStatus = dailyActive && activePoint
    ? usingCustom
      ? `${themeLabel(activePoint.theme)} · since ${formatClock(activePoint.minutes)}`
      : `${themeLabel(activePoint.theme)} · ${PERIOD_LABELS[periodAt(clock)]} schedule`
    : seasonalActive
      ? `${themeLabel(seasons[currentSeason])} · Seasonal rotation`
      : null
  const appearance: Appearance = theme === 'light' || theme === 'dark' ? theme : 'system'
  const swatchAppearance: 'light' | 'dark' =
    appearance === 'dark' || (appearance === 'system' && schemeDark) ? 'dark' : 'light'
  const contrastOn = contrast === 'high' || (contrast === 'system' && systemMoreContrast)
  const classicActive = shown === 'classic'

  function chooseContrast(next: ContrastPreference) {
    writeThemePreferences({ contrast: next })
    setContrast(next)
    paintEffectiveTheme()
  }

  function paintAccent(hue: number | null) {
    const dark = document.documentElement.classList.contains('dark')
    if ((document.documentElement.dataset.theme || 'classic') !== 'classic') {
      syncAccentToDocument(null, dark)
      return
    }
    syncAccentToDocument(hue, dark)
  }

  function persistAccentHue(hue: number | null) {
    if (hue == null) {
      writeStoredAccentHue(null)
      updatePreferences({ accent_hue: null })
      paintAccent(null)
      setAccentHue(DEFAULT_ACCENT_HUE)
      return
    }
    const n = normalizeHue(hue) ?? DEFAULT_ACCENT_HUE
    writeStoredAccentHue(n)
    updatePreferences({ accent_hue: n })
    paintAccent(n)
    setAccentHue(n)
  }

  function chooseRotation(next: RotationMode) {
    if (customDirty) {
      setCustomError('Save or cancel these changes first.')
      return
    }
    writeThemePreferences({ rotation: next })
    setRotation(next)
    setCustomDraft(null)
    setConfirmSeasonReset(false)
    setPreview(null)
    setPreviewFamily(null)
  }

  function chooseHemisphere(next: Hemisphere) {
    writeThemePreferences({ hemisphere: next })
    setHemisphere(next)
    paintEffectiveTheme()
  }

  function assignSeason(slot: Season, family: ThemeFamily) {
    const next = { ...seasons, [slot]: family }
    writeThemePreferences({ seasons: next })
    setSeasons(next)
    paintEffectiveTheme()
  }

  function resetSeasons() {
    const next = { ...DEFAULT_SEASON_ASSIGNMENTS }
    writeThemePreferences({ seasons: next })
    setSeasons(next)
    setConfirmSeasonReset(false)
    paintEffectiveTheme()
  }

  function assignPeriod(slot: DayPeriod, family: ThemeFamily) {
    const next = { ...schedule, [slot]: family }
    writeThemePreferences({ schedule: next })
    setSchedule(next)
    paintEffectiveTheme()
  }

  function shownScheduleKind(): ScheduleKind {
    return editingCustom && scheduleKind === 'preset' ? 'custom' : scheduleKind
  }

  function chooseScheduleKind(kind: ScheduleKind) {
    if (customDirty && kind === 'preset') {
      setCustomError('Save or cancel these changes first.')
      return
    }
    setCustomError(null)
    setConfirmReset(false)
    if (kind === 'preset') {
      if (scheduleKind === 'custom') {
        writeThemePreferences({ scheduleKind: 'preset' })
        setScheduleKind('preset')
        paintEffectiveTheme()
      }
      setCustomDraft(null)
      return
    }
    if (isUsableSchedule(customSchedule)) {
      writeThemePreferences({ scheduleKind: 'custom' })
      setScheduleKind('custom')
      setCustomDraft(null)
      paintEffectiveTheme()
      return
    }
    setCustomDraft(asDraft(presetChanges(schedule)))
  }

  function beginCustomEdit() {
    if (customDraft) return customDraft
    const next = asDraft(customSchedule)
    setCustomDraft(next)
    return next
  }

  function updateDraft(next: LocalDraft[]) {
    setCustomDraft(next)
    setCustomError(null)
    setConfirmReset(false)
  }

  function addCustomChange() {
    const base = beginCustomEdit()
    const minutes = suggestChangeMinutes(base.map((change) => change.minutes))
    if (minutes == null) {
      setCustomError('Every minute already has a theme change.')
      return
    }
    updateDraft([...base, { minutes, theme: 'classic', id: crypto.randomUUID() }])
  }

  function saveCustom() {
    const result = validateCustomSchedule(customDraft ?? customSchedule)
    if (!result.ok) {
      setCustomError(result.message)
      return
    }
    writeThemePreferences({ scheduleKind: 'custom', customSchedule: result.changes })
    setScheduleKind('custom')
    setCustomSchedule(result.changes)
    setCustomDraft(null)
    setCustomError(null)
    setConfirmReset(false)
    paintEffectiveTheme()
  }

  function cancelCustom() {
    setCustomDraft(null)
    setCustomError(null)
    setConfirmReset(false)
  }

  function chooseFamily(family: ThemeFamily) {
    if (!rotationActive && family === savedFamily) {
      setPreview(null)
      setPreviewFamily(null)
      return
    }
    if (preview === family || (!preview && rotationActive && family === rotatedFamily)) {
      if (preview) {
        setPreview(null)
        setPreviewFamily(null)
      }
      return
    }
    setPreview(family)
    setPreviewFamily(family)
  }

  function applyPreview() {
    if (!preview) return
    writeThemePreferences(rotationActive ? { family: preview, rotation: 'off' } : { family: preview })
    setSavedFamily(preview)
    if (rotationActive) setRotation('off')
    setPreview(null)
    setPreviewFamily(null)
  }

  function cancelPreview() {
    setPreview(null)
    setPreviewFamily(null)
  }

  return (
    <SettingsDetail title="Appearance" description="Theme, light or dark, contrast, and the Classic accent.">
      <SettingsPanel>
        <div>
          <p className="text-sm font-medium">Theme</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Preview updates this page. Apply saves it on this device.
          </p>
        </div>
        <div className="space-y-4">
          {THEME_GROUPS.map((group) => (
            <div key={group}>
              <p className="text-xs text-muted-foreground">{group}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {THEME_CHOICES.filter((choice) => choice.group === group).map((choice) => {
                  const baseSwatch = themeSwatch(choice.id, swatchAppearance)
                  const swatch = contrastOn ? highContrastPalette(baseSwatch, swatchAppearance) : baseSwatch
                  const selected = shown === choice.id
                  const current = savedFamily === choice.id
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseFamily(choice.id)}
                      className={cn(
                        'rounded-lg border p-2.5 text-left transition-colors',
                        selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-8 overflow-hidden rounded-md border',
                          contrastOn ? undefined : 'border-foreground/25',
                        )}
                        style={contrastOn ? { borderColor: `hsl(${swatch['--border']})` } : undefined}
                      >
                        <SwatchColor value={swatch['--background']} />
                        <SwatchColor value={swatch['--card']} />
                        <SwatchColor value={swatch['--primary']} />
                        <SwatchColor value={swatch['--accent']} />
                      </span>
                      <span className="mt-2 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{choice.label}</span>
                        {current ? (
                          <span className="text-[0.65rem] text-muted-foreground">Current</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{choice.note}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {preview ? (
          <div className="space-y-2">
            {rotationActive ? (
              <p className="text-xs text-muted-foreground">
                Applying a theme turns off automatic rotation. Saved schedules stay available.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={applyPreview}>
                Apply {themeLabel(preview)}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelPreview}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-sm font-medium">Today</p>
          <p className="mt-0.5 text-xs text-muted-foreground">A calm day, in this theme.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input className="h-9 max-w-[14rem]" readOnly value="Morning note" aria-label="Sample field" />
            <Button type="button" size="sm">
              Primary
            </Button>
            <Button type="button" size="sm" variant="outline">
              Secondary
            </Button>
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel className="mt-3">
        <div>
          <p className="text-sm font-medium">Rotation</p>
          <p className="mt-1 text-xs text-muted-foreground">Manual keeps the theme you applied.</p>
        </div>
        {mounted ? (
          <Segmented
            options={ROTATION_OPTIONS}
            value={rotation}
            onChange={chooseRotation}
            full
          />
        ) : (
          <div className="h-8" />
        )}
        {rotationStatus ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {rotationStatus}
          </p>
        ) : null}
        {dailyActive ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Schedule</p>
            {mounted ? (
              <Segmented
                options={SCHEDULE_OPTIONS}
                value={shownScheduleKind()}
                onChange={chooseScheduleKind}
                full
              />
            ) : null}
            {shownScheduleKind() === 'preset' ? (
              <div className="space-y-2">
                {DAY_PERIODS.map((slot) => (
                  <label key={slot} className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium">{PERIOD_LABELS[slot]}</span>
                      <span className="block text-xs text-muted-foreground">{PERIOD_RANGES[slot]}</span>
                    </span>
                    <select
                      className="h-10 min-w-[7.5rem] rounded-lg border border-border bg-card px-2 text-sm text-foreground"
                      aria-label={`${PERIOD_LABELS[slot]} theme`}
                      value={schedule[slot]}
                      onChange={(event) => assignPeriod(slot, event.target.value as ThemeFamily)}
                    >
                      {THEME_CHOICES.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : (
              <CustomScheduleEditor
                rows={
                  customDraft ??
                  customSchedule.map((change, index) => ({
                    ...change,
                    id: `saved-${index}-${change.minutes}`,
                  }))
                }
                error={customError}
                confirmReset={confirmReset}
                dirty={customDirty}
                seeded={editingCustom && scheduleKind === 'preset'}
                incomplete={!usingCustom && !editingCustom}
                onChange={updateDraft}
                onAdd={addCustomChange}
                onSave={saveCustom}
                onCancel={cancelCustom}
                onAskReset={() => setConfirmReset(true)}
                onKeep={() => setConfirmReset(false)}
                onReset={() => updateDraft(asDraft(presetChanges(schedule)))}
              />
            )}
          </div>
        ) : null}
        {seasonalActive ? (
          <SeasonalRotation
            hemisphere={hemisphere}
            seasons={seasons}
            confirmReset={confirmSeasonReset}
            onHemisphere={chooseHemisphere}
            onAssign={assignSeason}
            onAskReset={() => setConfirmSeasonReset(true)}
            onKeep={() => setConfirmSeasonReset(false)}
            onReset={resetSeasons}
          />
        ) : null}
      </SettingsPanel>

      <SettingsPanel className="mt-3">
        <div>
          <p className="text-sm font-medium">Appearance</p>
          <p className="mt-1 text-xs text-muted-foreground">System follows this device.</p>
        </div>
        {mounted ? (
          <Segmented options={APPEARANCE_OPTIONS} value={appearance} onChange={setTheme} full />
        ) : (
          <div className="h-8" />
        )}
        <div className="pt-1">
          <p className="text-sm font-medium">Contrast</p>
          <p className="mt-1 text-xs text-muted-foreground">
            High contrast strengthens text, borders, and focus on the current theme.
          </p>
        </div>
        {mounted ? (
          <Segmented options={CONTRAST_OPTIONS} value={contrast} onChange={chooseContrast} full />
        ) : (
          <div className="h-8" />
        )}
        {mounted ? (
          <p className="text-xs text-muted-foreground">
            {contrast === 'system'
              ? systemMoreContrast
                ? 'This device is using increased contrast.'
                : 'This device is using standard contrast.'
              : 'High contrast stays on when the theme changes.'}
          </p>
        ) : null}
      </SettingsPanel>

      <SettingsPanel className="mt-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <HueWheel
            hue={accentHue}
            onChange={(h) => {
              setAccentHue(h)
              paintAccent(h)
            }}
            onCommit={(h) => persistAccentHue(h)}
          />
          <div className="space-y-3 sm:pt-2">
            <div className="flex items-center gap-3">
              <span
                className="h-10 w-10 rounded-full border border-border/50 shadow-sm"
                style={{ background: classicActive ? `hsl(${accentHue} 48% 40%)` : 'hsl(var(--primary))' }}
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium">Accent</p>
                <p className="text-xs text-muted-foreground">
                  {classicActive ? `${accentHue}° on Classic` : 'Colors Classic. This theme uses its own accent.'}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => persistAccentHue(null)}>
              Reset to teal
            </Button>
          </div>
        </div>
      </SettingsPanel>
    </SettingsDetail>
  )
}

function CustomScheduleEditor({
  rows,
  error,
  confirmReset,
  dirty,
  seeded,
  incomplete,
  onChange,
  onAdd,
  onSave,
  onCancel,
  onAskReset,
  onKeep,
  onReset,
}: {
  rows: LocalDraft[]
  error: string | null
  confirmReset: boolean
  dirty: boolean
  seeded: boolean
  incomplete: boolean
  onChange: (next: LocalDraft[]) => void
  onAdd: () => void
  onSave: () => void
  onCancel: () => void
  onAskReset: () => void
  onKeep: () => void
  onReset: () => void
}) {
  return (
    <div className="space-y-2">
      {seeded ? (
        <p className="text-xs text-muted-foreground">Starts from your preset times. Save to use this schedule.</p>
      ) : incomplete ? (
        <p className="text-xs text-muted-foreground">
          Add at least two times, then save. The preset schedule stays active until then.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Each theme lasts until the next time.</p>
      )}
      {[...rows]
        .sort((a, b) => (a.minutes ?? 24 * 60) - (b.minutes ?? 24 * 60))
        .map((row, index) => (
        <div key={row.id} className="flex items-center gap-2">
          <input
            type="time"
            className="h-10 rounded-lg border border-border bg-card px-2 text-sm text-foreground"
            aria-label={`Change ${index + 1} time`}
            value={clockValue(row.minutes)}
            onChange={(event) => {
              onChange(rows.map((item) => (item.id === row.id ? { ...item, minutes: minutesFromClock(event.target.value) } : item)))
            }}
          />
          <select
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-sm text-foreground"
            aria-label={`Change ${index + 1} theme`}
            value={row.theme}
            onChange={(event) => {
              onChange(rows.map((item) => (item.id === row.id ? { ...item, theme: event.target.value as ThemeFamily } : item)))
            }}
          >
            {THEME_CHOICES.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove change ${index + 1}`}
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
          >
            Remove
          </Button>
        </div>
      ))}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {confirmReset ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Replace these times with the preset schedule?</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onReset}>
              Replace
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onKeep}>
              Keep editing
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            Add theme change
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onAskReset}>
            Reset to preset
          </Button>
        </div>
      )}
      {dirty || seeded ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onSave}>
            Save changes
          </Button>
          {dirty ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SeasonalRotation({
  hemisphere,
  seasons,
  confirmReset,
  onHemisphere,
  onAssign,
  onAskReset,
  onKeep,
  onReset,
}: {
  hemisphere: Hemisphere
  seasons: SeasonAssignments
  confirmReset: boolean
  onHemisphere: (next: Hemisphere) => void
  onAssign: (slot: Season, family: ThemeFamily) => void
  onAskReset: () => void
  onKeep: () => void
  onReset: () => void
}) {
  const ranges = seasonRanges(hemisphere)
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Hemisphere</p>
        <p className="mt-1 text-xs text-muted-foreground">Uses this calendar. Location is not used.</p>
        <div className="mt-2">
          <Segmented options={HEMISPHERE_OPTIONS} value={hemisphere} onChange={onHemisphere} full />
        </div>
      </div>
      <div className="space-y-2">
        {SEASONS.map((slot) => (
          <label key={slot} className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">{SEASON_LABELS[slot]}</span>
              <span className="block text-xs text-muted-foreground">{ranges[slot]}</span>
            </span>
            <select
              className="h-10 min-w-[7.5rem] rounded-lg border border-border bg-card px-2 text-sm text-foreground"
              aria-label={`${SEASON_LABELS[slot]} theme`}
              value={seasons[slot]}
              onChange={(event) => onAssign(slot, event.target.value as ThemeFamily)}
            >
              {THEME_CHOICES.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {confirmReset ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Restore Spring, Summer, Autumn, and Winter?</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onReset}>
              Restore
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onKeep}>
              Keep
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="ghost" onClick={onAskReset}>
          Reset to seasonal defaults
        </Button>
      )}
    </div>
  )
}

function SwatchColor({ value }: { value: string | undefined }) {
  return (
    <span
      className="h-full flex-1 shadow-[inset_-1px_0_0_hsl(var(--foreground)/0.28)] last:shadow-none"
      style={{ background: value ? `hsl(${value})` : undefined }}
    />
  )
}
