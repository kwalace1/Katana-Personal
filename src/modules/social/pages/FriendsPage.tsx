import { Navigate } from 'react-router-dom'

/** Friends now live under Social → Friends tab. */
export default function FriendsPage() {
  return <Navigate to="/social?tab=friends" replace />
}
