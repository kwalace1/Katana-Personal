import { useState, useEffect } from 'react'
import { MotionPage } from '@/components/motion-page'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { getInviteByToken, getInviteByCode, completeInviteSignup } from '@/lib/tenant-context'
import { clearOrgCache, DEFAULT_POST_LOGIN_PATH } from '@/lib/auth-helpers'
import { supabase } from '@/lib/supabase'
import { Building2, Loader2, AlertCircle, Ticket } from 'lucide-react'

type InviteDetails = {
  id: string
  email: string
  organization_id: string
  organization_name: string
  role: string
}

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { signUpWithEmail, user, profile, refreshProfile } = useAuth()
  const token = searchParams.get('token')

  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(!!token?.trim())
  const [error, setError] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [codeSubmitting, setCodeSubmitting] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (invite?.id) {
      sessionStorage.setItem('katana_pending_invite_id', invite.id)
    }
  }, [invite?.id])

  useEffect(() => {
    if (!token?.trim()) {
      setLoading(false)
      return
    }
    getInviteByToken(token)
      .then((data) => {
        if (data) setInvite(data)
        else setError('This invite link is invalid or has expired.')
      })
      .catch(() => setError('Could not load invite.'))
      .finally(() => setLoading(false))
  }, [token])

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = codeInput.trim()
    if (!code) return
    setError(null)
    setCodeSubmitting(true)
    try {
      const data = await getInviteByCode(code)
      if (data) setInvite(data)
      else setError('Invalid or expired invite code. Check the code and try again.')
    } catch {
      setError('Could not look up invite.')
    } finally {
      setCodeSubmitting(false)
    }
  }

  useEffect(() => {
    if (user && profile && !loading && !submitting) {
      navigate(DEFAULT_POST_LOGIN_PATH, { replace: true })
    }
  }, [user, profile, loading, submitting, navigate])

  const waitForSession = async () => {
    for (let i = 0; i < 15; i++) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) return session
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invite?.email || !invite.id) return
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const { needsEmailConfirmation } = await signUpWithEmail(invite.email, password)

      if (needsEmailConfirmation) {
        setError(
          'Account created. Check your email to confirm your address, then sign in with your email and password.'
        )
        return
      }

      const session = await waitForSession()
      if (!session?.user) {
        setError('Account created but sign-in did not complete. Try signing in with your email and password.')
        return
      }

      clearOrgCache()
      await completeInviteSignup(invite.id)
      await refreshProfile(session.user.id)

      navigate(DEFAULT_POST_LOGIN_PATH, { replace: true })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not create account. Try again or use a different password.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <MotionPage subtle className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading invite…</p>
          </CardContent>
        </Card>
      </MotionPage>
    )
  }

  if (!invite && error && token) {
    return (
      <MotionPage subtle className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Invalid invite
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/')}>
              Go to home
            </Button>
          </CardContent>
        </Card>
      </MotionPage>
    )
  }

  if (!invite && !token) {
    return (
      <MotionPage subtle className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 rounded-full bg-primary/10">
                <Ticket className="h-10 w-10 text-primary" />
              </div>
            </div>
            <CardTitle>Have an invite?</CardTitle>
            <CardDescription>
              Enter the invite code you received from your admin to create your Katana account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-code">Invite code</Label>
                <Input
                  id="invite-code"
                  type="text"
                  placeholder="e.g. ABC12XY"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  className="font-mono text-lg tracking-widest uppercase"
                  maxLength={12}
                  autoComplete="off"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={codeSubmitting || !codeInput.trim()}>
                {codeSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking…
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground text-center mt-4">
              You can also open the invite link from your email if you have one.
            </p>
          </CardContent>
        </Card>
      </MotionPage>
    )
  }

  return (
    <MotionPage subtle className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 rounded-full bg-primary/10">
              <Building2 className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle>Create your Katana account</CardTitle>
          <CardDescription>
            You’ve been invited to join <strong>{invite?.organization_name}</strong>. Set a password to finish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={invite?.email ?? ''}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create my Katana account'
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-4">
            You’ll sign in with this email and password from now on (no Microsoft required).
          </p>
        </CardContent>
      </Card>
    </MotionPage>
  )
}