import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { staggerContainer, staggerItem } from '@/lib/motion-ui'
import {
  LayoutDashboard,
  Kanban,
  Box,
  Users,
  ClipboardList,
  UserCog,
  Bot,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  LineChart,
  MessageSquare,
  Swords,
  LifeBuoy,
  Landmark,
  PenLine,
} from 'lucide-react'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import { EmployeePortalLaunchpadLink } from '@/components/employee/EmployeePortalLaunchpadLink'

const navItems = [
  { path: '/hub', label: 'Hub', icon: LayoutDashboard },
  { path: '/projects', label: 'Katana Projects', icon: Kanban },
  { path: '/inventory', label: 'Katana Inventory', icon: Box },
  { path: '/customer-success', label: 'Katana Customers', icon: Users },
  { path: '/finance', label: 'Katana Finance', icon: Landmark },
  { path: '/esign', label: 'Katana E-Sign', icon: PenLine },
  { path: '/workforce', label: 'Katana Workforce', icon: ClipboardList },
  { path: '/hr', label: 'Katana HR', icon: UserCog },
  { path: '/careers', label: 'Careers', icon: Briefcase },
  { path: '/automation', label: 'Automation', icon: Bot },
  { path: '/kyi', label: 'Know Your Investor', icon: LineChart },
  { path: '/comms', label: 'Katana Comms', icon: MessageSquare },
  { path: '/agents', label: 'Agent Office', icon: Swords },
  { path: '/support', label: 'Katana Support', icon: LifeBuoy },
]

const MotionLink = motion.create(Link)

interface SidebarProps {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
}

function NavSkeleton({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <div className="space-y-2 animate-pulse" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`h-9 rounded-lg bg-muted ${isCollapsed ? 'mx-1' : 'mx-0'}`}
        />
      ))}
    </div>
  )
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const location = useLocation()
  const { hasModuleAccess, loading } = useModuleAccess()
  const showEmployeeLaunchpad = hasModuleAccess('/employee')
  const visibleItems = navItems.filter((item) => hasModuleAccess(item.path))

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-card border-r border-border z-50 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-72'} -translate-x-full lg:translate-x-0`}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 bg-background rounded-sm transform rotate-45" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full" />
              </div>
              {!isCollapsed && <span className="text-xl font-bold text-foreground">Katana</span>}
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-3 mb-4">
            {showEmployeeLaunchpad && (
              <div className="mb-4">
                {!isCollapsed && (
                  <p className="text-xs font-semibold text-muted-foreground mb-2">LAUNCHPAD</p>
                )}
                <EmployeePortalLaunchpadLink variant="sidebar" collapsed={isCollapsed} />
              </div>
            )}

            {!isCollapsed && <p className="text-xs font-semibold text-muted-foreground mb-2">MODULES</p>}
            <nav className="space-y-1">
              {loading ? (
                <NavSkeleton isCollapsed={isCollapsed} />
              ) : (
                <motion.div
                  className="space-y-1"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="show"
                >
                  {visibleItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname.startsWith(item.path)
                    return (
                      <MotionLink
                        key={item.path}
                        to={item.path}
                        title={item.label}
                        variants={staggerItem}
                        className={`flex items-center gap-3 py-2 rounded-lg transition-all duration-200 px-2.5 ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        } ${isCollapsed ? 'justify-center' : ''}`}
                      >
                        <Icon className="w-4 h-4" />
                        {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                      </MotionLink>
                    )
                  })}
                </motion.div>
              )}
            </nav>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full hidden lg:flex items-center justify-center gap-1.5 px-3 py-2 rounded-md hover:bg-accent transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </aside>
  )
}

