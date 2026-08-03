import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/components/AuthGuard'
import { AppShell } from '@/components/layout/AppShell'
import { useAuth } from '@/contexts/AuthContext'
import LandingPage from '@/modules/dashboard/pages/LandingPage'
import AuthPage from '@/modules/dashboard/pages/AuthPage'
import DashboardPage from '@/modules/dashboard/pages/DashboardPage'
import SettingsPage from '@/modules/dashboard/pages/SettingsPage'
import TasksPage from '@/modules/tasks/pages/TasksPage'
import CalendarPage from '@/modules/calendar/pages/CalendarPage'
import NotesPage from '@/modules/notes/pages/NotesPage'
import GoalsPage from '@/modules/goals/pages/GoalsPage'
import HabitsPage from '@/modules/habits/pages/HabitsPage'
import JournalPage from '@/modules/journal/pages/JournalPage'
import HealthPage from '@/modules/health/pages/HealthPage'
import DocumentsPage from '@/modules/documents/pages/DocumentsPage'
import AskPage from '@/modules/assistant/pages/AskPage'
import FriendsPage from '@/modules/social/pages/FriendsPage'
import CirclesPage from '@/modules/social/pages/CirclesPage'
import SharedPage from '@/modules/social/pages/SharedPage'
import InviteJoinPage from '@/modules/social/pages/InviteJoinPage'

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  )
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }
  return <Navigate to={user ? '/dashboard' : '/'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/invite/circle/:token" element={<InviteJoinPage />} />
      <Route path="/home" element={<RootRedirect />} />

      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/tasks" element={<Protected><TasksPage /></Protected>} />
      <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
      <Route path="/notes" element={<Protected><NotesPage /></Protected>} />
      <Route path="/goals" element={<Protected><GoalsPage /></Protected>} />
      <Route path="/habits" element={<Protected><HabitsPage /></Protected>} />
      <Route path="/journal" element={<Protected><JournalPage /></Protected>} />
      <Route path="/health" element={<Protected><HealthPage /></Protected>} />
      <Route path="/documents" element={<Protected><DocumentsPage /></Protected>} />
      <Route path="/ask" element={<Protected><AskPage /></Protected>} />
      <Route path="/friends" element={<Protected><FriendsPage /></Protected>} />
      <Route path="/circles" element={<Protected><CirclesPage /></Protected>} />
      <Route path="/shared" element={<Protected><SharedPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
