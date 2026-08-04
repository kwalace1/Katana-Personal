import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { stashInviteReturn } from '@/lib/invite-return'
import { findUidByFriendCode, getCloudProfile, requestFriend } from '@/lib/social/friends'

export default function FriendInvitePage() {
  const { code } = useParams<{ code: string }>()
  const location = useLocation()
  const { user, loading: localLoading } = useAuth()
  const { cloudUser, cloudLoading, cloudEnabled } = useCloudAuth()
  const navigate = useNavigate()
  const [name, setName] = useState<string | null>(null)
  const [targetUid, setTargetUid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    stashInviteReturn(location.pathname)
  }, [location.pathname])

  useEffect(() => {
    if (!code || !cloudEnabled || !cloudUser) return
    void (async () => {
      try {
        const uid = await findUidByFriendCode(code)
        if (!uid) {
          setError('That invite code isn’t valid.')
          return
        }
        if (uid === cloudUser.uid) {
          setError('That’s your own code.')
          return
        }
        setTargetUid(uid)
        const profile = await getCloudProfile(uid)
        setName(profile?.displayName || 'Someone')
      } catch {
        setError('Couldn’t open that invite.')
      }
    })()
  }, [code, cloudEnabled, cloudUser])

  async function onAdd() {
    if (!cloudUser || !targetUid) return
    setBusy(true)
    try {
      await requestFriend(cloudUser.uid, targetUid)
      toast.success('Friend request sent')
      navigate('/friends')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t send request')
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
        <h1 className="font-display mt-8 text-2xl tracking-tight">Add me on Katana</h1>
        {!cloudEnabled ? (
          <p className="mt-3 text-sm text-muted-foreground">Cloud isn’t configured on this install.</p>
        ) : !user ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Open your space, sign in to Cloud, and we’ll bring you right back here.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/?mode=signin">Open & sign in</Link>
            </Button>
          </>
        ) : !cloudUser ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Sign in to Cloud — we’ll return you to this invite when you’re done.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/settings?cloud=1">Sign in to Cloud</Link>
            </Button>
          </>
        ) : error ? (
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
        ) : name ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              Send a friend request to <span className="font-medium text-foreground">{name}</span>?
            </p>
            <p className="mt-1 text-xs tracking-widest text-muted-foreground">{code?.toUpperCase()}</p>
            <Button className="mt-6 w-full" disabled={busy} onClick={() => void onAdd()}>
              {busy ? 'Sending…' : 'Add friend'}
            </Button>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Loading invite…</p>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/friends" className="underline-offset-4 hover:underline">
            Back to Friends
          </Link>
        </p>
      </div>
    </div>
  )
}
