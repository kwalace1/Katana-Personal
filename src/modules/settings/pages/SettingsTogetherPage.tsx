import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { mapCloudAuthError } from '@/lib/auth-callback'
import { takeInviteReturn } from '@/lib/invite-return'
import { getAddMeUrl } from '@/lib/social/friends'
import { copyToClipboard } from '@/lib/clipboard'
import { SettingsDetail, SettingsPanel } from '../components/settings-ui'

export function SettingsTogetherPage() {
  const navigate = useNavigate()
  const {
    cloudEnabled,
    appleSignInAvailable,
    cloudUser,
    cloudProfile,
    signUpCloud,
    signInCloud,
    signInWithApple,
    signOutCloud,
    syncStreaksToCloud,
    enablePushNotifications,
  } = useCloudAuth()

  const [cloudMode, setCloudMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cloudName, setCloudName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (window.location.search.includes('cloud=1')) {
      setCloudMode('signin')
    }
  }, [])

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
        const signupName = cloudName.trim() || 'Friend'
        const { needsEmailConfirmation } = await signUpCloud(emailTrim, password, signupName)
        if (needsEmailConfirmation) {
          toast.success('Check your email', {
            description:
              'Open the confirmation link to finish this Cloud account. If you don’t see it in your inbox, check your spam.',
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
    <SettingsDetail
      title="Together"
      description="Friends, Plans, and Circles — only what you choose to share leaves this device."
    >
      <SettingsPanel>
        {!cloudEnabled ? (
          <p className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
            Together isn’t available in this build. Friends, Circles, and cloud sync will show up here when
            they’re turned on.
          </p>
        ) : cloudUser && cloudProfile ? (
          <div className="space-y-3">
            <p className="text-sm">
              Signed in as <span className="font-medium">{cloudProfile.displayName}</span>
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
                  You’ll get a confirmation email. Open that link to finish Cloud. If you don’t see it in your inbox, check your spam.
                </p>
              ) : null}
            </form>
          </div>
        )}
      </SettingsPanel>
    </SettingsDetail>
  )
}
