import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { HueWheel } from '@/components/HueWheel'
import { usePlusStatus } from '@/components/PlusPaywall'
import {
  FREE_LLM_ASKS_PER_DAY,
  freeLlmAsksRemaining,
  setPlusUnlocked,
} from '@/lib/plus'
import { SimpleThemeToggle } from '@/components/SimpleThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import {
  DEFAULT_ACCENT_HUE,
  normalizeHue,
  resolveAccentHue,
  syncAccentToDocument,
  writeStoredAccentHue,
} from '@/lib/accent'
import { downloadBackup, parseBackup, restoreBackup, shareOrDownloadBackup } from '@/lib/backup'
import { takeInviteReturn } from '@/lib/invite-return'
import { mapCloudAuthError } from '@/lib/auth-callback'
import { ensureUserLoaded, localDb } from '@/lib/local-db'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { cn } from '@/lib/utils'
import {
  ASK_PERSONALITIES,
  parseAskPersonality,
} from '@/modules/assistant/personality'
import { remindersEnabled, requestReminderPermission } from '@/lib/reminders'
import { seedDemoWorkspace } from '@/lib/seed-demo'
import { DEFAULT_SHARE_PREFS, type SharePrefs } from '@/lib/social/types'
import { getAddMeUrl } from '@/lib/social/friends'
import { copyToClipboard } from '@/lib/clipboard'
import {
  mergeWorkspaceBothWays,
  pullWorkspaceFromCloud,
  subscribeWorkspaceSyncStatus,
  syncWorkspaceNow,
} from '@/lib/workspace-sync'
import { broadcastLocalRefresh } from '@/hooks/useLocalRefresh'

const SHARE_TOGGLES: { key: keyof SharePrefs; label: string; hint: string }[] = [
  { key: 'activityFeed', label: 'Activity pings', hint: 'Check-ins & shares show on Circles timelines' },
  { key: 'feedCards', label: 'Feed cards', hint: 'Share win cards to Feed after lifts, streaks, and goals — and attach them when you post' },
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

export default function SettingsPage() {
  const { user, profile, updateDisplayName, updatePreferences, resetOnboarding } = useAuth()
  const {
    cloudEnabled,
    appleSignInAvailable,
    cloudUser,
    cloudProfile,
    signUpCloud,
    signInCloud,
    signInWithApple,
    signOutCloud,
    saveDisplayName,
    saveSharePrefs,
    syncStreaksToCloud,
    enablePushNotifications,
  } = useCloudAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const cloudSectionRef = useRef<HTMLElement>(null)
  const plusSectionRef = useRef<HTMLElement>(null)
  const askCoachSectionRef = useRef<HTMLElement>(null)
  const plus = usePlusStatus()
  const llmLeft = plus ? null : freeLlmAsksRemaining()
  const [name, setName] = useState(profile?.display_name || '')
  const [busy, setBusy] = useState(false)
  const gentle = remindersEnabled(profile?.preferences)
  const askPersonality = parseAskPersonality(profile?.preferences)

  const [cloudMode, setCloudMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cloudName, setCloudName] = useState('')
  const [prefs, setPrefs] = useState<SharePrefs>(DEFAULT_SHARE_PREFS)
  const [syncAt, setSyncAt] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [accentHue, setAccentHue] = useState(
    () => resolveAccentHue(profile?.preferences) ?? DEFAULT_ACCENT_HUE,
  )

  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name)
  }, [profile?.display_name])

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

  useEffect(() => {
    if (searchParams.get('cloud') === '1') {
      setCloudMode('signin')
      window.setTimeout(() => cloudSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
    if (window.location.hash === '#plus') {
      window.setTimeout(() => plusSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
    if (window.location.hash === '#cloud') {
      window.setTimeout(() => cloudSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
    if (window.location.hash === '#ask-coach') {
      window.setTimeout(() => askCoachSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [searchParams])

  useEffect(() => {
    if (cloudProfile?.sharePrefs) setPrefs({ ...DEFAULT_SHARE_PREFS, ...cloudProfile.sharePrefs })
  }, [cloudProfile])

  useEffect(() => {
    return subscribeWorkspaceSyncStatus((s) => {
      setSyncAt(s.lastSyncedAt)
      setSyncBusy(s.busy)
      setSyncError(s.error)
    })
  }, [])

  async function onSaveName(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveDisplayName(name)
      toast.success(cloudUser ? 'Name saved everywhere' : 'Saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save name')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveCopy() {
    if (!profile) return
    await localDb.flush()
    try {
      const mode = await shareOrDownloadBackup(profile)
      toast.success(mode === 'shared' ? 'Shared — open on your other device' : 'Copy saved')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      downloadBackup(profile)
      toast.success('Copy saved')
    }
  }

  async function onBringBack(file: File | null) {
    if (!file || !profile) return
    setBusy(true)
    try {
      const text = await file.text()
      const backup = parseBackup(text)
      await ensureUserLoaded(profile.id)
      restoreBackup(profile.id, backup)
      await localDb.flush()
      if (backup.profile.display_name) {
        updateDisplayName(backup.profile.display_name)
        setName(backup.profile.display_name)
      }
      toast.success('Everything’s back')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t bring that copy back')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onToggleReminders(next: boolean) {
    if (next) {
      const ok = await requestReminderPermission()
      if (!ok) {
        toast.message('Reminders need permission from your device')
        updatePreferences({ gentle_reminders: false })
        return
      }
      updatePreferences({ gentle_reminders: true })
      toast.success('Gentle reminders on')
      return
    }
    updatePreferences({ gentle_reminders: false })
    toast.message('Reminders off')
  }

  async function onCloudAuth(e: FormEvent) {
    e.preventDefault()
    const emailTrim = email.trim().toLowerCase()
    if (!emailTrim || !password) {
      toast.error('Enter email and password')
      return
    }
    if (!emailTrim.includes('@') || !emailTrim.includes('.')) {
      toast.error('Use your full email, like you@gmail.com')
      return
    }
    setBusy(true)
    try {
      if (cloudMode === 'signup') {
        const alreadyBound = Boolean(profile?.bound_cloud_uid)
        const signupName =
          cloudName.trim() || (!alreadyBound ? name || profile?.display_name || 'Friend' : '')
        if (!signupName) {
          toast.error('Enter a name for this new account')
          setBusy(false)
          return
        }
        const { needsEmailConfirmation } = await signUpCloud(emailTrim, password, signupName)
        if (needsEmailConfirmation) {
          toast.success('Check your email', {
            description: 'Open the confirmation link to finish this Cloud account.',
            duration: 8000,
          })
        } else {
          toast.success('Cloud account created')
        }
      } else {
        await signInCloud(emailTrim, password)
        toast.success('Signed in')
      }
      setPassword('')
      const back = takeInviteReturn()
      if (back) navigate(back)
    } catch (err) {
      toast.error(mapCloudAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page max-w-2xl">
      <PageHeader title="Settings" description="A few simple preferences for your space." eyebrow="You" />

      <form onSubmit={(e) => void onSaveName(e)} className="kp-surface mb-4 space-y-3 p-5">
        <Label htmlFor="display-name">Your name</Label>
        <div className="flex gap-2">
          <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={busy}>
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This is how friends see you
          {cloudUser ? ' in Cloud, Circles, and invites.' : '.'}
        </p>
      </form>

      <section className="kp-surface mb-4 space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Appearance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick any accent from the full color wheel. Light and dark mode stay the same.
          </p>
        </div>
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
      </section>

      <section
        ref={askCoachSectionRef}
        id="ask-coach"
        className="kp-surface mb-4 scroll-mt-24 space-y-4 p-5"
      >
        <div>
          <h2 className="font-semibold">Ask coach voice</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How Katana talks to you in Ask — set it once, change it anytime.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ASK_PERSONALITIES.map((p) => {
            const on = askPersonality === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  updatePreferences({ ask_personality: p.id })
                  toast.message(`${p.label} voice on`)
                }}
                className={cn(
                  'rounded-2xl border px-4 py-3 text-left transition',
                  on
                    ? 'border-primary/40 bg-primary/[0.08]'
                    : 'border-border/50 bg-card/40 hover:bg-secondary/50',
                )}
              >
                <p className={cn('text-sm font-semibold', on && 'text-primary')}>{p.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.blurb}</p>
              </button>
            )
          })}
        </div>
      </section>

      <section ref={plusSectionRef} id="plus" className="kp-surface mb-4 scroll-mt-24 space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Katana Plus · Accountability pack</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Free is the full private day loop with friends. Plus is the pack that makes accountability
            feel alive — not a paywall on random AI.
          </p>
        </div>
        {plus ? (
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
            <p className="text-sm font-medium text-primary">Accountability pack is on</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Deeper Ask coach · Circle challenges · meal & label AI. Store billing comes next.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                setPlusUnlocked(false)
                toast.message('Back to Free')
              }}
            >
              Turn off demo Plus
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Free:</span> private day loop, Ask
                actions, Friends, Social, Circles boards, day / win cards you choose to share
              </li>
              <li>
                <span className="font-medium text-foreground">Plus:</span> deeper Ask coach (beyond{' '}
                {FREE_LLM_ASKS_PER_DAY}/day), Circle challenges, meal & label AI
              </li>
            </ul>
            {llmLeft != null ? (
              <p className="text-xs text-muted-foreground">
                Deeper Ask left today: {llmLeft}/{FREE_LLM_ASKS_PER_DAY}
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => {
                setPlusUnlocked(true)
                toast.success('Accountability pack unlocked')
              }}
            >
              Unlock Accountability pack
            </Button>
                <p className="text-xs text-muted-foreground">
                  Unlock on this device. Store billing comes later.
                </p>
          </div>
        )}
      </section>

      <section ref={cloudSectionRef} id="cloud" className="kp-surface mb-4 scroll-mt-24 space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Together (optional)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Friends, Plans, and Circles — only what you choose to share leaves this device.
            Everything else stays private here.
          </p>
        </div>
        {!cloudEnabled ? (
          <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
            Add Supabase keys to <code className="text-xs">.env</code> — see{' '}
            <code className="text-xs">SUPABASE_SETUP.md</code> (≈3 minutes).
          </p>
        ) : cloudUser && cloudProfile ? (
          <div className="space-y-3">
            <p className="text-sm">
              Signed in as{' '}
              <span className="font-medium">{cloudProfile.displayName}</span>
              {cloudProfile.email ? (
                <span className="text-muted-foreground"> ({cloudProfile.email})</span>
              ) : null}
            </p>
            <div className="rounded-2xl bg-primary/10 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Share your code</p>
              <p className="font-display mt-1 text-2xl tracking-widest">{cloudProfile.friendCode}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const url = getAddMeUrl(cloudProfile.friendCode)
                    const ok = await copyToClipboard(url)
                    if (ok) toast.success('Add-me link copied')
                    else toast.error('Couldn’t copy link — check browser permissions')
                  }}
                >
                  Copy add-me link
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href="/social?tab=friends">Open Friends</a>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await syncStreaksToCloud()
                    toast.success('Streaks synced to Circles')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Sync failed')
                  }
                }}
              >
                Sync streaks now
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const ok = await enablePushNotifications()
                    if (ok) toast.success('Browser notifications on')
                    else toast.message('Permission wasn’t granted')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Couldn’t enable notifications')
                  }
                }}
              >
                Enable browser notifications
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await signOutCloud()
                  toast.message('Cloud signed out')
                }}
              >
                Sign out of cloud
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {appleSignInAvailable ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      await signInWithApple()
                      toast.success('Signed in with Apple')
                      const back = takeInviteReturn()
                      if (back) navigate(back)
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Apple sign-in failed')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Continue with Apple
                </Button>
                <p className="text-center text-xs text-muted-foreground">or use email</p>
              </>
            ) : null}
            <form noValidate onSubmit={(e) => void onCloudAuth(e)} className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={cloudMode === 'signup' ? 'default' : 'outline'}
                  onClick={() => setCloudMode('signup')}
                >
                  Create account
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cloudMode === 'signin' ? 'default' : 'outline'}
                  onClick={() => setCloudMode('signin')}
                >
                  Sign in
                </Button>
              </div>
              {cloudMode === 'signup' ? (
                <Input
                  name="cloud-name"
                  type="text"
                  autoComplete="name"
                  autoCapitalize="words"
                  placeholder="Name for this account"
                  value={cloudName}
                  onChange={(e) => setCloudName(e.target.value)}
                />
              ) : null}
              <Input
                name="email"
                type="text"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                name="password"
                type="password"
                autoComplete={cloudMode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="Password (6+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Working…' : cloudMode === 'signup' ? 'Create free account' : 'Sign in'}
              </Button>
              {cloudMode === 'signup' ? (
                <p className="text-center text-xs text-muted-foreground">
                  You’ll get a confirmation email. Open that link to finish Cloud.
                </p>
              ) : null}
            </form>
          </div>
        )}
      </section>

      {cloudUser ? (
        <section className="kp-surface mb-4 space-y-3 p-5">
          <h2 className="font-semibold">Cloud sync</h2>
          <p className="text-sm text-muted-foreground">
            When you’re signed in, tasks, habits, water, calendar, and the rest of your personal space
            sync across phone and computer. Circles stay separate under Together sharing.
          </p>
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
                  .catch((err) =>
                    toast.error(err instanceof Error ? err.message : 'Sync failed'),
                  )
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
                  .catch((err) =>
                    toast.error(err instanceof Error ? err.message : 'Merge failed'),
                  )
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
                  .catch((err) =>
                    toast.error(err instanceof Error ? err.message : 'Download failed'),
                  )
              }}
            >
              Use cloud copy
            </Button>
          </div>
        </section>
      ) : null}

      {cloudUser ? (
        <section className="kp-surface mb-4 space-y-4 p-5">
          <div>
            <h2 className="font-semibold">What friends can see</h2>
            <p className="mt-1 text-sm text-muted-foreground">Everything off by default. Flip on what you’re OK sharing.</p>
          </div>
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
        </section>
      ) : null}

      <section className="kp-surface mb-4 space-y-3 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Gentle reminders</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Soft nudges for habits and events while Katana is open in this tab — not background push
              when the app is closed.
            </p>
          </div>
          <Switch checked={gentle} onCheckedChange={(v) => void onToggleReminders(v)} />
        </div>
      </section>

      <section className="kp-surface mb-4 space-y-3 p-5">
        <h2 className="font-semibold">Install on your phone</h2>
        <p className="text-sm text-muted-foreground">
          On iPhone Safari: Share → <span className="font-medium text-foreground">Add to Home Screen</span>.
          On Android Chrome: menu → Install app. You’ll get an app-like feel; swipe from the left edge for navigation.
        </p>
        <p className="text-xs text-muted-foreground">
          Three calm layers: Home Screen for the feel, Cloud sync for devices when signed in, and a
          <code className="mx-1 rounded bg-secondary px-1 text-xs">.katana</code> copy as your safety net.
        </p>
      </section>

      <section id="device-copy" className="kp-surface mb-4 scroll-mt-24 space-y-3 p-5">
        <h2 className="font-semibold">Save a copy</h2>
        <p className="text-sm text-muted-foreground">
          Cloud sync keeps most life data across devices when you’re signed in. Still export a
          <code className="mx-1 rounded bg-secondary px-1 text-xs">.katana</code> file — especially before
          clearing a browser, or as a backup you can AirDrop.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>
            On the device that has your data, tap <span className="font-medium text-foreground">Save a copy</span>
            (on iPhone you can AirDrop or save to Files).
          </li>
          <li>Open Katana on the other device (same Home Screen app or browser).</li>
          <li>
            Tap <span className="font-medium text-foreground">Bring a copy back</span> and pick the
            <code className="mx-1 rounded bg-secondary px-1 text-xs">.katana</code> file.
          </li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={() => void onSaveCopy()}>
            Save a copy
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".katana,application/octet-stream,*/*"
            className="hidden"
            onChange={(e) => void onBringBack(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Bringing it back…' : 'Bring a copy back'}
          </Button>
        </div>
      </section>

      <section className="kp-surface mb-4 space-y-3 p-5">
        <h2 className="font-semibold">Demo data</h2>
        <p className="text-sm text-muted-foreground">
          Fill an empty workspace with sample tasks, habits, and a focus block — useful for demos.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            if (!user) return
            const result = seedDemoWorkspace(user.id)
            if (result.seeded) toast.success('Demo day loaded — open Today')
            else if (result.reason === 'already') toast.message('Demo data was already added')
            else toast.message('Workspace isn’t empty — clear tasks first or use a fresh start')
          }}
        >
          Load demo day
        </Button>
      </section>

      <section className="kp-surface space-y-3 p-5">
        <h2 className="font-semibold">Tips</h2>
        <p className="text-sm text-muted-foreground">Show the little getting-started checklist on Today again.</p>
        <Button
          variant="outline"
          onClick={() => {
            resetOnboarding()
            toast.message('Tips are back on Today')
          }}
        >
          Show tips again
        </Button>
      </section>
    </motion.div>
  )
}
