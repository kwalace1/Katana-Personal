import { FormEvent, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { parseBackup, restoreBackup } from '@/lib/backup'
import { createId } from '@/lib/id'
import { ensureUserLoaded, localDb } from '@/lib/local-db'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { cn } from '@/lib/utils'

type Mode = 'open' | 'signin' | 'signup'

function isStandaloneApp() {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const ios = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || ios
}

/**
 * App entrance — used for `/` (including PWA home screen).
 * Not a marketing site: open a local space or sign into Cloud.
 */
export default function LandingPage() {
  const { user, loading, startWorkspace } = useAuth()
  const {
    cloudEnabled,
    cloudUser,
    signInCloud,
    signUpCloud,
    signInWithApple,
  } = useCloudAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>('open')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setStandalone(isStandaloneApp())
  }, [])

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  async function ensureLocalThen(run: () => Promise<void>, displayName?: string) {
    if (!user) {
      await startWorkspace(displayName || name || 'You')
    }
    await run()
  }

  async function onOpenLocal(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await startWorkspace(name.trim() || 'You')
      toast.success('Welcome in')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t open')
    } finally {
      setBusy(false)
    }
  }

  async function onCloudSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cloudEnabled) {
      toast.error('Cloud isn’t configured on this build')
      return
    }
    if (!email.trim() || !password) {
      toast.error('Enter email and password')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const display = name.trim()
        if (!display) {
          toast.error('Enter the name friends should see')
          setBusy(false)
          return
        }
        await startWorkspace(display)
        await signUpCloud(email, password, display)
        toast.success('Account created — you’re in')
      } else {
        // Don’t invent a name from the email — use Cloud profile after sign-in
        await startWorkspace(name.trim() || 'You')
        await signInCloud(email, password)
        toast.success('Signed in')
      }
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t sign in')
    } finally {
      setBusy(false)
    }
  }

  async function onApple() {
    if (!cloudEnabled) {
      toast.error('Cloud isn’t configured on this build')
      return
    }
    setBusy(true)
    try {
      await ensureLocalThen(async () => {
        await signInWithApple()
      }, name.trim() || 'You')
      toast.success('Signed in with Apple')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Apple sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  async function onBringBack(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      const backup = parseBackup(text)
      const workspaceId = createId()
      await ensureUserLoaded(workspaceId)
      restoreBackup(workspaceId, backup)
      await localDb.flush()
      await startWorkspace(backup.profile.display_name || name || 'You', {
        id: workspaceId,
        preferences: backup.profile.preferences || {},
      })
      toast.success('Welcome back')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t bring that copy back')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // silence unused — cloud session is handled after navigate via WorkspaceSyncHost
  void cloudUser

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-[hsl(168_45%_70%/0.3)] blur-3xl" />
        <div className="absolute bottom-10 right-0 h-64 w-64 rounded-full bg-[hsl(200_50%_80%/0.25)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between py-2">
          <BrandMark to="/" />
          {!standalone ? (
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Personal
            </p>
          ) : null}
        </header>

        <motion.div {...pageEnterSubtle} className="flex flex-1 flex-col justify-center py-8">
          <p className="kp-section-label">Welcome</p>
          <h1 className="font-display mt-2 text-4xl tracking-tight sm:text-5xl">Katana</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {standalone
              ? 'Open your space on this phone — or sign in to sync with your computer.'
              : 'Your personal OS. Open a private space, or sign in to sync across devices.'}
          </p>

          <div className="mt-8 flex gap-2 rounded-2xl bg-secondary/60 p-1">
            {(
              [
                ['open', 'Open'],
                ['signin', 'Sign in'],
                ['signup', 'Create'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'min-h-11 flex-1 rounded-xl text-sm font-semibold transition',
                  mode === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                )}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'open' ? (
            <form onSubmit={(e) => void onOpenLocal(e)} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">What should we call you?</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl"
                  autoFocus
                />
              </div>
              <Button type="submit" className="min-h-12 w-full" size="lg" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open Katana'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Stays on this device. Add Cloud later in Settings to sync.
              </p>
            </form>
          ) : (
            <form onSubmit={(e) => void onCloudSubmit(e)} className="mt-6 space-y-4">
              {mode === 'signup' ? (
                <div className="space-y-2">
                  <Label htmlFor="cloud-name">Name</Label>
                  <Input
                    id="cloud-name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
              <Button type="submit" className="min-h-12 w-full" size="lg" disabled={busy || !cloudEnabled}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === 'signup' ? (
                  'Create account & open'
                ) : (
                  'Sign in & open'
                )}
              </Button>
              {cloudEnabled ? (
                <>
                  <p className="text-center text-xs text-muted-foreground">or</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 w-full"
                    disabled={busy}
                    onClick={() => void onApple()}
                  >
                    Continue with Apple
                  </Button>
                </>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Cloud sign-in isn’t available in this build.
                </p>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Signs you into Friends, Circles, and cloud sync for this device.
              </p>
            </form>
          )}

          <div className="mt-8 border-t border-border/50 pt-6">
            <p className="mb-3 text-xs text-muted-foreground">Have a backup file?</p>
            <input
              ref={fileRef}
              type="file"
              accept=".katana,application/octet-stream,*/*"
              className="hidden"
              onChange={(e) => void onBringBack(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? 'Bringing it back…' : 'Bring a copy back'}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
