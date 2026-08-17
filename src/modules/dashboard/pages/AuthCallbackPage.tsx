import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/BrandMark'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthCallbackParams } from '@/lib/auth-callback'
import { takeInviteReturn } from '@/lib/invite-return'
import { getSupabase, supabaseConfigured, toCloudUser } from '@/lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'

const WAIT_MS = 12_000
const STEP_MS = 200

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * Finishes Cloud sign-up / magic-link after the confirmation email.
 * Supabase lands here with ?code= (PKCE) or token_hash / hash tokens.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { loading, adoptCloudWorkspace } = useAuth()
  const [message, setMessage] = useState('Confirming your account…')
  const started = useRef(false)

  useEffect(() => {
    if (loading) return
    if (started.current) return
    started.current = true

    let cancelled = false

    async function finish() {
      const params = getAuthCallbackParams()
      if (params.error) {
        throw new Error(params.error.replace(/\+/g, ' '))
      }
      if (!supabaseConfigured) {
        throw new Error('Cloud isn’t configured on this build.')
      }

      const supabase = getSupabase()

      if (params.tokenHash) {
        const type = (params.type || 'signup') as EmailOtpType
        const { error } = await supabase.auth.verifyOtp({
          token_hash: params.tokenHash,
          type,
        })
        if (error) throw error
      }

      const deadline = Date.now() + WAIT_MS
      while (Date.now() < deadline) {
        if (cancelled) return
        const { data } = await supabase.auth.getSession()
        if (data.session?.user) {
          const cu = toCloudUser(data.session.user)
          await adoptCloudWorkspace(cu.uid, cu.displayName || 'You')
          toast.success('You’re in', { description: 'Cloud account confirmed.' })
          navigate(takeInviteReturn() || '/dashboard', { replace: true })
          return
        }
        await sleep(STEP_MS)
      }

      throw new Error(
        'That confirmation link didn’t finish signing you in. Open Katana and use Sign in with the same email and password.',
      )
    }

    void finish().catch((err) => {
      if (cancelled) return
      const text = err instanceof Error ? err.message : 'Couldn’t confirm that link'
      setMessage(text)
      toast.error(text)
      window.setTimeout(() => navigate('/?mode=signin', { replace: true }), 2800)
    })

    return () => {
      cancelled = true
    }
  }, [adoptCloudWorkspace, loading, navigate])

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <BrandMark to="/" />
      <Loader2 className="mt-10 h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 max-w-sm text-center text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
