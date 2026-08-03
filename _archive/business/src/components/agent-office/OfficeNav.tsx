import { NavLink } from 'react-router-dom'
import { MessageSquare, Users, Network, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOffice } from './OfficeProvider'

const NAV_ITEMS = [
  { to: '/agents/chat', label: 'Chat', icon: MessageSquare, adminOnly: false },
  { to: '/agents/roster', label: 'Agents', icon: Users, adminOnly: true },
  { to: '/agents/org-chart', label: 'Org Chart', icon: Network, adminOnly: false },
  { to: '/agents/quality', label: 'Quality', icon: ShieldCheck, adminOnly: true },
]

export function OfficeNav() {
  const { navMode } = useOffice()
  return (
    <div className="shrink-0 flex items-center gap-1 px-4 sm:px-6 border-b border-border/60 bg-card/80 backdrop-blur-md">
      <div className="flex items-center gap-2 py-3 pr-4 mr-2 border-r border-border/60">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Network className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold whitespace-nowrap">Agent Office</span>
      </div>
      {NAV_ITEMS.filter((item) => !item.adminOnly || navMode === 'full').map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 px-3 py-1.5 my-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </div>
  )
}
