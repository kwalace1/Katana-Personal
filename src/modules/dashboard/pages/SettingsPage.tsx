import { FormEvent, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { downloadBackup, parseBackup, restoreBackup } from '@/lib/backup'
import { ensureUserLoaded, localDb } from '@/lib/local-db'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { remindersEnabled, requestReminderPermission } from '@/lib/reminders'
import { DEFAULT_SHARE_PREFS, type SharePrefs } from '@/lib/social/types'

const SHARE_TOGGLES: { key: keyof SharePrefs; label: string; hint: string }[] = [
  { key: 'healthWater', label: 'Hydration streaks', hint: 'Glasses & water streaks on Circles' },
  { key: 'healthSleep', label: 'Sleep streaks', hint: 'Sleep days on Circles' },
  { key: 'healthNutrition', label: 'Nutrition streaks', hint: 'Logged meals streak' },
  { key: 'healthWorkouts', label: 'Workout streaks', hint: 'Movement days' },
  { key: 'habits', label: 'Habit streaks', hint: 'Best habit streak' },
  { key: 'goals', label: 'Goals progress', hint: 'Let friends see goal momentum' },
  { key: 'journalMood', label: 'Journal mood', hint: 'Mood only — never full entries' },
  { key: 'notes', label: 'Notes', hint: 'Allow sharing notes with friends' },
  { key: 'files', label: 'Files', hint: 'Allow sharing files with friends' },
  { key: 'activityFeed', label: 'Activity pings', hint: '“Shared a task” style updates' },
]

export default function SettingsPage() {
  const { profile, updateDisplayName, updatePreferences, resetOnboarding } = useAuth()
  const {
    cloudEnabled,
    cloudUser,
    cloudProfile,
    signUpCloud,
    signInCloud,
    signInWithApple,
    signOutCloud,
    saveSharePrefs,
    syncStreaksToCloud,
    enablePushNotifications,
  } = useCloudAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile?.display_name || '')
  const [busy, setBusy] = useState(false)
  const gentle = remindersEnabled(profile?.preferences)

  const [cloudMode, setCloudMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [prefs, setPrefs] = useState<SharePrefs>(DEFAULT_SHARE_PREFS)

  useEffect(() => {
    if (cloudProfile?.sharePrefs) setPrefs({ ...DEFAULT_SHARE_PREFS, ...cloudProfile.sharePrefs })
  }, [cloudProfile])

  function onSaveName(e: FormEvent) {
    e.preventDefault()
    updateDisplayName(name)
    toast.success('Saved')
  }

  async function onSaveCopy() {
    if (!profile) return
    await localDb.flush()
    downloadBackup(profile)
    toast.success('Copy saved')
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
    setBusy(true)
    try {
      if (cloudMode === 'signup') {
        await signUpCloud(email, password, name || profile?.display_name || 'Friend')
        toast.success('Cloud account created')
      } else {
        await signInCloud(email, password)
        toast.success('Signed in')
      }
      setPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t connect')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page max-w-2xl">
      <PageHeader title="Settings" description="A few simple preferences for your space." eyebrow="You" />

      <form onSubmit={onSaveName} className="kp-surface mb-4 space-y-3 p-5">
        <Label htmlFor="display-name">Your name</Label>
        <div className="flex gap-2">
          <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit">Save</Button>
        </div>
      </form>

      <section className="kp-surface mb-4 space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Cloud account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Free Firebase-backed friends, sharing, and Circles. Private data stays on this device until you
            opt in.
          </p>
        </div>
        {!cloudEnabled ? (
          <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
            Add Firebase keys to <code className="text-xs">.env</code> — see{' '}
            <code className="text-xs">FIREBASE_SETUP.md</code> (≈3 minutes, free).
          </p>
        ) : cloudUser && cloudProfile ? (
          <div className="space-y-3">
            <p className="text-sm">
              Signed in as{' '}
              <span className="font-medium">{cloudProfile.email || cloudProfile.displayName}</span>
              <span className="text-muted-foreground"> · code {cloudProfile.friendCode}</span>
            </p>
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
            <form onSubmit={(e) => void onCloudAuth(e)} className="space-y-3">
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
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password (6+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Working…' : cloudMode === 'signup' ? 'Create free account' : 'Sign in'}
              </Button>
            </form>
          </div>
        )}
      </section>

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
              A soft nudge once a day when something still needs you.
            </p>
          </div>
          <Switch checked={gentle} onCheckedChange={(v) => void onToggleReminders(v)} />
        </div>
      </section>

      <section className="kp-surface mb-4 space-y-3 p-5">
        <h2 className="font-semibold">Keep a copy</h2>
        <p className="text-sm text-muted-foreground">
          Save everything on this device to a file you can put somewhere safe — or bring an old copy
          back if you need to.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void onSaveCopy()}>Save a copy</Button>
          <input
            ref={fileRef}
            type="file"
            accept=".katana,application/octet-stream,*/*"
            className="hidden"
            onChange={(e) => void onBringBack(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Bringing it back…' : 'Bring a copy back'}
          </Button>
        </div>
      </section>

      <section className="kp-surface mb-4 space-y-3 p-5">
        <h2 className="font-semibold">Shortcuts</h2>
        <p className="text-sm text-muted-foreground">
          Press <kbd className="rounded bg-secondary px-1.5 py-0.5 text-xs">⌘</kbd>
          <kbd className="rounded bg-secondary px-1.5 py-0.5 text-xs">K</kbd> (or Ctrl+K) to search
          everything, jump to a page, or create a task, note, or event.
        </p>
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
