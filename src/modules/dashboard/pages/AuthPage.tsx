import { Navigate, useLocation } from 'react-router-dom'
import { isAuthCallbackLocation } from '@/lib/auth-callback'
import AuthCallbackPage from '@/modules/dashboard/pages/AuthCallbackPage'

/** Auth lives on the app entrance (`/`). Keep `/auth` working for old links. */
export default function AuthPage() {
  const location = useLocation()
  if (isAuthCallbackLocation(location.search, location.hash)) {
    return <AuthCallbackPage />
  }
  return <Navigate to="/" replace />
}
