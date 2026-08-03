import { useLocation } from 'react-router-dom'
import { EmployeePortalNav } from './EmployeePortalNav'
import { MotionPage } from '@/components/motion-page'
import { EmployeePortalCommsProvider } from '@/contexts/EmployeePortalCommsContext'

interface EmployeePortalLayoutProps {
  children: React.ReactNode
}

/**
 * Wraps employee portal pages with a shared sub-nav so users can move between
 * Dashboard, Directory, Performance, Goals, etc. without using browser back/forward.
 */
/** Height of sticky portal sub-nav (py-3 + tab row); used for column scroll areas below. */
export const EMPLOYEE_PORTAL_NAV_HEIGHT = '4.5rem'

export function EmployeePortalLayout({ children }: EmployeePortalLayoutProps) {
  const location = useLocation()
  return (
    <div
      className="employee-portal-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-background"
      style={{ ['--employee-portal-nav-h' as string]: EMPLOYEE_PORTAL_NAV_HEIGHT }}
    >
      <EmployeePortalNav />
      <MotionPage
        key={location.pathname}
        subtle
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden h-full"
      >
        <EmployeePortalCommsProvider>
          <div className="employee-portal-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
            {children}
          </div>
        </EmployeePortalCommsProvider>
      </MotionPage>
    </div>
  )
}
