/**
 * Bridge between Katana's Supabase auth and the Agent Office API layer.
 *
 * The office (SwarmClaw on Fly.io) receives the signed-in user's Supabase JWT
 * as X-Katana-Jwt / X-Katana-Org on every request so RLS-scoped agents query
 * the database as that user. In the old iframe embed these values arrived via
 * postMessage; natively we read the session straight from Katana's AuthContext
 * and keep the office api-client's sessionStorage mirror in sync (including on
 * token refresh).
 */
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { setKatanaAuth } from '@/lib/office/app/api-client'
import type { NavMode } from '@/lib/office/app/nav-access'

export function useKatanaOfficeAuth(): {
  ready: boolean
  navMode: NavMode
  katanaUserName: string | null
  /** Stable Supabase user id — used as the office session owner key. */
  katanaUserId: string | null
  /** Signed-in user's avatar (Microsoft profile photo), for chat bubbles. */
  katanaAvatarUrl: string | null
} {
  const { user, session, profile, loading } = useAuth()

  useEffect(() => {
    if (session?.access_token) {
      setKatanaAuth(session.access_token, profile?.organization_id ?? null)
    }
  }, [session?.access_token, profile?.organization_id])

  // Owners/admins get the full office; everyone else the trimmed Katana nav.
  const navMode: NavMode = profile?.role === 'owner' || profile?.role === 'admin' ? 'full' : 'katana'

  const katanaUserName =
    (profile as { full_name?: string | null } | null)?.full_name
    || (session?.user?.email ? session.user.email.split('@')[0] : null)
    || null

  // The user id is the stable identity the office proxy filters chats by.
  const katanaUserId = user?.id ?? session?.user?.id ?? null

  const katanaAvatarUrl =
    profile?.avatar_url
    || (user?.user_metadata as { avatar_url?: string; picture?: string } | undefined)?.avatar_url
    || (user?.user_metadata as { picture?: string } | undefined)?.picture
    || null

  return { ready: !loading, navMode, katanaUserName, katanaUserId, katanaAvatarUrl }
}
