import { FormEvent, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2, Sparkles, Users, CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { parseBackup, restoreBackup } from '@/lib/backup'
import { createId } from '@/lib/id'
import { isAuthCallbackLocation, mapCloudAuthError } from '@/lib/auth-callback'
import { takeInviteReturn, peekInviteReturn } from '@/lib/invite-return'
import AuthCallbackPage from '@/modules/dashboard/pages/AuthCallbackPage'
import { SiteFooter } from '@/components/SiteFooter'
import { ensureUserLoaded, localDb } from '@/lib/local-db'
import { pageEnterSubtle, staggerContainer, staggerItem } from '@/lib/motion-ui'
import { TAGLINE } from '@/lib/brand'
import { cn } from '@/lib/utils'

type Mode = 'open' | 'signin' | 'signup'

function isStandaloneApp() {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const ios = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || ios
}

const STORY = [
  {
    icon: CalendarCheck,
    title: 'Today',
    body: 'Decide one next step. Capture what matters. Close the day — that’s the loop.',
  },
  {
    icon: Sparkles,
    title: 'Ask',
    body: 'A day guide that already knows your plate — and can draft small actions for you.',
  },
  {
    icon: Users,
    title: 'Together',
    body: 'Optional accountability with friends and Circles. Private life stays on this device.',
  },
] as const

/**
 * App entrance — `/` including PWA home screen.
 * Browser: brand-first hero + short story + open / cloud forms.
 * Standalone: lean entrance only.
 */
export default function LandingPage() {
  const { user, loading, startWorkspace, markOnboardingDone } = useAuth()
  const {
    cloudEnabled,
    appleSignInAvailable,
    cloudUser,
    signInCloud,
    signUpCloud,
    signInWithApple,
  } = useCloudAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>('open')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setStandalone(isStandaloneApp())
  }, [])

  useEffect(() => {
    const m = searchParams.get('mode')
    if (m === 'signin' || m === 'signup' || m === 'open') setMode(m)
  }, [searchParams])

  function goAfterEntrance() {
    navigate(takeInviteReturn() || '/dashboard')
  }

  // Confirmation / magic-link returns must not bounce to dashboard before the
  // session is exchanged — that was dropping the code and looking like "just the website".
  if (isAuthCallbackLocation(location.search, location.hash)) {
    return <AuthCallbackPage />
  }

  if (!loading && user && !busy) {
    const back = peekInviteReturn()
    return <Navigate to={back || '/dashboard'} replace />
  }

  async function ensureLocalThen(run: () => Promise<void>, displayName?: string) {
    if (!user) {
      await startWorkspace(displayName || name || 'You')
    }
    await run()
  }

  async function onOpenLocal(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast.message('Add your name to start')
      nameInputRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      await startWorkspace(trimmed)
      toast.success('Welcome in')
      goAfterEntrance()
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
      if (mode === 'signup') {
        const display = name.trim()
        if (!display) {
          toast.error('Enter the name friends should see')
          setBusy(false)
          return
        }
        const { needsEmailConfirmation } = await signUpCloud(emailTrim, password, display)
        if (needsEmailConfirmation && !user) {
          await startWorkspace(display)
        }
        if (needsEmailConfirmation) {
          toast.success('Check your email', {
            description:
              'Open the confirmation link to finish Cloud. Your space is ready on this device. If you don’t see it in your inbox, check your spam.',
            duration: 8000,
          })
        } else {
          toast.success('Account created — you’re in')
        }
      } else {
        await signInCloud(emailTrim, password)
        // Returning accounts already know the loop — never trap them in First Minute.
        markOnboardingDone()
        toast.success('Signed in')
      }
      goAfterEntrance()
    } catch (err) {
      toast.error(mapCloudAuthError(err))
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
      goAfterEntrance()
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
      markOnboardingDone()
      toast.success('Welcome back')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t bring that copy back')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  void cloudUser

  function scrollToOpen() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMode('open')
    window.setTimeout(() => nameInputRef.current?.focus(), 400)
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(168_45%_70%/0.45),transparent_55%)]" />
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-[hsl(168_45%_70%/0.28)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-[hsl(200_50%_80%/0.28)] blur-3xl" />
        {!standalone ? (
          <div
            className="absolute inset-x-0 top-0 h-[70vh] opacity-[0.12]"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%232F6F68\' fill-opacity=\'0.35\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            }}
          />
        ) : null}
      </div>

      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between py-2">
          <BrandMark to="/" />
          {!standalone ? (
            <button
              type="button"
              className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary"
              onClick={scrollToOpen}
            >
              Open
            </button>
          ) : (
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Personal
            </p>
          )}
        </header>

        <motion.div {...pageEnterSubtle} className="flex flex-1 flex-col py-6 sm:py-10">
          {/* Hero — brand first */}
          <div className={cn('flex flex-col', standalone ? 'justify-center flex-1' : 'min-h-0 sm:min-h-[58vh] justify-center py-4')}>
            <h1 className="font-display text-5xl tracking-tight sm:text-6xl">Katana</h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              {standalone
                ? 'Your day, on this phone.'
                : TAGLINE}
            </p>

            {!standalone ? (
              <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button size="lg" className="min-h-12 px-6" onClick={scrollToOpen}>
                  Open your space
                </Button>
                <button
                  type="button"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setMode('signup')
                    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  Create with Cloud
                </button>
              </div>
            ) : null}
          </div>

          {/* Story — browser only, below first viewport */}
          {!standalone ? (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-40px' }}
              className="mb-12 mt-4 space-y-4 border-t border-border/40 pt-10"
            >
              <p className="kp-section-label">The loop</p>
              {STORY.map((item) => {
                const Icon = item.icon
                return (
                  <motion.div
                    key={item.title}
                    variants={staggerItem}
                    className="flex gap-4 rounded-2xl bg-card/50 px-4 py-4 backdrop-blur-sm"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-display text-lg tracking-tight">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          ) : null}

          {/* Entrance forms */}
          <div ref={formRef} id="open" className={cn('scroll-mt-6', !standalone && 'border-t border-border/40 pt-8')}>
            {!standalone ? (
              <p className="mb-4 font-display text-2xl tracking-tight">Open Katana</p>
            ) : null}

            <div className="flex gap-2 rounded-2xl bg-secondary/60 p-1">
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
                  ref={nameInputRef}
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-xl"
                  autoFocus={standalone}
                />
                </div>
                <Button type="submit" className="min-h-12 w-full" size="lg" disabled={busy || !name.trim()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open Katana'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Stays on this device. Add Cloud later in Settings to sync.
                </p>
              </form>
            ) : (
              <form
                noValidate
                onSubmit={(e) => void onCloudSubmit(e)}
                className="mt-6 space-y-4"
              >
                {mode === 'signup' ? (
                  <div className="space-y-2">
                    <Label htmlFor="cloud-name">Name</Label>
                    <Input
                      id="cloud-name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 rounded-xl"
                      autoCapitalize="words"
                      autoCorrect="off"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
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
                    name="password"
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
                {cloudEnabled && appleSignInAvailable ? (
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
                ) : !cloudEnabled ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Cloud sign-in isn’t available in this build.
                  </p>
                ) : null}
                <p className="text-center text-xs text-muted-foreground">
                  {mode === 'signup'
                    ? 'We’ll email a confirmation link. Open it to finish Cloud — Friends, Circles, and sync. If you don’t see it in your inbox, check your spam.'
                    : 'Signs you into Friends, Circles, and cloud sync for this device.'}
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
            <SiteFooter className="mt-10" />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
