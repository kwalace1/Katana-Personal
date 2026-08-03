import { Navigate } from 'react-router-dom'

/**
 * Legacy standalone recruitment UI used mock data (recruitment-data).
 * HR recruitment now lives on Katana HR → Recruitment tab (Supabase-backed).
 */
export default function RecruitmentPage() {
  return <Navigate to="/hr?tab=recruitment" replace />
}
