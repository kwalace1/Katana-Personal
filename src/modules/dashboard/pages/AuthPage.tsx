import { Navigate } from 'react-router-dom'

/** Auth lives on the app entrance (`/`). Keep `/auth` working for old links. */
export default function AuthPage() {
  return <Navigate to="/" replace />
}
