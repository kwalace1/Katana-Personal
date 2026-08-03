import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { acceptCircleInvite, getCircleInvite, type CircleInvite } from '@/lib/social/invites'

export default function InviteJoinPage() {
  const { token } = useParams<{ token: string }>()
  const { user, loading: localLoading } = useAuth()
  const { cloudUser, cloudLoading, cloudEnabled } = useCloudAuth()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<CircleInvite | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !cloudEnabled || !cloudUser) return
    void getCircleInvite(token)
      .then((inv) => {
        if (!inv) setError('That invite isn’t valid.')
        else setInvite(inv)
      })
      .catch(() => setError('Couldn’t open that invite.'))
  }, [token, cloudEnabled, cloudUser])

  async function onJoin() {
    if (!token || !cloudUser) return
    setBusy(true)
    try {
      await acceptCircleInvite(token, cloudUser.uid)
      toast.success('You’re in the circle')
      navigate('/circles')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t join')
    } finally {
      setBusy(false)
    }
  }

  if (localLoading || cloudLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="kp-surface w-full max-w-md p-8">
        <BrandMark to="/" />
        <h1 className="font-display mt-8 text-2xl tracking-tight">Circle invite</h1>
        {!cloudEnabled ? (
          <p className="mt-3 text-sm text-muted-foreground">Cloud isn’t configured on this install.</p>
        ) : !user ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Start your private workspace, then sign in to the cloud to join this circle.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/auth">Start your workspace</Link>
            </Button>
          </>
        ) : !cloudUser ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Sign in to your cloud account in Settings, then reopen this invite link.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/settings">Open Settings</Link>
            </Button>
          </>
        ) : error ? (
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
        ) : invite ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              You’ve been invited to join <span className="font-medium text-foreground">“{invite.circleName}”</span>.
            </p>
            <Button className="mt-6 w-full" disabled={busy} onClick={() => void onJoin()}>
              {busy ? 'Joining…' : 'Join circle'}
            </Button>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Loading invite…</p>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/circles" className="underline-offset-4 hover:underline">
            Back to Circles
          </Link>
        </p>
      </div>
    </div>
  )
}
