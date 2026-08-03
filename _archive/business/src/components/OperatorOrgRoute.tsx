import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isOperatorOrgMember } from '@/lib/platform-support-access'

/**
 * Restricts a route to members of the Katana operator org (DW Growth Capital),
 * regardless of role. Non-members are redirected to their normal landing page.
 * The underlying data endpoint enforces the same gate server-side — this guard
 * is UX only.
 */
export function OperatorOrgRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, organization, loading } = useAuth()

  if (loading) return null

  const allowed = Boolean(
    user && isOperatorOrgMember({ profile, organization, userEmail: user.email }),
  )

  if (!allowed) {
    const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin'
    return <Navigate to={isOwnerOrAdmin ? '/hub' : '/employee'} replace />
  }

  return <>{children}</>
}
