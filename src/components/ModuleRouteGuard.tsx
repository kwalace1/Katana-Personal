import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import { getModuleIdByPath } from '@/lib/module-access'

/** Paths that require owner or admin (not module_access alone). */
const ADMIN_ONLY_PATH_PREFIXES = [
  '/settings/organization',
  '/migrate',
  '/migrate-customer-success',
]

/**
 * Redirects to /employee when the current path is a module the user does not have access to.
 * Owner/admin are never redirected (they always have access). Only redirect when user is logged in.
 */
export function ModuleRouteGuard() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { hasModuleAccess, loading } = useModuleAccess()

  const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin'

  useEffect(() => {
    if (!user || loading) return
    // Wait for profile so we know if user is owner/admin (they always have access)
    if (!profile) return
    if (isOwnerOrAdmin) return

    if (ADMIN_ONLY_PATH_PREFIXES.some((p) => location.pathname.startsWith(p))) {
      navigate('/employee', { replace: true })
      return
    }

    const moduleId = getModuleIdByPath(location.pathname)
    if (moduleId && !hasModuleAccess(location.pathname)) {
      navigate('/employee', { replace: true })
    }
  }, [location.pathname, user, profile, loading, hasModuleAccess, navigate, isOwnerOrAdmin])

  return null
}
