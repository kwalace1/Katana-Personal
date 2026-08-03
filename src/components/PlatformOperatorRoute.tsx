import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isKatanaPlatformOperator } from '@/lib/platform-support-access'

/**
 * Restricts wipe/migrate tooling to Katana platform operators only.
 * Non-operators are redirected to /hub (owner/admin) or /employee.
 */
export function PlatformOperatorRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, organization, loading } = useAuth()

  if (loading) return null

  const allowed = Boolean(
    user &&
      isKatanaPlatformOperator({
        profile,
        organization,
        userEmail: user.email,
      })
  )

  if (!allowed) {
    const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin'
    return <Navigate to={isOwnerOrAdmin ? '/hub' : '/employee'} replace />
  }

  return <>{children}</>
}
