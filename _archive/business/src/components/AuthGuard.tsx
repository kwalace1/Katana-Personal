import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/careers') ||
    pathname.startsWith('/contact/') ||
    pathname.startsWith('/sign/') ||
    pathname === '/accept-invite'
  )
}

/**
 * When Supabase is configured, redirects unauthenticated users to the landing page
 * unless they are on a public path. Does nothing when Supabase is not configured (auth disabled).
 */
export function AuthGuard() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!isSupabaseConfigured || loading || user) return
    if (isPublicPath(location.pathname)) return
    navigate('/', { replace: true })
  }, [isSupabaseConfigured, loading, user, location.pathname, navigate])

  return null
}
