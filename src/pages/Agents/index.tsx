import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { MotionPage } from '@/components/motion-page'
import { OfficeProvider } from '@/components/agent-office/OfficeProvider'
import { OfficeNav } from '@/components/agent-office/OfficeNav'

const ChatView = lazy(() => import('@/components/agent-office/chat/ChatView'))
const AgentsView = lazy(() => import('@/components/agent-office/agents/AgentsView'))
const OrgChartView = lazy(() => import('@/components/agent-office/org-chart/OrgChartView'))
const QualityView = lazy(() => import('@/components/agent-office/quality/QualityView'))

function ViewLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}

/** Index redirect that preserves router state (floating helper deep-links carry { agentName }). */
function IndexRedirect() {
  const location = useLocation()
  return <Navigate to="chat" state={location.state} replace />
}

/**
 * Agent Office — Katana-native module for the agent workspace.
 * Data and agent execution come from the internal office API (/api/office);
 * everything the user sees is built from Katana's design system.
 */
export default function AgentsPage() {
  return (
    <MotionPage
      subtle
      className="flex flex-col h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] overflow-hidden"
    >
      <MotionConfig reducedMotion="user">
        <OfficeProvider>
          <OfficeNav />
          <div className="flex-1 min-h-0">
            <Suspense fallback={<ViewLoader />}>
              <Routes>
                <Route index element={<IndexRedirect />} />
                <Route path="chat" element={<ChatView />} />
                <Route path="chat/:agentId" element={<ChatView />} />
                <Route path="roster" element={<AgentsView />} />
                <Route path="org-chart" element={<OrgChartView />} />
                <Route path="quality" element={<QualityView />} />
                <Route path="*" element={<Navigate to="chat" replace />} />
              </Routes>
            </Suspense>
          </div>
        </OfficeProvider>
      </MotionConfig>
    </MotionPage>
  )
}
